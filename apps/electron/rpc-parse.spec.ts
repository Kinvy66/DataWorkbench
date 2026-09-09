import { describe, expect, it } from 'vitest'
import { parseRpcLine } from './rpc-parse'

describe('parseRpcLine', () => {
  it('parses a JSON-RPC result', () => {
    const line = '{"jsonrpc":"2.0","id":1,"result":{"ok":true}}'
    expect(parseRpcLine(line)).toEqual({
      kind: 'response',
      id: 1,
      result: { ok: true },
      error: undefined
    })
  })

  it('strips Windows CR before parsing', () => {
    const line = '{"jsonrpc":"2.0","method":"host.ready","params":{"pid":3}}\r'
    expect(parseRpcLine(line)).toMatchObject({ kind: 'notification', method: 'host.ready' })
  })

  it('flags stdout pollution instead of hanging', () => {
    expect(parseRpcLine('oops')).toEqual({ kind: 'pollution', raw: 'oops' })
  })
})
