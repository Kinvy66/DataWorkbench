import { describe, expect, it } from 'vitest'
import {
  DEFAULT_COL_WIDTH,
  INDEX_COL_WIDTH,
  gridTemplate,
  nextColumnWidth,
  tableMinWidth
} from './columnLayout'

describe('columnLayout', () => {
  it('builds a pixel grid that does not stretch with fr tracks', () => {
    expect(gridTemplate(INDEX_COL_WIDTH, [120, 80])).toBe('56px 120px 80px')
    expect(tableMinWidth(INDEX_COL_WIDTH, [120, 80])).toBe(256)
  })

  it('clamps dragged widths', () => {
    expect(nextColumnWidth(120, -200)).toBe(48)
    expect(nextColumnWidth(120, 40)).toBe(160)
    expect(DEFAULT_COL_WIDTH).toBe(120)
  })
})
