import { describe, expect, it, vi } from 'vitest'
import { BLOCK_SIZE } from './blockWindow'
import {
  GRID_CACHE_BLOCK_SIZE,
  GRID_MAX_BLOCKS_IN_CACHE,
  columnIndexFromField,
  createInfiniteDatasource,
  fieldForColumn,
  loadGridRecords,
  rowsToGridRecords
} from './gridDatasource'
import type { IGetRowsParams } from 'ag-grid-community'

function fakeBlock(origin: number, rowCount: number, colCount: number, totalRows: number) {
  const count = Math.min(rowCount, Math.max(0, totalRows - origin))
  const rows = Array.from({ length: count }, (_, i) =>
    Array.from({ length: colCount }, (_, c) => `${origin + i}:${c}`)
  )
  return { startRow: origin, rows }
}

describe('gridDatasource', () => {
  it('keeps AG Grid cache aligned to 512-row sidecar windows', () => {
    expect(GRID_CACHE_BLOCK_SIZE).toBe(BLOCK_SIZE)
    expect(GRID_CACHE_BLOCK_SIZE).toBe(512)
    expect(GRID_MAX_BLOCKS_IN_CACHE).toBe(3)
  })

  it('maps fetchBlock rows onto column fields', () => {
    const records = rowsToGridRecords(512, [['a', 1], ['b', 2]], 2)
    expect(records).toEqual([
      { __row: 512, c0: 'a', c1: 1 },
      { __row: 513, c0: 'b', c1: 2 }
    ])
    expect(fieldForColumn(3)).toBe('c3')
    expect(columnIndexFromField('c3')).toBe(3)
    expect(columnIndexFromField('_index')).toBeNull()
  })

  it('loads one 512-row origin for an aligned infinite-model request', async () => {
    const fetchBlock = vi.fn(async (startRow: number, rowCount: number) =>
      fakeBlock(startRow, rowCount, 2, 2000)
    )
    const rows = await loadGridRecords({
      startRow: 0,
      endRow: 512,
      rowCount: 2000,
      colCount: 2,
      fetchBlock
    })
    expect(fetchBlock).toHaveBeenCalledTimes(1)
    expect(fetchBlock).toHaveBeenCalledWith(0, 512)
    expect(rows).toHaveLength(512)
    expect(rows[0]).toEqual({ __row: 0, c0: '0:0', c1: '0:1' })
    expect(rows[511].__row).toBe(511)
  })

  it('covers a misaligned window with 512-row fetchBlock origins only', async () => {
    const fetchBlock = vi.fn(async (startRow: number, rowCount: number) =>
      fakeBlock(startRow, rowCount, 1, 1000)
    )
    const rows = await loadGridRecords({
      startRow: 500,
      endRow: 600,
      rowCount: 1000,
      colCount: 1,
      fetchBlock
    })
    expect(fetchBlock.mock.calls.map((call) => call[0]).sort((a, b) => a - b)).toEqual([0, 512])
    expect(rows).toHaveLength(100)
    expect(rows[0]).toEqual({ __row: 500, c0: '500:0' })
    expect(rows[99]).toEqual({ __row: 599, c0: '599:0' })
  })

  it('does not pull a 500k-row table into one getRows call', async () => {
    const fetchBlock = vi.fn(async (startRow: number, rowCount: number) =>
      fakeBlock(startRow, rowCount, 1, 500_000)
    )
    const datasource = createInfiniteDatasource({
      rowCount: 500_000,
      colCount: 1,
      fetchBlock
    })
    const success = vi.fn()
    const fail = vi.fn()
    datasource.getRows({
      startRow: 0,
      endRow: 512,
      successCallback: success,
      failCallback: fail
    } as IGetRowsParams)
    await vi.waitFor(() => expect(success).toHaveBeenCalled())
    expect(fail).not.toHaveBeenCalled()
    expect(fetchBlock).toHaveBeenCalledTimes(1)
    expect(fetchBlock.mock.calls[0][1]).toBe(512)
    const [rows, lastRow] = success.mock.calls[0]
    expect(rows).toHaveLength(512)
    expect(lastRow).toBe(500_000)
  })

  it('calls failCallback when fetchBlock rejects', async () => {
    const datasource = createInfiniteDatasource({
      rowCount: 100,
      colCount: 1,
      fetchBlock: async () => {
        throw new Error('rpc down')
      }
    })
    const success = vi.fn()
    const fail = vi.fn()
    datasource.getRows({
      startRow: 0,
      endRow: 512,
      successCallback: success,
      failCallback: fail
    } as IGetRowsParams)
    await vi.waitFor(() => expect(fail).toHaveBeenCalled())
    expect(success).not.toHaveBeenCalled()
  })
})
