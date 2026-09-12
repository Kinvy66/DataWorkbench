import type { SeriesStyle } from './UPlotChart'
import { xmlEscape } from './svgText'

export type ChartBoxSample = {
  key: string
  n: number
  q1: number
  median: number
  q3: number
  whiskerLow: number
  whiskerHigh: number
  outliers: number[]
}

export type BoxScale = {
  x: (value: number) => number
  y: (value: number) => number
}

export function boxMin(sample: ChartBoxSample): number {
  let lo = Math.min(sample.whiskerLow, sample.q1, sample.median)
  for (const value of sample.outliers) {
    if (Number.isFinite(value)) {
      lo = Math.min(lo, value)
    }
  }
  return lo
}

export function boxMax(sample: ChartBoxSample): number {
  let hi = Math.max(sample.whiskerHigh, sample.q3, sample.median)
  for (const value of sample.outliers) {
    if (Number.isFinite(value)) {
      hi = Math.max(hi, value)
    }
  }
  return hi
}

export function boxYExtent(boxes: ChartBoxSample[]): { yMin: number; yMax: number } {
  let yMin = Infinity
  let yMax = -Infinity
  for (const sample of boxes) {
    yMin = Math.min(yMin, boxMin(sample))
    yMax = Math.max(yMax, boxMax(sample))
  }
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
    return { yMin: 0, yMax: 1 }
  }
  if (yMin === yMax) {
    return { yMin: yMin - 1, yMax: yMax + 1 }
  }
  return { yMin, yMax }
}

export function boxBodyWidth(count: number): number {
  return Math.min(0.55, 0.8 / Math.max(count, 1))
}

function styleAt(styles: SeriesStyle[], index: number): SeriesStyle {
  return (
    styles[index] ?? {
      label: `s${index}`,
      color: '#5280C1',
      width: 1.5
    }
  )
}

export function drawBoxPlots(
  ctx: CanvasRenderingContext2D,
  boxes: ChartBoxSample[],
  styles: SeriesStyle[],
  scale: BoxScale
): void {
  const half = boxBodyWidth(boxes.length) / 2
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  boxes.forEach((sample, index) => {
    const style = styleAt(styles, index)
    const cx = scale.x(index)
    const left = scale.x(index - half)
    const right = scale.x(index + half)
    const width = Math.max(2, right - left)
    const yHigh = scale.y(sample.whiskerHigh)
    const yLow = scale.y(sample.whiskerLow)
    const yQ3 = scale.y(sample.q3)
    const yQ1 = scale.y(sample.q1)
    const yMed = scale.y(sample.median)
    const cap = Math.max(4, width * 0.35)
    ctx.strokeStyle = style.color
    ctx.fillStyle = style.color
    ctx.lineWidth = Math.max(1.25, style.width)
    ctx.beginPath()
    ctx.moveTo(cx, yHigh)
    ctx.lineTo(cx, yQ3)
    ctx.moveTo(cx, yLow)
    ctx.lineTo(cx, yQ1)
    ctx.moveTo(cx - cap / 2, yHigh)
    ctx.lineTo(cx + cap / 2, yHigh)
    ctx.moveTo(cx - cap / 2, yLow)
    ctx.lineTo(cx + cap / 2, yLow)
    ctx.stroke()
    const top = Math.min(yQ1, yQ3)
    const height = Math.max(1, Math.abs(yQ3 - yQ1))
    ctx.globalAlpha = 0.18
    ctx.fillRect(left, top, width, height)
    ctx.globalAlpha = 1
    ctx.strokeRect(left, top, width, height)
    ctx.beginPath()
    ctx.moveTo(left, yMed)
    ctx.lineTo(right, yMed)
    ctx.stroke()
    const r = Math.max(2.2, style.width * 1.4)
    for (const value of sample.outliers) {
      if (!Number.isFinite(value)) {
        continue
      }
      ctx.beginPath()
      ctx.arc(cx, scale.y(value), r, 0, Math.PI * 2)
      ctx.fill()
    }
  })
  ctx.restore()
}

export function boxPlotSvgMarkup(
  boxes: ChartBoxSample[],
  styles: SeriesStyle[],
  scale: BoxScale
): string {
  const half = boxBodyWidth(boxes.length) / 2
  const parts: string[] = []
  boxes.forEach((sample, index) => {
    const style = styleAt(styles, index)
    const color = xmlEscape(style.color)
    const stroke = Math.max(1.25, style.width)
    const cx = scale.x(index)
    const left = scale.x(index - half)
    const right = scale.x(index + half)
    const width = Math.max(2, right - left)
    const yHigh = scale.y(sample.whiskerHigh)
    const yLow = scale.y(sample.whiskerLow)
    const yQ3 = scale.y(sample.q3)
    const yQ1 = scale.y(sample.q1)
    const yMed = scale.y(sample.median)
    const cap = Math.max(4, width * 0.35)
    const top = Math.min(yQ1, yQ3)
    const height = Math.max(1, Math.abs(yQ3 - yQ1))
    parts.push(
      `<line x1="${cx.toFixed(2)}" y1="${yHigh.toFixed(2)}" x2="${cx.toFixed(2)}" y2="${yQ3.toFixed(2)}" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"/>`
    )
    parts.push(
      `<line x1="${cx.toFixed(2)}" y1="${yLow.toFixed(2)}" x2="${cx.toFixed(2)}" y2="${yQ1.toFixed(2)}" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"/>`
    )
    parts.push(
      `<line x1="${(cx - cap / 2).toFixed(2)}" y1="${yHigh.toFixed(2)}" x2="${(cx + cap / 2).toFixed(2)}" y2="${yHigh.toFixed(2)}" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"/>`
    )
    parts.push(
      `<line x1="${(cx - cap / 2).toFixed(2)}" y1="${yLow.toFixed(2)}" x2="${(cx + cap / 2).toFixed(2)}" y2="${yLow.toFixed(2)}" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"/>`
    )
    parts.push(
      `<rect x="${left.toFixed(2)}" y="${top.toFixed(2)}" width="${width.toFixed(2)}" height="${height.toFixed(2)}" fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-width="${stroke}"/>`
    )
    parts.push(
      `<line x1="${left.toFixed(2)}" y1="${yMed.toFixed(2)}" x2="${right.toFixed(2)}" y2="${yMed.toFixed(2)}" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"/>`
    )
    const r = Math.max(2.2, style.width * 1.4)
    for (const value of sample.outliers) {
      if (!Number.isFinite(value)) {
        continue
      }
      parts.push(
        `<circle cx="${cx.toFixed(2)}" cy="${scale.y(value).toFixed(2)}" r="${r}" fill="${color}"/>`
      )
    }
  })
  return parts.join('\n')
}
