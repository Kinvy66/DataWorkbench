import { describe, expect, it } from 'vitest'
import {
  CLIPBOARD_MAX_CELLS,
  assertRangeSize,
  cellInRange,
  clampRange,
  deletePatches,
  formatTsvCell,
  normalizeRange,
  parseTsv,
  pastePatches,
  rangeCellCount,
  serializeTsv
} from './tableTsv'

describe('table TSV clipboard', () => {
  it('normalizes and counts a rectangular range', () => {
    const range = normalizeRange(4, 2, 1, 5)
    expect(range).toEqual({ r0: 1, c0: 2, r1: 4, c1: 5 })
    expect(rangeCellCount(range)).toBe(16)
    expect(cellInRange(range, 1, 2)).toBe(true)
    expect(cellInRange(range, 0, 2)).toBe(false)
  })

  it('clamps a range to the table shape', () => {
    expect(clampRange(normalizeRange(0, 0, 9, 9), 3, 2)).toEqual({ r0: 0, c0: 0, r1: 2, c1: 1 })
    expect(clampRange(normalizeRange(0, 0, 1, 1), 0, 4)).toBeNull()
  })

  it('round-trips TSV like Excel', () => {
    const text = serializeTsv([
      ['a', 1, null],
      ['b', true, '']
    ])
    expect(text).toBe('a\t1\t\nb\ttrue\t\n')
    expect(parseTsv(text)).toEqual([
      ['a', '1', ''],
      ['b', 'true', '']
    ])
    expect(formatTsvCell(false)).toBe('false')
  })

  it('pastes from the top-left and drops cells outside the table', () => {
    const result = pastePatches(
      1,
      1,
      [
        ['x', 'y', 'z'],
        ['1', '2']
      ],
      3,
      3
    )
    expect(result.droppedCols).toBe(1)
    expect(result.droppedRows).toBe(0)
    expect(result.patches).toEqual([
      { row: 1, col: 1, value: 'x' },
      { row: 1, col: 2, value: 'y' },
      { row: 2, col: 1, value: '1' },
      { row: 2, col: 2, value: '2' }
    ])
  })

  it('turns a delete range into empty-string patches', () => {
    expect(deletePatches({ r0: 0, c0: 1, r1: 1, c1: 1 })).toEqual([
      { row: 0, col: 1, value: '' },
      { row: 1, col: 1, value: '' }
    ])
  })

  it('rejects a range larger than the clipboard cap', () => {
    expect(() => assertRangeSize({ r0: 0, c0: 0, r1: CLIPBOARD_MAX_CELLS, c1: 0 })).toThrow(
      /too large/
    )
  })
})
