import { CHART_SUBPLOT_MAX_DIM, type ProjectFigurePersist } from '@dw/rpc-types'

export type ChartFigure = {
  id: string
  title: string
  rows: number
  cols: number
  slots: Array<string | null>
}

export const SUBPLOT_LAYOUTS = ['1x2', '2x1', '2x2', '2x3', '3x2', '3x3'] as const

export function isGridFigure(figure: Pick<ChartFigure, 'rows' | 'cols'>): boolean {
  return figure.rows * figure.cols > 1
}

export function parseSubplotLayout(text: string): { rows: number; cols: number } | null {
  const match = text.trim().match(/^(\d+)\s*[x×X]\s*(\d+)$/)
  if (!match) {
    return null
  }
  const rows = Number(match[1])
  const cols = Number(match[2])
  if (!Number.isInteger(rows) || !Number.isInteger(cols)) {
    return null
  }
  if (rows < 1 || cols < 1 || rows > CHART_SUBPLOT_MAX_DIM || cols > CHART_SUBPLOT_MAX_DIM) {
    return null
  }
  if (rows === 1 && cols === 1) {
    return null
  }
  return { rows, cols }
}

export function emptyFigure(rows: number, cols: number, title?: string): ChartFigure {
  return {
    id: crypto.randomUUID(),
    title: title?.trim() || `${rows}×${cols}`,
    rows,
    cols,
    slots: Array.from({ length: rows * cols }, () => null)
  }
}

export function wrapChartAsFigure(chart: { id: string; title: string }): ChartFigure {
  return {
    id: crypto.randomUUID(),
    title: chart.title,
    rows: 1,
    cols: 1,
    slots: [chart.id]
  }
}

export function slotIndexOf(figure: ChartFigure, chartId: string | null): number {
  if (!chartId) {
    return 0
  }
  const index = figure.slots.indexOf(chartId)
  return index >= 0 ? index : 0
}

export function parseProjectFigure(
  raw: ProjectFigurePersist,
  chartIds: Set<string>
): ChartFigure | null {
  const rows = raw.rows
  const cols = raw.cols
  if (!Number.isInteger(rows) || !Number.isInteger(cols)) {
    return null
  }
  if (rows < 1 || cols < 1 || rows > CHART_SUBPLOT_MAX_DIM || cols > CHART_SUBPLOT_MAX_DIM) {
    return null
  }
  if (typeof raw.id !== 'string' || !raw.id) {
    return null
  }
  const expected = rows * cols
  const slots = Array.isArray(raw.slots) ? raw.slots.slice(0, expected) : []
  while (slots.length < expected) {
    slots.push(null)
  }
  return {
    id: raw.id,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title : `${rows}×${cols}`,
    rows,
    cols,
    slots: slots.map((id) => (typeof id === 'string' && chartIds.has(id) ? id : null))
  }
}
