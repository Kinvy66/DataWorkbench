import { defineStore } from 'pinia'
import {
  CHART_MAX_POINTS_DEFAULT,
  type ChartBuildSeriesResult,
  type ChartTypeId
} from '@dw/rpc-types'
import { seriesColor } from '@dw/chart-core'
import { getDesktopBridge } from '@/rpc/bridge'
import { useDataStore } from './data'
import { useWorkflowStore } from './workflow'

export type BindableChartType = Exclude<ChartTypeId, 'hist'>

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

function rpc() {
  return getDesktopBridge().rpc
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
      x: string
      y: string[]
      title?: string
    }): Promise<ChartSpec> {
      const data = useDataStore()
      const workflow = useWorkflowStore()
      const result = (await rpc().invoke('chart.buildSeries', {
        dataId: options.dataId,
        x: options.x,
        y: options.y,
        maxPoints: CHART_MAX_POINTS_DEFAULT
      })) as ChartBuildSeriesResult
      const datasetName = data.datasets.find((item) => item.id === options.dataId)?.name ?? 'chart'
      const id = crypto.randomUUID()
      const spec: ChartSpec = {
        id,
        type: options.type,
        dataId: options.dataId,
        x: options.x,
        y: options.y,
        title: options.title?.trim() || `${datasetName} — ${options.type}`,
        xLabel: options.x,
        yLabel: options.y.join(', '),
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
    }
  }
})
