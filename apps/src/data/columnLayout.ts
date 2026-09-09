export const INDEX_COL_WIDTH = 56
export const DEFAULT_COL_WIDTH = 120
export const MIN_COL_WIDTH = 48

export function gridTemplate(indexWidth: number, widths: number[]): string {
  const body = widths.length > 0 ? widths.map((w) => `${w}px`).join(' ') : `${DEFAULT_COL_WIDTH}px`
  return `${indexWidth}px ${body}`
}

export function tableMinWidth(indexWidth: number, widths: number[]): number {
  const body = widths.length > 0 ? widths.reduce((sum, w) => sum + w, 0) : DEFAULT_COL_WIDTH
  return indexWidth + body
}

export function nextColumnWidth(startWidth: number, delta: number, minWidth = MIN_COL_WIDTH): number {
  return Math.max(minWidth, startWidth + delta)
}
