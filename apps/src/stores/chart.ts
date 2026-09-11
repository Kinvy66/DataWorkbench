import { defineStore } from 'pinia'
import { nextTick } from 'vue'
import {
  CHART_HIST_BINS_DEFAULT,
  CHART_MAX_POINTS_DEFAULT,
  type ChartBuildSeriesParams,
  type ChartBuildSeriesResult,
  type ChartTypeId,
  type ProjectChartsFile
} from '@dw/rpc-types'
import {
  ANNOTATION_COLOR,
  canvasToPngDataUrl,
  parseChartAnnotations,
  seriesColor,
  seriesToSvg,
  suggestedExportName,
  type ChartAnnotation,
  type ChartAnnotationKind,
  type ViewportWindow
} from '@dw/chart-core'
import { getDesktopBridge } from '@/rpc/bridge'
import { isCancelled } from '@/rpc/rpcError'
import { useDataStore } from './data'
import { touchProject } from './project'
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
  annotations: ChartAnnotation[]
  data: ChartBuildSeriesResult | null
  window: ViewportWindow | null
}

let canvasProvider: (() => HTMLCanvasElement | null) | null = null
let pngCapture: (() => string | null) | null = null
const rebuildSeq = new Map<string, number>()

function rpc() {
  return getDesktopBridge().rpc
}

function nextRebuildSeq(id: string): number {
  const token = (rebuildSeq.get(id) ?? 0) + 1
  rebuildSeq.set(id, token)
  return token
}

function isCurrentRebuild(id: string, token: number): boolean {
  return rebuildSeq.get(id) === token
}

function seriesParams(
  chart: Pick<ChartSpec, 'type' | 'dataId' | 'x' | 'y'>,
  range?: ViewportWindow
): ChartBuildSeriesParams {
  const isHist = chart.type === 'hist'
  const params: ChartBuildSeriesParams = isHist
    ? {
        dataId: chart.dataId,
        y: chart.y,
        kind: 'hist',
        bins: CHART_HIST_BINS_DEFAULT
      }
    : {
        dataId: chart.dataId,
        x: chart.x,
        y: chart.y,
        maxPoints: CHART_MAX_POINTS_DEFAULT
      }
  if (range) {
    params.xMin = range.xMin
    params.xMax = range.xMax
  }
  return params
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
    pendingType: 'line' as BindableChartType,
    placeKind: null as ChartAnnotationKind | null,
    placeAnchor: null as { x: number; y: number } | null,
    selectedAnnotationId: null as string | null
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
    setPngCapture(provider: (() => string | null) | null): void {
      pngCapture = provider
    },
    openBindDialog(type: BindableChartType): void {
      this.pendingType = type
      this.bindDialogOpen = true
    },
    prune(existingIds: string[]): void {
      const keep = new Set(existingIds)
      for (const item of this.charts) {
        if (!keep.has(item.dataId)) {
          rebuildSeq.delete(item.id)
        }
      }
      this.charts = this.charts.filter((item) => keep.has(item.dataId))
      if (this.currentId && !this.charts.some((item) => item.id === this.currentId)) {
        this.currentId = this.charts[0]?.id ?? null
      }
    },
    clear(): void {
      this.charts = []
      this.currentId = null
      this.cancelPlace()
      this.selectedAnnotationId = null
      rebuildSeq.clear()
    },
    async restoreFromFile(file: ProjectChartsFile): Promise<void> {
      this.cancelPlace()
      this.selectedAnnotationId = null
      this.charts = []
      this.currentId = null
      for (const spec of file.charts) {
        let data: ChartBuildSeriesResult | null = null
        try {
          data = (await rpc().invoke('chart.buildSeries', seriesParams(spec))) as ChartBuildSeriesResult
        } catch {
          data = null
        }
        this.charts.push({
          id: spec.id,
          type: spec.type,
          dataId: spec.dataId,
          x: spec.x,
          y: spec.y,
          title: spec.title,
          xLabel: spec.xLabel,
          yLabel: spec.yLabel,
          grid: spec.grid,
          legend: spec.legend,
          series: spec.series.map((item) => ({ ...item })),
          annotations: parseChartAnnotations(spec.annotations),
          data,
          window: null
        })
      }
      this.currentId =
        file.currentId && this.charts.some((item) => item.id === file.currentId)
          ? file.currentId
          : (this.charts[0]?.id ?? null)
    },
    select(id: string): void {
      if (!this.charts.some((item) => item.id === id)) {
        return
      }
      if (this.currentId !== id) {
        this.cancelPlace()
        this.selectedAnnotationId = null
      }
      this.currentId = id
    },
    remove(id: string): void {
      rebuildSeq.delete(id)
      this.charts = this.charts.filter((item) => item.id !== id)
      if (this.currentId === id) {
        this.currentId = this.charts[0]?.id ?? null
      }
      touchProject()
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
      touchProject()
    },
    updateSeries(id: string, key: string, patch: Partial<ChartSeriesStyle>): void {
      const chart = this.charts.find((item) => item.id === id)
      const series = chart?.series.find((item) => item.key === key)
      if (!series) {
        return
      }
      Object.assign(series, patch)
      touchProject()
    },
    togglePlace(kind: ChartAnnotationKind): void {
      if (!this.currentId) {
        return
      }
      useWorkflowStore().centerTab = 'figure'
      if (this.placeKind === kind) {
        this.cancelPlace()
        return
      }
      this.placeKind = kind
      this.placeAnchor = null
    },
    cancelPlace(): void {
      this.placeKind = null
      this.placeAnchor = null
    },
    placeAt(point: { x: number; y: number }): boolean {
      const chart = this.current
      const kind = this.placeKind
      if (!chart || !kind) {
        return false
      }
      if (kind === 'arrow' || kind === 'region') {
        if (!this.placeAnchor) {
          this.placeAnchor = point
          return false
        }
      }
      const start = this.placeAnchor ?? point
      const annotation: ChartAnnotation = {
        id: crypto.randomUUID(),
        kind,
        color: ANNOTATION_COLOR,
        text: kind === 'text' ? 'Note' : '',
        x: start.x,
        y: start.y,
        x2: point.x,
        y2: point.y
      }
      chart.annotations.push(annotation)
      this.selectedAnnotationId = annotation.id
      this.cancelPlace()
      touchProject()
      return true
    },
    updateAnnotation(id: string, patch: Partial<Pick<ChartAnnotation, 'text' | 'color'>>): void {
      const item = this.current?.annotations.find((ann) => ann.id === id)
      if (!item) {
        return
      }
      Object.assign(item, patch)
      touchProject()
    },
    removeAnnotation(id: string): void {
      const chart = this.current
      if (!chart) {
        return
      }
      chart.annotations = chart.annotations.filter((item) => item.id !== id)
      if (this.selectedAnnotationId === id) {
        this.selectedAnnotationId = null
      }
      touchProject()
    },
    selectAnnotation(id: string | null): void {
      this.selectedAnnotationId = id
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
      const xName = isHist ? (options.y[0] ?? '') : (options.x ?? '')
      const result = (await rpc().invoke(
        'chart.buildSeries',
        seriesParams({
          type: options.type,
          dataId: options.dataId,
          x: xName,
          y: options.y
        })
      )) as ChartBuildSeriesResult
      const datasetName = data.datasets.find((item) => item.id === options.dataId)?.name ?? 'chart'
      const id = crypto.randomUUID()
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
        annotations: [],
        data: result,
        window: null
      }
      this.charts.push(spec)
      this.currentId = id
      this.cancelPlace()
      this.selectedAnnotationId = null
      workflow.centerTab = 'figure'
      touchProject()
      return spec
    },
    async rebuildWindow(id: string, range?: ViewportWindow): Promise<boolean> {
      const chart = this.charts.find((item) => item.id === id)
      if (!chart) {
        return false
      }
      const token = nextRebuildSeq(id)
      try {
        const result = (await rpc().invoke(
          'chart.buildSeries',
          seriesParams(chart, range)
        )) as ChartBuildSeriesResult
        if (!isCurrentRebuild(id, token)) {
          return false
        }
        const live = this.charts.find((item) => item.id === id)
        if (!live) {
          return false
        }
        live.data = result
        live.window = range ?? null
        return true
      } catch {
        return false
      }
    },
    async resetWindow(id: string): Promise<boolean> {
      return this.rebuildWindow(id)
    },
    async saveExport(format: 'png' | 'svg' | 'pdf'): Promise<boolean> {
      const current = this.current
      if (!current?.data) {
        throwExportMissing()
      }
      const workflow = useWorkflowStore()
      workflow.centerTab = 'figure'
      let content: string
      if (format === 'png') {
        await nextTick()
        const canvas = await waitForCanvas(() => canvasProvider?.() ?? null)
        if (!canvas || canvas.width < 1 || canvas.height < 1) {
          throwExportMissing()
        }
        content = pngCapture?.() ?? canvasToPngDataUrl(canvas)
      } else {
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
          },
          annotations: current.annotations
        })
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
