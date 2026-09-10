import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { parseRpcLine } from './rpc-parse'
import { RpcError, rpcTimeoutMs } from './rpc-error'
import { arrowIpcToRows } from './arrow-decode'
import { StdoutFramer, type StdoutFrame } from './rpc-frame'
import { shouldRestartSidecar } from './sidecar-watchdog'

export type SidecarLog = { stream: 'stderr' | 'protocol'; text: string }
export type SidecarSpawnFn = () => ChildProcessWithoutNullStreams

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

export type SidecarBridgeOptions = {
  processWaitMs?: number
  spawnProcess?: SidecarSpawnFn
  restartDelayMs?: number
  maxRestarts?: number
}

export class SidecarBridge {
  private child: ChildProcessWithoutNullStreams | null = null
  private framer = new StdoutFramer()
  private nextId = 1
  private pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void; timer?: NodeJS.Timeout }
  >()
  private notifyHandlers = new Set<(method: string, params: unknown) => void>()
  private logHandlers = new Set<(entry: SidecarLog) => void>()
  private ready = false
  private readyWaiters: Array<() => void> = []
  private processWaiters: Array<(child: ChildProcessWithoutNullStreams | null) => void> = []
  private readonly processWaitMs: number
  private readonly spawnFn: SidecarSpawnFn
  private readonly restartDelayMs: number
  private readonly maxRestarts: number
  private restartAttempts = 0
  private shuttingDown = false
  private restartTimer: NodeJS.Timeout | null = null

  constructor(options?: SidecarBridgeOptions) {
    this.processWaitMs = options?.processWaitMs ?? 10_000
    this.spawnFn = options?.spawnProcess ?? (() => this.spawnDefault())
    this.restartDelayMs = options?.restartDelayMs ?? 200
    this.maxRestarts = options?.maxRestarts ?? 1
  }

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
    if (this.child || this.shuttingDown) {
      return
    }
    this.framer = new StdoutFramer()
    this.ready = false
    this.attachChild(this.spawnFn())
  }

  private spawnDefault(): ChildProcessWithoutNullStreams {
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
    return spawn(py.cmd, args, {
      cwd: pythonRoot,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    })
  }

  async invoke(method: string, params?: unknown, timeoutMs = rpcTimeoutMs(method)): Promise<unknown> {
    const child = await this.waitForProcess()
    const id = this.nextId++
    const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params: params ?? {} })
    return new Promise((resolve, reject) => {
      const timer =
        timeoutMs > 0
          ? setTimeout(() => {
              this.pending.delete(id)
              reject(new Error(`RPC timeout: ${method}`))
            }, timeoutMs)
          : undefined
      this.pending.set(id, { resolve, reject, timer })
      child.stdin.write(payload + '\n')
    })
  }

  async shutdown(timeoutMs = 5000): Promise<number> {
    this.shuttingDown = true
    this.clearRestartTimer()
    const child = this.child
    if (!child) {
      return 0
    }
    const waitExit = new Promise<number>((resolve) => {
      const timer = setTimeout(() => {
        child.kill()
        resolve(1)
      }, timeoutMs)
      child.once('exit', (code) => {
        clearTimeout(timer)
        resolve(code ?? 1)
      })
    })
    try {
      await this.invoke('host.shutdown', {}, timeoutMs)
    } catch {
      // still wait for exit
    }
    return await waitExit
  }

  private attachChild(child: ChildProcessWithoutNullStreams): void {
    this.child = child
    this.flushProcessWaiters(child)
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: Buffer) => {
      for (const frame of this.framer.push(chunk)) {
        this.handleFrame(frame)
      }
    })
    child.stderr.on('data', (chunk: string) => {
      for (const line of chunk.split(/\r?\n/)) {
        if (line.length > 0) {
          this.emitLog({ stream: 'stderr', text: line })
        }
      }
    })
    child.on('exit', (code, signal) => {
      this.onChildExit(child, code, signal)
    })
    child.on('error', (err) => {
      this.emitLog({ stream: 'stderr', text: `Sidecar spawn error: ${err.message}` })
    })
  }

  private onChildExit(
    child: ChildProcessWithoutNullStreams,
    code: number | null,
    signal: NodeJS.Signals | null
  ): void {
    if (this.child !== child) {
      return
    }
    this.emitLog({ stream: 'stderr', text: `Sidecar exited code=${code} signal=${signal}` })
    this.child = null
    this.ready = false
    this.flushProcessWaiters(null)
    for (const [, p] of this.pending) {
      clearTimeout(p.timer)
      p.reject(this.sidecarExited())
    }
    this.pending.clear()
    const willRestart = shouldRestartSidecar({
      shuttingDown: this.shuttingDown,
      restartAttempts: this.restartAttempts,
      maxRestarts: this.maxRestarts
    })
    if (!this.shuttingDown) {
      this.emitNotify('host.crashed', { code, signal, willRestart })
    }
    if (!willRestart) {
      return
    }
    this.restartAttempts += 1
    this.scheduleRestart()
  }

  private scheduleRestart(): void {
    this.clearRestartTimer()
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null
      this.start()
    }, this.restartDelayMs)
  }

  private clearRestartTimer(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }
  }

  private sidecarUnavailable(): RpcError {
    return new RpcError(9001, 'Sidecar is not running', 'rpc.sidecarNotRunning')
  }

  private sidecarExited(): RpcError {
    return new RpcError(9001, 'Sidecar exited', 'rpc.sidecarExited')
  }

  private flushProcessWaiters(child: ChildProcessWithoutNullStreams | null): void {
    const waiters = this.processWaiters.splice(0)
    for (const waiter of waiters) {
      waiter(child)
    }
  }

  private waitForProcess(timeoutMs = this.processWaitMs): Promise<ChildProcessWithoutNullStreams> {
    const current = this.child
    if (current && current.stdin.writable) {
      return Promise.resolve(current)
    }
    return new Promise((resolve, reject) => {
      let timer: NodeJS.Timeout
      const onChild = (child: ChildProcessWithoutNullStreams | null): void => {
        clearTimeout(timer)
        if (child && child.stdin.writable) {
          resolve(child)
        } else {
          reject(this.sidecarUnavailable())
        }
      }
      timer = setTimeout(() => {
        const idx = this.processWaiters.indexOf(onChild)
        if (idx >= 0) {
          this.processWaiters.splice(idx, 1)
        }
        reject(this.sidecarUnavailable())
      }, timeoutMs)
      this.processWaiters.push(onChild)
    })
  }

  private handleFrame(frame: StdoutFrame): void {
    if (frame.kind === 'arrow') {
      const pending = this.pending.get(Number(frame.id))
      if (!pending) {
        this.emitLog({ stream: 'protocol', text: `Unexpected Arrow RPC id ${String(frame.id)}` })
        return
      }
      this.pending.delete(Number(frame.id))
      clearTimeout(pending.timer)
      try {
        pending.resolve({ startRow: frame.startRow, rows: arrowIpcToRows(frame.payload) })
      } catch (err) {
        pending.reject(err instanceof Error ? err : new Error(String(err)))
      }
      return
    }
    this.handleLine(frame.line)
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
      const data = parsed.error.data as { i18nKey?: string } | undefined
      pending.reject(new RpcError(parsed.error.code, parsed.error.message, data?.i18nKey))
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
