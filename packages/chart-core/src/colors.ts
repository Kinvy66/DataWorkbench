/** Semantic palette from the workbench icon guide. */
export const SERIES_COLORS = ['#5280C1', '#669E8B', '#CE6043', '#E6C27C', '#727272'] as const

export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length]
}
