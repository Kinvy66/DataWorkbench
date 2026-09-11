import { describe, expect, it } from 'vitest'
import { RendererEventGate } from './renderer-events'

describe('RendererEventGate', () => {
  it('queues events until flush then delivers in order', () => {
    const gate = new RendererEventGate()
    const sent: Array<{ method: string; params: unknown }> = []
    const send = (method: string, params: unknown): void => {
      sent.push({ method, params })
    }
    gate.forward('log.line', { message: 'a' }, send)
    gate.forward('host.ready', { pid: 1 }, send)
    expect(sent).toEqual([])
    expect(gate.queued).toBe(2)
    gate.flush(send)
    expect(sent).toEqual([
      { method: 'log.line', params: { message: 'a' } },
      { method: 'host.ready', params: { pid: 1 } }
    ])
    gate.forward('log.line', { message: 'b' }, send)
    expect(sent[2]).toEqual({ method: 'log.line', params: { message: 'b' } })
  })

  it('drops the oldest event when the queue is full', () => {
    const gate = new RendererEventGate(2)
    const sent: string[] = []
    gate.forward('a', {}, (method) => sent.push(method))
    gate.forward('b', {}, (method) => sent.push(method))
    gate.forward('c', {}, (method) => sent.push(method))
    gate.flush((method) => sent.push(method))
    expect(sent).toEqual(['b', 'c'])
  })
})
