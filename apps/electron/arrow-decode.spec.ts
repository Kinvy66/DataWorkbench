import { describe, expect, it } from 'vitest'
import { tableFromArrays, tableToIPC } from 'apache-arrow'
import { arrowIpcToRows, arrowValueToJson } from './arrow-decode'

describe('arrowValueToJson', () => {
  it('normalizes nullish, NaN, bigint, and Date', () => {
    expect(arrowValueToJson(null)).toBeNull()
    expect(arrowValueToJson(Number.NaN)).toBeNull()
    expect(arrowValueToJson(7n)).toBe(7)
    expect(arrowValueToJson(new Date('2020-01-02T00:00:00.000Z'))).toBe('2020-01-02T00:00:00.000Z')
  })
})

describe('arrowIpcToRows', () => {
  it('decodes an Arrow stream into row-major JSON cells', () => {
    const table = tableFromArrays({
      '0': Int32Array.from([1, 2]),
      '1': ['甲', '乙']
    })
    const ipc = tableToIPC(table, 'stream')
    expect(arrowIpcToRows(Buffer.from(ipc))).toEqual([
      [1, '甲'],
      [2, '乙']
    ])
  })

  it('returns an empty grid for an empty payload', () => {
    expect(arrowIpcToRows(Buffer.alloc(0))).toEqual([])
  })
})
