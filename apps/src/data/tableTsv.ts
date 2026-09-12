/** Excel-compatible TSV for the virtual table clipboard (Community AG Grid has no range module). */

export const CLIPBOARD_MAX_CELLS = 10_000

export type CellRange = {
  r0: number
  c0: number
  r1: number
  c1: number
}

export function normalizeRange(rowA: number, colA: number, rowB: number, colB: number): CellRange {
  return {
    r0: Math.min(rowA, rowB),
    c0: Math.min(colA, colB),
    r1: Math.max(rowA, rowB),
    c1: Math.max(colA, colB)
  }
}

export function rangeCellCount(range: CellRange): number {
  return (range.r1 - range.r0 + 1) * (range.c1 - range.c0 + 1)
}

export function cellInRange(range: CellRange, row: number, col: number): boolean {
  return row >= range.r0 && row <= range.r1 && col >= range.c0 && col <= range.c1
}

export function clampRange(range: CellRange, rowCount: number, colCount: number): CellRange | null {
  if (rowCount <= 0 || colCount <= 0) {
    return null
  }
  const r0 = Math.max(0, Math.min(range.r0, rowCount - 1))
  const r1 = Math.max(0, Math.min(range.r1, rowCount - 1))
  const c0 = Math.max(0, Math.min(range.c0, colCount - 1))
  const c1 = Math.max(0, Math.min(range.c1, colCount - 1))
  if (r1 < r0 || c1 < c0) {
    return null
  }
  return { r0, c0, r1, c1 }
}

export function formatTsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  return String(value)
}

export function serializeTsv(rect: unknown[][]): string {
  return `${rect.map((row) => row.map((cell) => formatTsvCell(cell)).join('\t')).join('\n')}\n`
}

export function parseTsv(text: string): string[][] {
  const raw = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (raw === '') {
    return []
  }
  const lines = raw.split('\n')
  if (lines.length && lines[lines.length - 1] === '') {
    lines.pop()
  }
  return lines.map((line) => line.split('\t'))
}

export function pastePatches(
  startRow: number,
  startCol: number,
  table: string[][],
  rowCount: number,
  colCount: number
): { patches: Array<{ row: number; col: number; value: string }>; droppedRows: number; droppedCols: number } {
  const patches: Array<{ row: number; col: number; value: string }> = []
  let droppedRows = 0
  let droppedCols = 0
  for (let r = 0; r < table.length; r++) {
    const row = startRow + r
    const fields = table[r] ?? []
    if (row < 0 || row >= rowCount) {
      droppedRows += 1
      continue
    }
    for (let c = 0; c < fields.length; c++) {
      const col = startCol + c
      if (col < 0 || col >= colCount) {
        droppedCols += 1
        continue
      }
      patches.push({ row, col, value: fields[c] ?? '' })
    }
  }
  return { patches, droppedRows, droppedCols }
}

export function deletePatches(range: CellRange): Array<{ row: number; col: number; value: string }> {
  const patches: Array<{ row: number; col: number; value: string }> = []
  for (let row = range.r0; row <= range.r1; row++) {
    for (let col = range.c0; col <= range.c1; col++) {
      patches.push({ row, col, value: '' })
    }
  }
  return patches
}

export function tooManyCellsError(count: number): Error {
  const err = new Error(`Clipboard range is too large (${count}) [@@edit.tooManyCells]`)
  ;(err as Error & { i18nKey: string }).i18nKey = 'edit.tooManyCells'
  return err
}

export function assertRangeSize(range: CellRange): void {
  const count = rangeCellCount(range)
  if (count > CLIPBOARD_MAX_CELLS) {
    throw tooManyCellsError(count)
  }
}
