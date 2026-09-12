import uPlot from 'uplot'
import type { AlignedData, Options } from 'uplot'
import { boxYExtent, drawBoxPlots } from './boxPlot'
import type { ChartBoxSample } from './boxPlot'
import { dataXFromScale, rangesNearlyEqual } from './viewport'
import type { ViewportWindow } from './viewport'

export type PlotKind = 'line' | 'scatter' | 'bar' | 'hist' | 'box'

export type SeriesStyle = {
  label: string
  color: string
  width: number
}

export type PlotSeriesData = {
  x: number[]
  ys: Array<Array<number | null>>
  xKind: 'number' | 'time'
  boxes?: ChartBoxSample[]
}

export type PlotRenderOptions = {
  title?: string
  xLabel?: string
  yLabel?: string
  legend: boolean
  grid: boolean
  kind: PlotKind
  styles: SeriesStyle[]
  data: PlotSeriesData
  width: number
  height: number
  onXRange?: (range: ViewportWindow) => void
  onFrame?: () => void
}

function finiteOutliers(sample: ChartBoxSample): number[] {
  return sample.outliers.filter((value) => Number.isFinite(value))
}

function alignedBox(boxes: ChartBoxSample[], styleCount: number): AlignedData {
  const n = boxes.length
  const width = Math.max(n, 1)
  const xs = n ? boxes.map((_, index) => index) : [0]
  const mins = n
    ? boxes.map((sample) => Math.min(sample.whiskerLow, sample.q1, ...finiteOutliers(sample)))
    : [0]
  const maxs = n
    ? boxes.map((sample) => Math.max(sample.whiskerHigh, sample.q3, ...finiteOutliers(sample)))
    : [1]
  const rows: Array<Array<number | null>> = []
  const count = Math.max(styleCount, 1)
  for (let i = 0; i < count; i++) {
    const row: Array<number | null> = Array.from({ length: width }, () => null)
    if (boxes[i]) {
      row[i] = boxes[i].median
    }
    rows.push(row)
  }
  return [xs, mins, maxs, ...rows]
}

function alignedFrom(data: PlotSeriesData, kind: PlotKind, styleCount = 0): AlignedData {
  if (kind === 'box') {
    return alignedBox(data.boxes ?? [], styleCount)
  }
  const xs = data.xKind === 'time' ? data.x.map((value) => value / 1000) : data.x
  return [xs, ...data.ys]
}

function seriesOpts(kind: PlotKind, styles: SeriesStyle[]): Options['series'] {
  if (kind === 'box') {
    const series: Options['series'] = [
      {},
      { show: false },
      { show: false }
    ]
    for (const style of styles) {
      series.push({
        label: style.label,
        stroke: style.color,
        width: style.width,
        paths: () => null,
        points: { show: false }
      })
    }
    if (styles.length === 0) {
      series.push({ show: false, paths: () => null })
    }
    return series
  }
  const series: Options['series'] = [{}]
  for (const style of styles) {
    if (kind === 'scatter') {
      series.push({
        label: style.label,
        stroke: style.color,
        width: style.width,
        paths: () => null,
        points: { show: true, size: Math.max(6, style.width * 4), fill: style.color }
      })
      continue
    }
    if (kind === 'bar' || kind === 'hist') {
      const bars = uPlot.paths.bars?.({ size: kind === 'hist' ? [1, 1000] : [0.6, 100] })
      series.push({
        label: style.label,
        stroke: style.color,
        fill: style.color,
        width: style.width,
        paths: bars
      })
      continue
    }
    series.push({
      label: style.label,
      stroke: style.color,
      width: style.width,
      points: { show: false }
    })
  }
  return series
}

export type OverlayRect = {
  left: number
  top: number
  width: number
  height: number
}

export class UPlotChart {
  private plot: uPlot | null = null
  private aligned: AlignedData | null = null
  private xKind: PlotSeriesData['xKind'] = 'number'
  private kind: PlotKind = 'line'
  private styles: SeriesStyle[] = []
  private boxes: ChartBoxSample[] = []
  private onXRange: ((range: ViewportWindow) => void) | undefined
  private onFrame: (() => void) | undefined
  private lastEmitted: ViewportWindow | null = null
  private xScaleIgnore = 0
  private xScaleQuietUntil = 0

  constructor(private readonly el: HTMLElement) {}

  render(opts: PlotRenderOptions): void {
    this.destroy()
    this.xKind = opts.data.xKind
    this.kind = opts.kind
    this.styles = opts.styles
    this.boxes = opts.data.boxes ?? []
    this.onXRange = opts.kind === 'box' ? undefined : opts.onXRange
    this.onFrame = opts.onFrame
    this.quietXScale(3, 200)
    const width = Math.max(40, Math.floor(opts.width))
    const height = Math.max(40, Math.floor(opts.height))
    this.aligned = alignedFrom(opts.data, opts.kind, opts.styles.length)
    const isBox = opts.kind === 'box'
    const boxCount = this.boxes.length
    const yExtent = isBox ? boxYExtent(this.boxes) : null
    const options: Options = {
      title: opts.title || undefined,
      width,
      height,
      legend: { show: opts.legend },
      cursor: { drag: { x: true, y: true } },
      scales: {
        x: isBox
          ? { time: false, range: () => [-0.5, Math.max(boxCount - 0.5, 0.5)] }
          : { time: opts.data.xKind === 'time' }
      },
      axes: [
        {
          label: opts.xLabel || undefined,
          stroke: '#727272',
          grid: { show: opts.grid, stroke: '#ebeef5' },
          ...(isBox
            ? {
                splits: () => this.boxes.map((_, index) => index),
                values: (_u: uPlot, splits: number[]) =>
                  splits.map((index) => this.boxes[index]?.key ?? '')
              }
            : {})
        },
        {
          label: opts.yLabel || undefined,
          stroke: '#727272',
          grid: { show: opts.grid, stroke: '#ebeef5' }
        }
      ],
      series: seriesOpts(opts.kind, opts.styles),
      hooks: {
        draw: isBox
          ? [
              (u) => {
                const ctx = u.ctx
                drawBoxPlots(ctx, this.boxes, this.styles, {
                  x: (value) => u.valToPos(value, 'x', true),
                  y: (value) => u.valToPos(value, 'y', true)
                })
              }
            ]
          : [],
        setScale: [
          (u, key) => {
            this.emitXRange(u, key)
            this.onFrame?.()
          }
        ],
        setSize: [
          () => {
            this.onFrame?.()
          }
        ]
      }
    }
    if (yExtent && Number.isFinite(yExtent.yMin)) {
      const pad = Math.max((yExtent.yMax - yExtent.yMin) * 0.08, 1e-9)
      options.scales = {
        ...options.scales,
        y: { range: () => [yExtent.yMin - pad, yExtent.yMax + pad] }
      }
    }
    this.plot = new uPlot(options, this.aligned, this.el)
    this.onFrame?.()
  }

  setData(data: PlotSeriesData, resetScales = false): void {
    if (!this.plot) {
      return
    }
    this.xKind = data.xKind
    this.boxes = data.boxes ?? this.boxes
    this.aligned = alignedFrom(data, this.kind, this.styles.length)
    this.quietXScale(1, 80)
    this.plot.setData(this.aligned, resetScales)
    this.onFrame?.()
  }

  setSize(width: number, height: number): void {
    if (!this.plot) {
      return
    }
    this.quietXScale(1, 80)
    this.plot.setSize({
      width: Math.max(40, Math.floor(width)),
      height: Math.max(40, Math.floor(height))
    })
    this.onFrame?.()
  }

  resetView(): void {
    if (!this.plot || !this.aligned) {
      return
    }
    this.quietXScale(1, 80)
    this.plot.setData(this.aligned, true)
    this.onFrame?.()
  }

  xRange(): ViewportWindow | null {
    const min = this.plot?.scales.x.min
    const max = this.plot?.scales.x.max
    if (min == null || max == null || !(max > min)) {
      return null
    }
    return dataXFromScale(min, max, this.xKind)
  }

  canvas(): HTMLCanvasElement | null {
    return this.plot?.root.querySelector('canvas') ?? null
  }

  overlayRect(relativeTo: HTMLElement): OverlayRect | null {
    const over = this.plot?.root.querySelector('.u-over') as HTMLElement | null
    if (!over) {
      return null
    }
    const host = relativeTo.getBoundingClientRect()
    const box = over.getBoundingClientRect()
    return {
      left: box.left - host.left,
      top: box.top - host.top,
      width: box.width,
      height: box.height
    }
  }

  overlayToData(px: number, py: number): { x: number; y: number } | null {
    const u = this.plot
    if (!u) {
      return null
    }
    let x = u.posToVal(px, 'x')
    const y = u.posToVal(py, 'y')
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null
    }
    if (this.xKind === 'time') {
      x *= 1000
    }
    return { x, y }
  }

  dataToOverlay(x: number, y: number): { x: number; y: number } | null {
    const u = this.plot
    if (!u) {
      return null
    }
    const xv = this.xKind === 'time' ? x / 1000 : x
    const px = u.valToPos(xv, 'x')
    const py = u.valToPos(y, 'y')
    if (!Number.isFinite(px) || !Number.isFinite(py)) {
      return null
    }
    return { x: px, y: py }
  }

  canvasScale(): {
    x: (value: number) => number
    y: (value: number) => number
    plotLeft: number
    plotTop: number
    plotWidth: number
    plotHeight: number
  } | null {
    const u = this.plot
    if (!u) {
      return null
    }
    const box = u.bbox
    return {
      x: (value) => u.valToPos(this.xKind === 'time' ? value / 1000 : value, 'x', true),
      y: (value) => u.valToPos(value, 'y', true),
      plotLeft: box.left,
      plotTop: box.top,
      plotWidth: box.width,
      plotHeight: box.height
    }
  }

  destroy(): void {
    this.plot?.destroy()
    this.plot = null
    this.aligned = null
    this.kind = 'line'
    this.styles = []
    this.boxes = []
    this.onXRange = undefined
    this.onFrame = undefined
    this.lastEmitted = null
    this.xScaleIgnore = 0
    this.xScaleQuietUntil = 0
  }

  private quietXScale(ignoreCount: number, ms: number): void {
    this.xScaleIgnore += ignoreCount
    this.xScaleQuietUntil = Math.max(this.xScaleQuietUntil, Date.now() + ms)
  }

  private emitXRange(u: uPlot, key: string): void {
    if (key !== 'x') {
      return
    }
    if (this.xScaleIgnore > 0) {
      this.xScaleIgnore -= 1
      return
    }
    if (Date.now() < this.xScaleQuietUntil) {
      return
    }
    const min = u.scales.x.min
    const max = u.scales.x.max
    if (min == null || max == null || !(max > min)) {
      return
    }
    const range = dataXFromScale(min, max, this.xKind)
    const span = Math.abs(range.xMax - range.xMin)
    if (this.lastEmitted && rangesNearlyEqual(range, this.lastEmitted, span)) {
      return
    }
    this.lastEmitted = range
    this.onXRange?.(range)
  }
}
