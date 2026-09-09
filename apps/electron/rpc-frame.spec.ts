import { describe, expect, it } from 'vitest'
import { StdoutFramer, isArrowFetchHeader } from './rpc-frame'

describe('StdoutFramer', () => {
  it('emits JSON lines', () => {
    const framer = new StdoutFramer()
    const frames = framer.push(Buffer.from('{"jsonrpc":"2.0","id":1,"result":{"ok":true}}\n', 'utf8'))
    expect(frames).toEqual([{ kind: 'line', line: '{"jsonrpc":"2.0","id":1,"result":{"ok":true}}' }])
  })

  it('reads an Arrow payload that contains newlines without scanning them as JSON', () => {
    const header = JSON.stringify({
      jsonrpc: '2.0',
      id: 3,
      result: { encoding: 'arrow-v1', bytes: 4, meta: { rows: 1, startRow: 0 } }
    })
    const payload = Buffer.from([0x0a, 0x41, 0x0a, 0x42])
    const rest = Buffer.from('{"jsonrpc":"2.0","id":4,"result":{"ok":true}}\n', 'utf8')
    const chunk = Buffer.concat([Buffer.from(`${header}\n`, 'utf8'), payload, rest])
    const framer = new StdoutFramer()
    const first = framer.push(chunk.subarray(0, 20))
    expect(first).toEqual([])
    const frames = framer.push(chunk.subarray(20))
    expect(frames[0]).toMatchObject({ kind: 'arrow', id: 3, startRow: 0, rowCount: 1 })
    expect((frames[0] as { payload: Buffer }).payload.equals(payload)).toBe(true)
    expect(frames[1]).toMatchObject({ kind: 'line' })
  })
})

describe('isArrowFetchHeader', () => {
  it('accepts the protocol header', () => {
    expect(
      isArrowFetchHeader({ encoding: 'arrow-v1', bytes: 12, meta: { rows: 2, startRow: 0 } })
    ).toBe(true)
    expect(isArrowFetchHeader({ startRow: 0, rows: [] })).toBe(false)
  })
})
