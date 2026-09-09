import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { parseRpcLine } from './rpc-parse'

export type SidecarLog = { stream: 'stderr' | 'protocol'; text: string }

function findRepoRoot(startDir: string): string {
  const starts = [startDir, process.cwd()]
  for (const start of starts) {
    let dir = start
    for (let i = 0; i < 12; i++) {
      if (fs.existsSync(path.join(dir, 'python', 'dw_host', '__main__.py'))) {
        return dir
      }
      const parent = path.dirname(dir)
      if (parent === dir) {
        break
      }
      dir = parent
    }
  }
  throw new Error('Cannot find repository root (python/dw_host missing)')
}

function resolvePython(repoRoot: string): { cmd: string; args: string[] } {
  const fromEnv = process.env.DW_PYTHON
  if (fromEnv) {
    return { cmd: fromEnv, args: [] }
  }
  const venvPy = path.join(repoRoot, 'python', '.venv', 'Scripts', 'python.exe')
  if (fs.existsSync(venvPy)) {
    return { cmd: venvPy, args: [] }
  }
  const venvUnix = path.join(repoRoot, 'python', '.venv', 'bin', 'python')
  if (fs.existsSync(venvUnix)) {
    return { cmd: venvUnix, args: [] }
  }
  if (process.platform === 'win32') {
    return { cmd: 'py', args: ['-3.12'] }
  }
  return { cmd: 'python3', args: [] }
}

export class SidecarBridge {
  private child: ChildProcessWithoutNullStreams | null = null
  private buf = ''
  private nextId = 1
  private pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }
  >()
  private notifyHandlers = new Set<(method: string, params: unknown) => void>()
  private logHandlers = new Set<(entry: SidecarLog) => void>()
  private ready = false
  private readyWaiters: Array<() => void> = []

  onNotify(handler: (method: string, params: unknown) => void): () => void {
    this.notifyHandlers.add(handler)
    return () => this.notifyHandlers.delete(handler)
  }

  onLog(handler: (entry: SidecarLog) => void): () => void {
    this.logHandlers.add(handler)
    return () => this.logHandlers.delete(handler)
  }

  waitUntilReady(timeoutMs = 10000): Promise<void> {
    if (this.ready) {
      return Promise.resolve()
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Sidecar host.ready timeout')), timeoutMs)
      this.readyWaiters.push(() => {
        clearTimeout(timer)
        resolve()
      })
    })
  }

  start(): void {
    if (this.child) {
      return
    }
    const repoRoot = findRepoRoot(__dirname)
    const pythonRoot = path.join(repoRoot, 'python')
    const py = resolvePython(repoRoot)
    const args = [...py.args, '-u', '-m', 'dw_host']
    const env = {
      ...process.env,
      PYTHONUNBUFFERED: '1',
      PYTHONPATH: pythonRoot,
      PYTHONIOENCODING: 'utf-8'
    }
    this.emitLog({ stream: 'stderr', text: `Starting sidecar: ${py.cmd} ${args.join(' ')}` })
    this.child = spawn(py.cmd, args, {
      cwd: pythonRoot,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    })
    this.child.stdout.setEncoding('utf8')
    this.child.stderr.setEncoding('utf8')
    this.child.stdout.on('data', (chunk: string) => this.onStdout(chunk))
    this.child.stderr.on('data', (chunk: string) => {
      for (const line of chunk.split(/\r?\n/)) {
        if (line.length > 0) {
          this.emitLog({ stream: 'stderr', text: line })
        }
      }
    })
    this.child.on('exit', (code, signal) => {
      this.emitLog({ stream: 'stderr', text: `Sidecar exited code=${code} signal=${signal}` })
      this.child = null
      this.ready = false
      for (const [, p] of this.pending) {
        clearTimeout(p.timer)
        p.reject(new Error('Sidecar exited'))
      }
      this.pending.clear()
    })
    this.child.on('error', (err) => {
      this.emitLog({ stream: 'stderr', text: `Sidecar spawn error: ${err.message}` })
    })
  }

  async invoke(method: string, params?: unknown, timeoutMs = 30000): Promise<unknown> {
    const child = this.child
    if (!child || !child.stdin.writable) {
      throw new Error('Sidecar is not running')
    }
    const id = this.nextId++
    const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params: params ?? {} })
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`RPC timeout: ${method}`))
      }, timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      child.stdin.write(payload + '\n')
    })
  }

  async shutdown(timeoutMs = 5000): Promise<number> {
    const child = this.child
    if (!child) {
      return 0
    }
    try {
      await this.invoke('host.shutdown', {}, timeoutMs)
    } catch {
      // still wait for exit
    }
    return await new Promise((resolve) => {
      const timer = setTimeout(() => {
        child.kill()
        resolve(1)
      }, timeoutMs)
      child.once('exit', (code) => {
        clearTimeout(timer)
        resolve(code ?? 1)
      })
    })
  }

  private onStdout(chunk: string): void {
    this.buf += chunk
    while (true) {
      const nl = this.buf.indexOf('\n')
      if (nl < 0) {
        break
      }
      let line = this.buf.slice(0, nl)
      this.buf = this.buf.slice(nl + 1)
      if (line.endsWith('\r')) {
        line = line.slice(0, -1)
      }
      this.handleLine(line)
    }
  }

  private handleLine(line: string): void {
    if (line.length === 0) {
      return
    }
    const parsed = parseRpcLine(line)
    if (parsed.kind === 'pollution') {
      const msg = `Protocol pollution on sidecar stdout: ${parsed.raw}`
      this.emitLog({ stream: 'protocol', text: msg })
      this.emitNotify('log.protocolPollution', { raw: parsed.raw })
      return
    }
    if (parsed.kind === 'notification') {
      if (parsed.method === 'host.ready') {
        this.ready = true
        const waiters = this.readyWaiters.splice(0)
        for (const w of waiters) {
          w()
        }
      }
      this.emitNotify(parsed.method, parsed.params)
      return
    }
    const pending = this.pending.get(Number(parsed.id))
    if (!pending) {
      this.emitLog({ stream: 'protocol', text: `Unexpected RPC id ${String(parsed.id)}` })
      return
    }
    this.pending.delete(Number(parsed.id))
    clearTimeout(pending.timer)
    if (parsed.error) {
      pending.reject(new Error(parsed.error.message))
    } else {
      pending.resolve(parsed.result)
    }
  }

  private emitNotify(method: string, params: unknown): void {
    for (const h of this.notifyHandlers) {
      h(method, params)
    }
  }

  private emitLog(entry: SidecarLog): void {
    for (const h of this.logHandlers) {
      h(entry)
    }
  }
}
