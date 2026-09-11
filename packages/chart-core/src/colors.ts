/** Icon-guide series colors (workbench semantic palette). Skip fills too light for lines. */
export const ICON_SERIES_COLORS = [
  '#5280C1',
  '#669E8B',
  '#CE6043',
  '#E6C27C',
  '#80559F',
  '#3CAED5',
  '#497CAD',
  '#727272'
] as const

/** Okabe–Ito colorblind-safe cycle; hex matches upstream QwtColorCycle::OkabeIto. */
export const OKABE_ITO_COLORS = [
  '#E69F00',
  '#56B4E9',
  '#009E73',
  '#F0E442',
  '#0072B2',
  '#D55E00',
  '#CC79A7',
  '#000000'
] as const

export const SERIES_PALETTE_IDS = ['icon', 'okabeIto'] as const

export type SeriesPaletteId = (typeof SERIES_PALETTE_IDS)[number]

export const DEFAULT_SERIES_PALETTE: SeriesPaletteId = 'icon'

export const SERIES_PALETTES: Record<SeriesPaletteId, readonly string[]> = {
  icon: ICON_SERIES_COLORS,
  okabeIto: OKABE_ITO_COLORS
}

export const SERIES_COLORS = ICON_SERIES_COLORS

export function isSeriesPaletteId(value: unknown): value is SeriesPaletteId {
  return value === 'icon' || value === 'okabeIto'
}

export function paletteColors(palette: SeriesPaletteId = DEFAULT_SERIES_PALETTE): readonly string[] {
  return SERIES_PALETTES[palette]
}

export function seriesColor(index: number, palette: SeriesPaletteId = DEFAULT_SERIES_PALETTE): string {
  const colors = paletteColors(palette)
  const size = colors.length
  const i = ((Math.trunc(index) % size) + size) % size
  return colors[i] ?? colors[0]
}

export function applyPaletteToSeries<T extends { color: string }>(
  series: T[],
  palette: SeriesPaletteId
): T[] {
  return series.map((item, index) => ({ ...item, color: seriesColor(index, palette) }))
}
