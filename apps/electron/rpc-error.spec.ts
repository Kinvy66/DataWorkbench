import { describe, expect, it } from 'vitest'
import { encodeRpcErrorMessage, isDwRpcErrorPayload, rpcTimeoutMs } from './rpc-error'

describe('rpcTimeoutMs', () => {
  it('gives data.import two minutes', () => {
    expect(rpcTimeoutMs('data.import')).toBe(120_000)
    expect(rpcTimeoutMs('data.list')).toBe(30_000)
  })
})

describe('encodeRpcErrorMessage', () => {
  it('embeds i18nKey so it survives contextBridge Error cloning', () => {
    expect(encodeRpcErrorMessage('File not found', 'data.fileMissing')).toBe(
      'File not found [@@data.fileMissing]'
    )
  })
})

describe('isDwRpcErrorPayload', () => {
  it('detects the main-process error envelope', () => {
    expect(isDwRpcErrorPayload({ __dwRpcError: true, code: 1001, message: 'x' })).toBe(true)
    expect(isDwRpcErrorPayload({ ok: true })).toBe(false)
  })
})
