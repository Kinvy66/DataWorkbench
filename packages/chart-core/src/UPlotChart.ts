import uPlot from 'uplot'
import type { AlignedData, Options } from 'uplot'

export type PlotKind = 'line' | 'scatter' | 'bar'

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
    if (kind === 'bar') {
      const bars = uPlot.paths.bars?.({ size: [0.6, 100] })
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

export class UPlotChart {
  private plot: uPlot | null = null
  private aligned: AlignedData | null = null

  constructor(private readonly el: HTMLElement) {}

  render(opts: PlotRenderOptions): void {
    this.destroy()
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
      series: seriesOpts(opts.kind, opts.styles)
    }
    this.plot = new uPlot(options, this.aligned, this.el)
  }

  setSize(width: number, height: number): void {
    this.plot?.setSize({
      width: Math.max(40, Math.floor(width)),
      height: Math.max(40, Math.floor(height))
    })
  }

  resetView(): void {
    if (!this.plot || !this.aligned) {
      return
    }
    this.plot.setData(this.aligned, true)
  }

  canvas(): HTMLCanvasElement | null {
    return this.plot?.root.querySelector('canvas') ?? null
  }

  destroy(): void {
    this.plot?.destroy()
    this.plot = null
    this.aligned = null
  }
}
