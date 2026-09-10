import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { SidecarBridge } from './sidecar'

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createMockChild(options?: { echoAndExit?: boolean }): ChildProcessWithoutNullStreams {
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  const stdin = new PassThrough()
  stderr.setEncoding('utf8')
  const child = new EventEmitter() as ChildProcessWithoutNullStreams
  child.stdout = stdout
  child.stderr = stderr
  child.stdin = stdin
  child.kill = (() => {
    queueMicrotask(() => child.emit('exit', 1, null))
    return true
  }) as ChildProcessWithoutNullStreams['kill']
  if (options?.echoAndExit) {
    stdin.on('data', (buf: Buffer) => {
      const line = String(buf).trim()
      if (!line) {
        return
      }
      const req = JSON.parse(line) as { id: number }
      stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { ok: true } }) + '\n')
      queueMicrotask(() => child.emit('exit', 0, null))
    })
  }
  return child
}

function emitReady(child: ChildProcessWithoutNullStreams, pid = 1): void {
  child.stdout.write(
    JSON.stringify({
      jsonrpc: '2.0',
      method: 'host.ready',
      params: { pid, pandasAvailable: true }
    }) + '\n'
  )
}

describe('SidecarBridge.invoke', () => {
  it('rejects with RpcError when the process never starts', async () => {
    const bridge = new SidecarBridge({ processWaitMs: 20 })
    await expect(bridge.invoke('data.list', {})).rejects.toMatchObject({
      name: 'RpcError',
      i18nKey: 'rpc.sidecarNotRunning'
    })
  })
})

describe('SidecarBridge crash restart', () => {
  it('restarts once after an unexpected exit and rejects in-flight RPC', async () => {
    const children: ChildProcessWithoutNullStreams[] = []
    const notes: Array<{ method: string; params: unknown }> = []
    const bridge = new SidecarBridge({
      processWaitMs: 200,
      restartDelayMs: 5,
      spawnProcess: () => {
        const child = createMockChild()
        children.push(child)
        return child
      }
    })
    bridge.onNotify((method, params) => notes.push({ method, params }))
    bridge.start()
    const pending = bridge.invoke('data.list', {})
    await delay(10)
    children[0].emit('exit', 1, null)
    await expect(pending).rejects.toMatchObject({
      name: 'RpcError',
      i18nKey: 'rpc.sidecarExited'
    })
    await delay(20)
    expect(children).toHaveLength(2)
    expect(notes.some((n) => n.method === 'host.crashed' && (n.params as { willRestart: boolean }).willRestart)).toBe(
      true
    )
    emitReady(children[1], 22)
    await bridge.waitUntilReady(200)
    expect(notes.some((n) => n.method === 'host.ready')).toBe(true)
  })

  it('does not restart after the second unexpected exit', async () => {
    const children: ChildProcessWithoutNullStreams[] = []
    const notes: Array<{ method: string; params: unknown }> = []
    const bridge = new SidecarBridge({
      processWaitMs: 200,
      restartDelayMs: 5,
      spawnProcess: () => {
        const child = createMockChild()
        children.push(child)
        return child
      }
    })
    bridge.onNotify((method, params) => notes.push({ method, params }))
    bridge.start()
    children[0].emit('exit', 1, null)
    await delay(20)
    expect(children).toHaveLength(2)
    children[1].emit('exit', 1, null)
    await delay(20)
    expect(children).toHaveLength(2)
    const lastCrash = notes.filter((n) => n.method === 'host.crashed').at(-1)
    expect((lastCrash?.params as { willRestart: boolean }).willRestart).toBe(false)
  })

  it('does not respawn after an intentional shutdown', async () => {
    const children: ChildProcessWithoutNullStreams[] = []
    const notes: Array<{ method: string; params: unknown }> = []
    const bridge = new SidecarBridge({
      processWaitMs: 200,
      restartDelayMs: 5,
      spawnProcess: () => {
        const child = createMockChild({ echoAndExit: true })
        children.push(child)
        return child
      }
    })
    bridge.onNotify((method, params) => notes.push({ method, params }))
    bridge.start()
    const code = await bridge.shutdown(100)
    expect(code).toBe(0)
    await delay(20)
    expect(children).toHaveLength(1)
    expect(notes.some((n) => n.method === 'host.crashed')).toBe(false)
  })
})
