import { defineStore } from 'pinia'
import { nextTick } from 'vue'
import {
  CHART_HIST_BINS_DEFAULT,
  CHART_HIST_BINS_MAX,
  CHART_HIST_BINS_MIN,
  CHART_MAX_POINTS_DEFAULT,
  type ChartBuildSeriesParams,
  type ChartBuildSeriesResult,
  type ChartHistStat,
  type ChartTypeId,
  type ProjectChartsFile,
  type ProjectFigurePersist
} from '@dw/rpc-types'
import {
  ANNOTATION_COLOR,
  canvasToPngDataUrl,
  figureToSvg,
  parseChartAnnotations,
  seriesColor,
  applyPaletteToSeries,
  DEFAULT_SERIES_PALETTE,
  isSeriesPaletteId,
  seriesToSvg,
  suggestedExportName,
  type ChartAnnotation,
  type ChartAnnotationKind,
  type SvgExportOptions,
  type ViewportWindow,
  type SeriesPaletteId
} from '@dw/chart-core'
import {
  emptyFigure,
  isGridFigure,
  parseProjectFigure,
  parseSubplotLayout,
  slotIndexOf,
  wrapChartAsFigure,
  type ChartFigure
} from '@/chart/figures'
import { getDesktopBridge } from '@/rpc/bridge'
import { isCancelled } from '@/rpc/rpcError'
import { useDataStore } from './data'
import { touchProject } from './project'
import { useWorkflowStore } from './workflow'

export type { ChartFigure } from '@/chart/figures'
export type { SeriesPaletteId } from '@dw/chart-core'

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
  palette?: SeriesPaletteId
  annotations: ChartAnnotation[]
  bins?: number
  binWidth?: number
  histStat?: ChartHistStat
  histCumulative?: boolean
  data: ChartBuildSeriesResult | null
  window: ViewportWindow | null
}

const HIST_Y_LABELS: Record<ChartHistStat, readonly [string, string]> = {
  count: ['Count', '频数'],
  density: ['Density', '密度'],
  probability: ['Probability', '概率'],
  percent: ['Percent', '百分比']
}

function clampHistBins(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) {
    return CHART_HIST_BINS_DEFAULT
  }
  return Math.max(CHART_HIST_BINS_MIN, Math.min(Math.round(value), CHART_HIST_BINS_MAX))
}

function isDefaultHistYLabel(label: string): boolean {
  return Object.values(HIST_Y_LABELS).some((pair) => pair.includes(label))
}

function histYLabelMatching(current: string, stat: ChartHistStat): string {
  const zh = /[\u4e00-\u9fff]/.test(current)
  return HIST_Y_LABELS[stat][zh ? 1 : 0]
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
  chart: Pick<ChartSpec, 'type' | 'dataId' | 'x' | 'y' | 'bins' | 'binWidth' | 'histStat' | 'histCumulative'>,
  range?: ViewportWindow
): ChartBuildSeriesParams {
  const isHist = chart.type === 'hist'
  const params: ChartBuildSeriesParams = isHist
    ? {
        dataId: chart.dataId,
        y: chart.y,
        kind: 'hist',
        bins: clampHistBins(chart.bins)
      }
    : {
        dataId: chart.dataId,
        x: chart.x,
        y: chart.y,
        maxPoints: CHART_MAX_POINTS_DEFAULT
      }
  if (isHist) {
    if (chart.binWidth != null && chart.binWidth > 0) {
      params.binWidth = chart.binWidth
    }
    if (chart.histStat && chart.histStat !== 'count') {
      params.histStat = chart.histStat
    }
    if (chart.histCumulative) {
      params.histCumulative = true
    }
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

async function waitForPng(tries = 20): Promise<string | null> {
  const first = pngCapture?.() ?? null
  if (first && first.length > 80) {
    return first
  }
  if (typeof requestAnimationFrame !== 'function') {
    return first
  }
  for (let i = 0; i < tries; i++) {
    await afterPaint()
    const next = pngCapture?.() ?? null
    if (next && next.length > 80) {
      return next
    }
  }
  return pngCapture?.() ?? null
}

function svgOptionsFromChart(chart: ChartSpec): SvgExportOptions | null {
  if (!chart.data) {
    return null
  }
  return {
    kind: chart.type,
    title: chart.title,
    xLabel: chart.xLabel,
    yLabel: chart.yLabel,
    legend: chart.legend,
    grid: chart.grid,
    styles: chart.series.map((item) => ({
      label: item.key,
      color: item.color,
      width: item.width
    })),
    data: {
      x: chart.data.x.map((value) => (value == null ? Number.NaN : value)),
      ys: chart.data.ys,
      xKind: chart.data.xKind
    },
    annotations: chart.annotations
  }
}

function persistFigure(figure: ChartFigure): ProjectFigurePersist {
  return {
    id: figure.id,
    title: figure.title,
    rows: figure.rows,
    cols: figure.cols,
    slots: [...figure.slots]
  }
}

export const useChartStore = defineStore('chart', {
  state: () => ({
    charts: [] as ChartSpec[],
    figures: [] as ChartFigure[],
    currentId: null as string | null,
    currentFigureId: null as string | null,
    currentSlotIndex: 0,
    bindDialogOpen: false,
    subplotDialogOpen: false,
    pendingType: 'line' as BindableChartType,
    placeKind: null as ChartAnnotationKind | null,
    placeAnchor: null as { x: number; y: number } | null,
    selectedAnnotationId: null as string | null
  }),
  getters: {
    current(state): ChartSpec | null {
      return state.charts.find((item) => item.id === state.currentId) ?? null
    },
    currentFigure(state): ChartFigure | null {
      return state.figures.find((item) => item.id === state.currentFigureId) ?? null
    },
    hasExportableFigure(state): boolean {
      const figure = state.figures.find((item) => item.id === state.currentFigureId)
      if (!figure) {
        return Boolean(state.currentId)
      }
      return figure.slots.some((id) => {
        const chart = state.charts.find((item) => item.id === id)
        return Boolean(chart?.data)
      })
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
    openSubplotDialog(): void {
      this.subplotDialogOpen = true
    },
    prune(existingIds: string[]): void {
      const keep = new Set(existingIds)
      for (const item of this.charts) {
        if (!keep.has(item.dataId)) {
          rebuildSeq.delete(item.id)
        }
      }
      this.charts = this.charts.filter((item) => keep.has(item.dataId))
      const chartIds = new Set(this.charts.map((item) => item.id))
      this.figures = this.figures
        .map((figure) => ({
          ...figure,
          slots: figure.slots.map((id) => (id && chartIds.has(id) ? id : null))
        }))
        .filter((figure) => isGridFigure(figure) || figure.slots.some(Boolean))
      if (this.currentId && !chartIds.has(this.currentId)) {
        this.currentId = this.charts[0]?.id ?? null
      }
      if (this.currentFigureId && !this.figures.some((item) => item.id === this.currentFigureId)) {
        this.currentFigureId = this.figures[0]?.id ?? null
        this.currentSlotIndex = 0
        if (this.currentFigure) {
          this.currentId = this.currentFigure.slots[0] ?? this.charts[0]?.id ?? null
        }
      }
    },
    clear(): void {
      this.charts = []
      this.figures = []
      this.currentId = null
      this.currentFigureId = null
      this.currentSlotIndex = 0
      this.cancelPlace()
      this.selectedAnnotationId = null
      rebuildSeq.clear()
    },
    async restoreFromFile(file: ProjectChartsFile): Promise<void> {
      this.cancelPlace()
      this.selectedAnnotationId = null
      this.charts = []
      this.figures = []
      this.currentId = null
      this.currentFigureId = null
      this.currentSlotIndex = 0
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
          palette: isSeriesPaletteId(spec.palette) ? spec.palette : DEFAULT_SERIES_PALETTE,
          annotations: parseChartAnnotations(spec.annotations),
          bins: spec.bins,
          binWidth: spec.binWidth,
          histStat: spec.histStat,
          histCumulative: spec.histCumulative,
          data,
          window: null
        })
      }
      const chartIds = new Set(this.charts.map((item) => item.id))
      const parsed = (file.figures ?? [])
        .map((item) => parseProjectFigure(item, chartIds))
        .filter((item): item is ChartFigure => item != null)
      const used = new Set(parsed.flatMap((figure) => figure.slots.filter((id): id is string => Boolean(id))))
      const wrapped = this.charts.filter((chart) => !used.has(chart.id)).map((chart) => wrapChartAsFigure(chart))
      this.figures = [...parsed, ...wrapped]
      this.currentId =
        file.currentId && this.charts.some((item) => item.id === file.currentId)
          ? file.currentId
          : (this.charts[0]?.id ?? null)
      const fromFile =
        file.currentFigureId && this.figures.some((item) => item.id === file.currentFigureId)
          ? file.currentFigureId
          : null
      const fromChart = this.figures.find((figure) => figure.slots.includes(this.currentId))?.id ?? null
      this.currentFigureId = fromFile ?? fromChart ?? this.figures[0]?.id ?? null
      this.currentSlotIndex = this.currentFigure ? slotIndexOf(this.currentFigure, this.currentId) : 0
    },
    captureFigures(): ProjectFigurePersist[] {
      if (this.figures.length) {
        return this.figures.map(persistFigure)
      }
      return this.charts.map((chart) => persistFigure(wrapChartAsFigure(chart)))
    },
    select(id: string): void {
      const chart = this.charts.find((item) => item.id === id)
      if (!chart) {
        return
      }
      const figure = this.figures.find((item) => item.slots.includes(id))
      if (this.currentId !== id) {
        this.cancelPlace()
        this.selectedAnnotationId = null
      }
      this.currentId = id
      if (figure) {
        this.currentFigureId = figure.id
        this.currentSlotIndex = slotIndexOf(figure, id)
      }
    },
    selectFigure(id: string): void {
      const figure = this.figures.find((item) => item.id === id)
      if (!figure) {
        return
      }
      if (this.currentFigureId !== id) {
        this.cancelPlace()
        this.selectedAnnotationId = null
        this.currentSlotIndex = figure.slots.findIndex((slot) => Boolean(slot))
        if (this.currentSlotIndex < 0) {
          this.currentSlotIndex = 0
        }
      }
      this.currentFigureId = id
      this.currentId = figure.slots[this.currentSlotIndex] ?? null
    },
    selectSlot(index: number): void {
      const figure = this.currentFigure
      if (!figure || index < 0 || index >= figure.slots.length) {
        return
      }
      const nextId = figure.slots[index]
      if (this.currentSlotIndex !== index || this.currentId !== nextId) {
        this.cancelPlace()
        this.selectedAnnotationId = null
      }
      this.currentSlotIndex = index
      this.currentId = nextId
    },
    remove(id: string): void {
      this.removeFigure(id)
    },
    removeFigure(id: string): void {
      const figure = this.figures.find((item) => item.id === id)
      if (!figure) {
        const chart = this.charts.find((item) => item.id === id)
        if (chart) {
          const host = this.figures.find((item) => item.slots.includes(id))
          if (host) {
            this.removeFigure(host.id)
          }
        }
        return
      }
      for (const slot of figure.slots) {
        if (slot) {
          rebuildSeq.delete(slot)
        }
      }
      const drop = new Set(figure.slots.filter((slot): slot is string => Boolean(slot)))
      this.charts = this.charts.filter((item) => !drop.has(item.id))
      this.figures = this.figures.filter((item) => item.id !== id)
      if (this.currentFigureId === id) {
        this.currentFigureId = this.figures[0]?.id ?? null
        this.currentSlotIndex = 0
        this.currentId = this.currentFigure?.slots[0] ?? this.charts[0]?.id ?? null
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
      if (patch.title != null) {
        const figure = this.figures.find((item) => item.slots.includes(id))
        if (figure && !isGridFigure(figure)) {
          figure.title = patch.title
        }
      }
      touchProject()
    },
    updateFigureTitle(id: string, title: string): void {
      const figure = this.figures.find((item) => item.id === id)
      if (!figure) {
        return
      }
      figure.title = title
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
    updatePalette(id: string, palette: SeriesPaletteId): void {
      const chart = this.charts.find((item) => item.id === id)
      if (!chart) {
        return
      }
      chart.palette = palette
      chart.series = applyPaletteToSeries(chart.series, palette)
      touchProject()
    },
    async updateHist(
      id: string,
      patch: {
        bins?: number
        binWidth?: number | null
        histStat?: ChartHistStat
        histCumulative?: boolean
      }
    ): Promise<boolean> {
      const chart = this.charts.find((item) => item.id === id)
      if (!chart || chart.type !== 'hist') {
        return false
      }
      if (patch.bins != null) {
        chart.bins = clampHistBins(patch.bins)
      }
      if (patch.binWidth !== undefined) {
        chart.binWidth = patch.binWidth != null && patch.binWidth > 0 ? patch.binWidth : undefined
      }
      if (patch.histStat) {
        if (isDefaultHistYLabel(chart.yLabel)) {
          chart.yLabel = histYLabelMatching(chart.yLabel, patch.histStat)
        }
        chart.histStat = patch.histStat
      }
      if (patch.histCumulative != null) {
        chart.histCumulative = patch.histCumulative
      }
      touchProject()
      return this.rebuildWindow(id, chart.window ?? undefined)
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
    createSubplots(layout: string): ChartFigure | null {
      const dims = parseSubplotLayout(layout)
      if (!dims) {
        return null
      }
      const figure = emptyFigure(dims.rows, dims.cols)
      this.figures.push(figure)
      this.currentFigureId = figure.id
      this.currentSlotIndex = 0
      this.currentId = null
      this.cancelPlace()
      this.selectedAnnotationId = null
      useWorkflowStore().centerTab = 'figure'
      this.subplotDialogOpen = false
      touchProject()
      return figure
    },
    async createFromBind(options: {
      type: BindableChartType
      dataId: string
      x?: string
      y: string[]
      title?: string
      yLabel?: string
      bins?: number
    }): Promise<ChartSpec> {
      const data = useDataStore()
      const workflow = useWorkflowStore()
      const isHist = options.type === 'hist'
      const xName = isHist ? (options.y[0] ?? '') : (options.x ?? '')
      const bins = isHist ? clampHistBins(options.bins) : undefined
      const result = (await rpc().invoke(
        'chart.buildSeries',
        seriesParams({
          type: options.type,
          dataId: options.dataId,
          x: xName,
          y: options.y,
          bins
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
          color: seriesColor(index, DEFAULT_SERIES_PALETTE),
          width: 1.5
        })),
        palette: DEFAULT_SERIES_PALETTE,
        annotations: [],
        bins,
        histStat: isHist ? 'count' : undefined,
        histCumulative: isHist ? false : undefined,
        data: result,
        window: null
      }
      const figure = this.currentFigure
      if (figure && isGridFigure(figure)) {
        const slot = this.currentSlotIndex
        const previous = figure.slots[slot]
        if (previous) {
          rebuildSeq.delete(previous)
          this.charts = this.charts.filter((item) => item.id !== previous)
        }
        this.charts.push(spec)
        figure.slots[slot] = id
        this.currentId = id
      } else {
        this.charts.push(spec)
        const next = wrapChartAsFigure(spec)
        this.figures.push(next)
        this.currentFigureId = next.id
        this.currentSlotIndex = 0
        this.currentId = id
      }
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
      const figure = this.currentFigure
      const current = this.current
      const exportable = figure
        ? figure.slots.some((id) => this.charts.find((item) => item.id === id)?.data)
        : Boolean(current?.data)
      if (!exportable) {
        throwExportMissing()
      }
      const workflow = useWorkflowStore()
      workflow.centerTab = 'figure'
      let content: string
      if (format === 'png') {
        await nextTick()
        const captured = await waitForPng()
        if (captured && captured.length > 80) {
          content = captured
        } else {
          const canvas = await waitForCanvas(() => canvasProvider?.() ?? null)
          if (!canvas || canvas.width < 1 || canvas.height < 1) {
            throwExportMissing()
          }
          content = canvasToPngDataUrl(canvas)
        }
      } else if (figure && isGridFigure(figure)) {
        const panels = figure.slots.map((id) => {
          const chart = this.charts.find((item) => item.id === id)
          return chart ? svgOptionsFromChart(chart) : null
        })
        if (!panels.some(Boolean)) {
          throwExportMissing()
        }
        content = figureToSvg({
          title: figure.title,
          rows: figure.rows,
          cols: figure.cols,
          panels
        })
      } else {
        const chart = current && current.data ? current : this.charts.find((item) => item.data) ?? null
        if (!chart?.data) {
          throwExportMissing()
        }
        content = seriesToSvg(svgOptionsFromChart(chart)!)
      }
      const nameSource = figure?.title || current?.title || 'chart'
      const result = await rpc().invoke('chart.saveExport', {
        format,
        suggestedName: suggestedExportName(nameSource, format),
        content
      })
      return !isCancelled(result)
    }
  }
})
