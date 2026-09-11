import uPlot from 'uplot'
import type { AlignedData, Options } from 'uplot'
import { dataXFromScale, rangesNearlyEqual } from './viewport'
import type { ViewportWindow } from './viewport'

export type PlotKind = 'line' | 'scatter' | 'bar' | 'hist'

export type SeriesStyle = {
  label: string
  color: string
  width: number
}

export type PlotSeriesData = {
  x: number[]
  ys: Array<Array<number | null>>
  xKind: 'number' | 'time'
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

function alignedFrom(data: PlotSeriesData): AlignedData {
  const xs =
    data.xKind === 'time' ? data.x.map((value) => value / 1000) : data.x
  return [xs, ...data.ys]
}

function seriesOpts(kind: PlotKind, styles: SeriesStyle[]): Options['series'] {
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
  private onXRange: ((range: ViewportWindow) => void) | undefined
  private onFrame: (() => void) | undefined
  private lastEmitted: ViewportWindow | null = null
  private xScaleIgnore = 0
  private xScaleQuietUntil = 0

  constructor(private readonly el: HTMLElement) {}

  render(opts: PlotRenderOptions): void {
    this.destroy()
    this.xKind = opts.data.xKind
    this.onXRange = opts.onXRange
    this.onFrame = opts.onFrame
    this.quietXScale(3, 200)
    const width = Math.max(40, Math.floor(opts.width))
    const height = Math.max(40, Math.floor(opts.height))
    this.aligned = alignedFrom(opts.data)
    const options: Options = {
      title: opts.title || undefined,
      width,
      height,
      legend: { show: opts.legend },
      cursor: { drag: { x: true, y: true } },
      scales: {
        x: { time: opts.data.xKind === 'time' }
      },
      axes: [
        {
          label: opts.xLabel || undefined,
          stroke: '#727272',
          grid: { show: opts.grid, stroke: '#ebeef5' }
        },
        {
          label: opts.yLabel || undefined,
          stroke: '#727272',
          grid: { show: opts.grid, stroke: '#ebeef5' }
        }
      ],
      series: seriesOpts(opts.kind, opts.styles),
      hooks: {
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
    this.plot = new uPlot(options, this.aligned, this.el)
    this.onFrame?.()
  }

  setData(data: PlotSeriesData, resetScales = false): void {
    if (!this.plot) {
      return
    }
    this.xKind = data.xKind
    this.aligned = alignedFrom(data)
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
