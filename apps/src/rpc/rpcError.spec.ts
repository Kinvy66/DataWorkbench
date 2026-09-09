import { describe, expect, it } from 'vitest'
import { decodeRpcError, isCancelled, translateRpcError } from './rpcError'

describe('decodeRpcError', () => {
  it('strips the i18nKey suffix', () => {
    expect(decodeRpcError('File not found [@@data.fileMissing]')).toEqual({
      message: 'File not found',
      i18nKey: 'data.fileMissing'
    })
  })
})

describe('translateRpcError', () => {
  it('uses the i18n key when present', () => {
    const err = new Error('File not found [@@data.fileMissing]')
    expect(translateRpcError(err, (k) => `T:${k}`, () => true)).toBe('T:data.fileMissing')
  })
})

describe('isCancelled', () => {
  it('detects a cancelled file dialog', () => {
    expect(isCancelled({ cancelled: true })).toBe(true)
    expect(isCancelled({ id: 'x' })).toBe(false)
  })
})
