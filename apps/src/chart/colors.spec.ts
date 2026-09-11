import { describe, expect, it } from 'vitest'
import {
  applyPaletteToSeries,
  DEFAULT_SERIES_PALETTE,
  ICON_SERIES_COLORS,
  isSeriesPaletteId,
  OKABE_ITO_COLORS,
  paletteColors,
  seriesColor
} from '@dw/chart-core'

describe('series palettes', () => {
  it('defaults to icon-guide colors and wraps the cycle', () => {
    expect(DEFAULT_SERIES_PALETTE).toBe('icon')
    expect(seriesColor(0)).toBe('#5280C1')
    expect(seriesColor(1)).toBe('#669E8B')
    expect(seriesColor(ICON_SERIES_COLORS.length)).toBe('#5280C1')
    expect(seriesColor(4)).toBe('#80559F')
  })

  it('uses the same Okabe–Ito hex list as upstream QwtColorCycle', () => {
    expect(OKABE_ITO_COLORS).toEqual([
      '#E69F00',
      '#56B4E9',
      '#009E73',
      '#F0E442',
      '#0072B2',
      '#D55E00',
      '#CC79A7',
      '#000000'
    ])
    expect(seriesColor(0, 'okabeIto')).toBe('#E69F00')
    expect(seriesColor(8, 'okabeIto')).toBe('#E69F00')
    expect(paletteColors('okabeIto')).not.toEqual(paletteColors('icon'))
  })

  it('recolors series by index without copying the full table', () => {
    const next = applyPaletteToSeries(
      [
        { key: 'a', color: '#111111' },
        { key: 'b', color: '#222222' }
      ],
      'okabeIto'
    )
    expect(next.map((item) => item.color)).toEqual(['#E69F00', '#56B4E9'])
    expect(isSeriesPaletteId('tab10')).toBe(false)
    expect(isSeriesPaletteId('icon')).toBe(true)
  })
})
