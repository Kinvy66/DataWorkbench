import type { PlotKind, PlotSeriesData, SeriesStyle } from './UPlotChart'
import { annotationSvgMarkup, type ChartAnnotation } from './annotations'
import { boxPlotSvgMarkup, boxYExtent } from './boxPlot'
import { SVG_TEXT_FONT, xmlEscape } from './svgText'

export { SVG_TEXT_FONT, xmlEscape } from './svgText'

export type SvgExportOptions = {
  kind: PlotKind
  title?: string
  xLabel?: string
  yLabel?: string
  legend: boolean
  grid: boolean
  styles: SeriesStyle[]
  data: PlotSeriesData
  width?: number
  height?: number
  annotations?: ChartAnnotation[]
}

function formatTick(value: number, kind: PlotSeriesData['xKind']): string {
  if (kind === 'time') {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 16).replace('T', ' ')
    }
  }
  if (!Number.isFinite(value)) {
    return ''
  }
  const abs = Math.abs(value)
  if (abs >= 1e6 || (abs > 0 && abs < 1e-3)) {
    return value.toExponential(2)
  }
  return String(Number(value.toPrecision(6)))
}

function bounds(data: PlotSeriesData, kind?: PlotKind): { xMin: number; xMax: number; yMin: number; yMax: number } {
  if (kind === 'box' && data.boxes?.length) {
    const { yMin, yMax } = boxYExtent(data.boxes)
    const n = data.boxes.length
    const pad = Math.max((yMax - yMin) * 0.08, 1e-9)
    return { xMin: -0.5, xMax: Math.max(n - 0.5, 0.5), yMin: yMin - pad, yMax: yMax + pad }
  }
  let xMin = Infinity
  let xMax = -Infinity
  let yMin = Infinity
  let yMax = -Infinity
  for (let i = 0; i < data.x.length; i++) {
    const x = data.x[i]
    if (!Number.isFinite(x)) {
      continue
    }
    xMin = Math.min(xMin, x)
    xMax = Math.max(xMax, x)
    for (const series of data.ys) {
      const y = series[i]
      if (y == null || !Number.isFinite(y)) {
        continue
      }
      yMin = Math.min(yMin, y)
      yMax = Math.max(yMax, y)
    }
  }
  if (!Number.isFinite(xMin)) {
    return { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }
  }
  if (xMin === xMax) {
    xMin -= 1
    xMax += 1
  }
  if (!Number.isFinite(yMin) || yMin === yMax) {
    const mid = Number.isFinite(yMin) ? yMin : 0
    yMin = mid - 1
    yMax = mid + 1
  }
  return { xMin, xMax, yMin, yMax }
}

function minPositiveDx(xs: number[]): number {
  let min = Infinity
  for (let i = 1; i < xs.length; i++) {
    if (!Number.isFinite(xs[i]) || !Number.isFinite(xs[i - 1])) {
      continue
    }
    const delta = Math.abs(xs[i] - xs[i - 1])
    if (delta > 0) {
      min = Math.min(min, delta)
    }
  }
  return min
}

export type FigureSvgOptions = {
  title?: string
  rows: number
  cols: number
  panels: Array<SvgExportOptions | null>
  panelWidth?: number
  panelHeight?: number
  gap?: number
}

function seriesSvgInner(opts: SvgExportOptions): { width: number; height: number; inner: string } {
  const width = opts.width ?? 960
  const height = opts.height ?? 540
  const padL = 64
  const padR = opts.legend ? 128 : 28
  const padT = opts.title ? 44 : 20
  const padB = opts.xLabel ? 52 : 36
  const plotW = Math.max(40, width - padL - padR)
  const plotH = Math.max(40, height - padT - padB)
  const { xMin, xMax, yMin, yMax } = bounds(opts.data, opts.kind)
  const sx = (x: number) => padL + ((x - xMin) / (xMax - xMin)) * plotW
  const sy = (y: number) => padT + (1 - (y - yMin) / (yMax - yMin)) * plotH
  const xs = opts.data.x
  const isBox = opts.kind === 'box' && Boolean(opts.data.boxes?.length)
  const parts: string[] = [`<rect width="${width}" height="${height}" fill="#ffffff"/>`]

  if (opts.grid) {
    for (let i = 0; i <= 4; i++) {
      const y = padT + (plotH * i) / 4
      const x = padL + (plotW * i) / 4
      parts.push(
        `<line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" stroke="#ebeef5" stroke-width="1"/>`
      )
      parts.push(
        `<line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + plotH}" stroke="#ebeef5" stroke-width="1"/>`
      )
    }
  }

  parts.push(
    `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="#727272"/>`
  )
  parts.push(
    `<line x1="${padL}" y1="${padT + plotH}" x2="${padL + plotW}" y2="${padT + plotH}" stroke="#727272"/>`
  )

  if (isBox && opts.data.boxes) {
    opts.data.boxes.forEach((sample, index) => {
      parts.push(
        `<text x="${sx(index)}" y="${padT + plotH + 16}" text-anchor="middle" font-size="11" fill="#727272" font-family="${SVG_TEXT_FONT}">${xmlEscape(sample.key)}</text>`
      )
    })
    for (let i = 0; i <= 4; i++) {
      const yv = yMin + ((yMax - yMin) * i) / 4
      parts.push(
        `<text x="${padL - 8}" y="${sy(yv) + 4}" text-anchor="end" font-size="11" fill="#727272" font-family="${SVG_TEXT_FONT}">${xmlEscape(formatTick(yv, 'number'))}</text>`
      )
    }
  } else {
    for (let i = 0; i <= 4; i++) {
      const xv = xMin + ((xMax - xMin) * i) / 4
      const yv = yMin + ((yMax - yMin) * i) / 4
      parts.push(
        `<text x="${sx(xv)}" y="${padT + plotH + 16}" text-anchor="middle" font-size="11" fill="#727272" font-family="${SVG_TEXT_FONT}">${xmlEscape(formatTick(xv, opts.data.xKind))}</text>`
      )
      parts.push(
        `<text x="${padL - 8}" y="${sy(yv) + 4}" text-anchor="end" font-size="11" fill="#727272" font-family="${SVG_TEXT_FONT}">${xmlEscape(formatTick(yv, 'number'))}</text>`
      )
    }
  }

  if (opts.title) {
    parts.push(
      `<text x="${width / 2}" y="24" text-anchor="middle" font-size="16" font-weight="600" fill="#303133" font-family="${SVG_TEXT_FONT}">${xmlEscape(opts.title)}</text>`
    )
  }
  if (opts.xLabel) {
    parts.push(
      `<text x="${padL + plotW / 2}" y="${height - 12}" text-anchor="middle" font-size="12" fill="#727272" font-family="${SVG_TEXT_FONT}">${xmlEscape(opts.xLabel)}</text>`
    )
  }
  if (opts.yLabel) {
    parts.push(
      `<text transform="translate(16 ${padT + plotH / 2}) rotate(-90)" text-anchor="middle" font-size="12" fill="#727272" font-family="${SVG_TEXT_FONT}">${xmlEscape(opts.yLabel)}</text>`
    )
  }

  if (isBox && opts.data.boxes) {
    parts.push(boxPlotSvgMarkup(opts.data.boxes, opts.styles, { x: sx, y: sy }))
  } else {
  const nSeries = Math.max(1, opts.data.ys.length)
  const dx = minPositiveDx(xs)
  const span = xMax - xMin
  const gap = opts.kind === 'hist' ? 1 : 0.8
  const groupW = Number.isFinite(dx) ? (dx / span) * plotW * gap : plotW / Math.max(xs.length, 1) * 0.6
  const barW = Math.max(2, groupW / nSeries)
  const baseline = yMin <= 0 && yMax >= 0 ? sy(0) : padT + plotH

  opts.data.ys.forEach((ys, seriesIndex) => {
    const style = opts.styles[seriesIndex] ?? {
      label: `s${seriesIndex}`,
      color: '#5280C1',
      width: 1.5
    }
    if (opts.kind === 'scatter') {
      const r = Math.max(2.5, style.width * 1.6)
      for (let i = 0; i < xs.length; i++) {
        const x = xs[i]
        const y = ys[i]
        if (!Number.isFinite(x) || y == null || !Number.isFinite(y)) {
          continue
        }
        parts.push(`<circle cx="${sx(x).toFixed(2)}" cy="${sy(y).toFixed(2)}" r="${r}" fill="${xmlEscape(style.color)}"/>`)
      }
      return
    }
    if (opts.kind === 'bar' || opts.kind === 'hist') {
      for (let i = 0; i < xs.length; i++) {
        const x = xs[i]
        const y = ys[i]
        if (!Number.isFinite(x) || y == null || !Number.isFinite(y)) {
          continue
        }
        const left = sx(x) - groupW / 2 + seriesIndex * barW
        const top = sy(y)
        const yRect = Math.min(baseline, top)
        const h = Math.max(1, Math.abs(baseline - top))
        parts.push(
          `<rect x="${left.toFixed(2)}" y="${yRect.toFixed(2)}" width="${Math.max(1, barW - 1).toFixed(2)}" height="${h.toFixed(2)}" fill="${xmlEscape(style.color)}"/>`
        )
      }
      return
    }
    const segments: string[] = []
    let d = ''
    let start = true
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i]
      const y = ys[i]
      if (!Number.isFinite(x) || y == null || !Number.isFinite(y)) {
        if (d) {
          segments.push(d.trim())
          d = ''
          start = true
        }
        continue
      }
      d += `${start ? 'M' : 'L'}${sx(x).toFixed(2)} ${sy(y).toFixed(2)} `
      start = false
    }
    if (d) {
      segments.push(d.trim())
    }
    for (const path of segments) {
      parts.push(
        `<path d="${path}" fill="none" stroke="${xmlEscape(style.color)}" stroke-width="${style.width}" stroke-linejoin="round" stroke-linecap="round"/>`
      )
    }
  })
  }

  if (opts.legend) {
    let ly = padT + 4
    const lx = padL + plotW + 12
    for (const style of opts.styles) {
      parts.push(`<rect x="${lx}" y="${ly}" width="12" height="12" fill="${xmlEscape(style.color)}"/>`)
      parts.push(
        `<text x="${lx + 16}" y="${ly + 11}" font-size="12" fill="#303133" font-family="${SVG_TEXT_FONT}">${xmlEscape(style.label)}</text>`
      )
      ly += 18
    }
  }

  const annotations = opts.annotations ?? []
  if (annotations.length > 0) {
    parts.push(
      annotationSvgMarkup(annotations, {
        x: sx,
        y: sy,
        plotLeft: padL,
        plotTop: padT,
        plotWidth: plotW,
        plotHeight: plotH
      })
    )
  }

  return { width, height, inner: parts.join('\n') }
}

export function seriesToSvg(opts: SvgExportOptions): string {
  const { width, height, inner } = seriesSvgInner(opts)
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    inner,
    '</svg>'
  ].join('\n')
}

export function figureToSvg(opts: FigureSvgOptions): string {
  const rows = Math.max(1, opts.rows)
  const cols = Math.max(1, opts.cols)
  const gap = opts.gap ?? 10
  const cellW = opts.panelWidth ?? 640
  const cellH = opts.panelHeight ?? 360
  const titleH = opts.title ? 40 : 8
  const width = gap + cols * (cellW + gap)
  const height = titleH + rows * (cellH + gap)
  const parts: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="#ffffff"/>`
  ]
  if (opts.title) {
    parts.push(
      `<text x="${width / 2}" y="28" text-anchor="middle" font-size="16" font-weight="600" fill="#303133" font-family="${SVG_TEXT_FONT}">${xmlEscape(opts.title)}</text>`
    )
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = gap + c * (cellW + gap)
      const y = titleH + r * (cellH + gap)
      const panel = opts.panels[r * cols + c] ?? null
      parts.push(
        `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" fill="#ffffff" stroke="#ebeef5"/>`
      )
      if (panel) {
        const nested = seriesSvgInner({ ...panel, width: cellW, height: cellH })
        parts.push(
          `<svg x="${x}" y="${y}" width="${cellW}" height="${cellH}" viewBox="0 0 ${cellW} ${cellH}">`
        )
        parts.push(nested.inner)
        parts.push('</svg>')
      }
    }
  }
  parts.push('</svg>')
  return parts.join('\n')
}
