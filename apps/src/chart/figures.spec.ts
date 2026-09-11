import { describe, expect, it } from 'vitest'
import { parseSubplotLayout, wrapChartAsFigure } from './figures'

describe('parseSubplotLayout', () => {
  it('accepts RxC up to 3', () => {
    expect(parseSubplotLayout('2x2')).toEqual({ rows: 2, cols: 2 })
    expect(parseSubplotLayout('1×2')).toEqual({ rows: 1, cols: 2 })
    expect(parseSubplotLayout('3X3')).toEqual({ rows: 3, cols: 3 })
  })

  it('rejects 1x1 and out of range', () => {
    expect(parseSubplotLayout('1x1')).toBeNull()
    expect(parseSubplotLayout('4x2')).toBeNull()
    expect(parseSubplotLayout('grid')).toBeNull()
  })
})

describe('wrapChartAsFigure', () => {
  it('wraps a single chart as 1x1', () => {
    const figure = wrapChartAsFigure({ id: 'c1', title: 'wave' })
    expect(figure.rows).toBe(1)
    expect(figure.cols).toBe(1)
    expect(figure.slots).toEqual(['c1'])
    expect(figure.title).toBe('wave')
  })
})
