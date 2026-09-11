import type { IDatasource, IGetRowsParams } from 'ag-grid-community'
import { BLOCK_SIZE, blockOrigin, blockOriginsInRange } from './blockWindow'

export const GRID_CACHE_BLOCK_SIZE = BLOCK_SIZE
export const GRID_MAX_BLOCKS_IN_CACHE = 3

export type FetchBlockFn = (startRow: number, rowCount: number) => Promise<{
  startRow: number
  rows: unknown[][]
}>

export type GridRowRecord = Record<string, unknown> & { __row: number }

export function fieldForColumn(index: number): string {
  return `c${index}`
}

export function columnIndexFromField(field: string | undefined): number | null {
  if (!field || !/^c\d+$/.test(field)) {
    return null
  }
  return Number(field.slice(1))
}

export function rowToRecord(rowIndex: number, cells: unknown[], colCount: number): GridRowRecord {
  const rec: GridRowRecord = { __row: rowIndex }
  for (let c = 0; c < colCount; c++) {
    rec[fieldForColumn(c)] = cells[c] ?? null
  }
  return rec
}

export function rowsToGridRecords(
  startRow: number,
  rows: unknown[][],
  colCount: number
): GridRowRecord[] {
  return rows.map((cells, i) => rowToRecord(startRow + i, cells, colCount))
}

export async function loadGridRecords(options: {
  startRow: number
  endRow: number
  rowCount: number
  colCount: number
  fetchBlock: FetchBlockFn
  blockSize?: number
}): Promise<GridRowRecord[]> {
  const blockSize = options.blockSize ?? BLOCK_SIZE
  const origins = blockOriginsInRange(options.startRow, options.endRow, options.rowCount, blockSize)
  if (origins.length === 0) {
    return []
  }
  const blocks = await Promise.all(
    origins.map(async (origin) => {
      const block = await options.fetchBlock(origin, blockSize)
      return { origin, rows: block.rows }
    })
  )
  const byOrigin = new Map(blocks.map((block) => [block.origin, block.rows]))
  const lastExclusive = Math.min(options.endRow, options.rowCount)
  const records: GridRowRecord[] = []
  for (let row = options.startRow; row < lastExclusive; row++) {
    const origin = blockOrigin(row, blockSize)
    const local = row - origin
    const cells = byOrigin.get(origin)?.[local] ?? []
    records.push(rowToRecord(row, cells, options.colCount))
  }
  return records
}

export function createInfiniteDatasource(options: {
  rowCount: number
  colCount: number
  fetchBlock: FetchBlockFn
  onError?: (err: unknown) => void
}): IDatasource {
  let alive = true
  return {
    rowCount: options.rowCount,
    destroy() {
      alive = false
    },
    getRows(params: IGetRowsParams) {
      void loadGridRecords({
        startRow: params.startRow,
        endRow: params.endRow,
        rowCount: options.rowCount,
        colCount: options.colCount,
        fetchBlock: options.fetchBlock
      }).then(
        (rows) => {
          if (!alive) {
            return
          }
          params.successCallback(rows, options.rowCount)
        },
        (err) => {
          options.onError?.(err)
          if (!alive) {
            return
          }
          params.failCallback()
        }
      )
    }
  }
}
