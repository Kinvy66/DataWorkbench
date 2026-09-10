import { defineStore } from 'pinia'
import { nextTick } from 'vue'
import {
  CHART_HIST_BINS_DEFAULT,
  CHART_MAX_POINTS_DEFAULT,
  type ChartBuildSeriesResult,
  type ChartTypeId
} from '@dw/rpc-types'
import {
  canvasToPngDataUrl,
  seriesColor,
  seriesToSvg,
  suggestedExportName
} from '@dw/chart-core'
import { getDesktopBridge } from '@/rpc/bridge'
import { isCancelled } from '@/rpc/rpcError'
import { useDataStore } from './data'
import { useWorkflowStore } from './workflow'

export type BindableChartType = ChartTypeId

export type ChartSeriesStyle = {
  key: string
  color: string
  width: number
}

export type ChartSpec = {
  id: string
  type: BindableChartType
  dataId: string
  x: string
  y: string[]
  title: string
  xLabel: string
  yLabel: string
  grid: boolean
  legend: boolean
  series: ChartSeriesStyle[]
  data: ChartBuildSeriesResult | null
}

let canvasProvider: (() => HTMLCanvasElement | null) | null = null

function rpc() {
  return getDesktopBridge().rpc
}

function throwExportMissing(): never {
  const err = new Error('Plot a chart before exporting. [@@chart.exportMissing]')
  ;(err as Error & { i18nKey: string }).i18nKey = 'chart.exportMissing'
  throw err
}

function afterPaint(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      return
    }
    resolve()
  })
}

async function waitForCanvas(
  getCanvas: () => HTMLCanvasElement | null,
  tries = 20
): Promise<HTMLCanvasElement | null> {
  const first = getCanvas()
  if (first && first.width > 0 && first.height > 0) {
    return first
  }
  if (typeof requestAnimationFrame !== 'function') {
    return first
  }
  for (let i = 0; i < tries; i++) {
    await afterPaint()
    const canvas = getCanvas()
    if (canvas && canvas.width > 0 && canvas.height > 0) {
      return canvas
    }
  }
  return getCanvas()
}

export const useChartStore = defineStore('chart', {
  state: () => ({
    charts: [] as ChartSpec[],
    currentId: null as string | null,
    bindDialogOpen: false,
    pendingType: 'line' as BindableChartType
  }),
  getters: {
    current(state): ChartSpec | null {
      return state.charts.find((item) => item.id === state.currentId) ?? null
    }
  },
  actions: {
    setCanvasProvider(provider: (() => HTMLCanvasElement | null) | null): void {
      canvasProvider = provider
    },
    openBindDialog(type: BindableChartType): void {
      this.pendingType = type
      this.bindDialogOpen = true
    },
    prune(existingIds: string[]): void {
      const keep = new Set(existingIds)
      this.charts = this.charts.filter((item) => keep.has(item.dataId))
      if (this.currentId && !this.charts.some((item) => item.id === this.currentId)) {
        this.currentId = this.charts[0]?.id ?? null
      }
    },
    select(id: string): void {
      if (this.charts.some((item) => item.id === id)) {
        this.currentId = id
      }
    },
    remove(id: string): void {
      this.charts = this.charts.filter((item) => item.id !== id)
      if (this.currentId === id) {
        this.currentId = this.charts[0]?.id ?? null
      }
    },
    updateStyle(
      id: string,
      patch: Partial<Pick<ChartSpec, 'title' | 'xLabel' | 'yLabel' | 'grid' | 'legend'>>
    ): void {
      const chart = this.charts.find((item) => item.id === id)
      if (!chart) {
        return
      }
      Object.assign(chart, patch)
    },
    updateSeries(id: string, key: string, patch: Partial<ChartSeriesStyle>): void {
      const chart = this.charts.find((item) => item.id === id)
      const series = chart?.series.find((item) => item.key === key)
      if (!series) {
        return
      }
      Object.assign(series, patch)
    },
    async createFromBind(options: {
      type: BindableChartType
      dataId: string
      x?: string
      y: string[]
      title?: string
      yLabel?: string
    }): Promise<ChartSpec> {
      const data = useDataStore()
      const workflow = useWorkflowStore()
      const isHist = options.type === 'hist'
      const result = (await rpc().invoke(
        'chart.buildSeries',
        isHist
          ? {
              dataId: options.dataId,
              y: options.y,
              kind: 'hist',
              bins: CHART_HIST_BINS_DEFAULT
            }
          : {
              dataId: options.dataId,
              x: options.x,
              y: options.y,
              maxPoints: CHART_MAX_POINTS_DEFAULT
            }
      )) as ChartBuildSeriesResult
      const datasetName = data.datasets.find((item) => item.id === options.dataId)?.name ?? 'chart'
      const id = crypto.randomUUID()
      const xName = isHist ? (options.y[0] ?? '') : (options.x ?? '')
      const spec: ChartSpec = {
        id,
        type: options.type,
        dataId: options.dataId,
        x: xName,
        y: options.y,
        title: options.title?.trim() || `${datasetName} — ${options.type}`,
        xLabel: xName,
        yLabel: options.yLabel ?? (isHist ? 'Count' : options.y.join(', ')),
        grid: true,
        legend: true,
        series: options.y.map((key, index) => ({
          key,
          color: seriesColor(index),
          width: 1.5
        })),
        data: result
      }
      this.charts.push(spec)
      this.currentId = id
      workflow.centerTab = 'figure'
      return spec
    },
    async saveExport(format: 'png' | 'svg'): Promise<boolean> {
      const current = this.current
      if (!current?.data) {
        throwExportMissing()
      }
      const workflow = useWorkflowStore()
      workflow.centerTab = 'figure'
      let content: string
      if (format === 'svg') {
        content = seriesToSvg({
          kind: current.type,
          title: current.title,
          xLabel: current.xLabel,
          yLabel: current.yLabel,
          legend: current.legend,
          grid: current.grid,
          styles: current.series.map((item) => ({
            label: item.key,
            color: item.color,
            width: item.width
          })),
          data: {
            x: current.data.x.map((value) => (value == null ? Number.NaN : value)),
            ys: current.data.ys,
            xKind: current.data.xKind
          }
        })
      } else {
        await nextTick()
        const canvas = await waitForCanvas(() => canvasProvider?.() ?? null)
        if (!canvas || canvas.width < 1 || canvas.height < 1) {
          throwExportMissing()
        }
        content = canvasToPngDataUrl(canvas)
      }
      const result = await rpc().invoke('chart.saveExport', {
        format,
        suggestedName: suggestedExportName(current.title, format),
        content
      })
      return !isCancelled(result)
    }
  }
})
