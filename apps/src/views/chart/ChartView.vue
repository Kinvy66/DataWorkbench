<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  UPlotChart,
  dataExtent,
  debounce,
  planViewportRequest,
  type ViewportWindow
} from '@dw/chart-core'
import { CHART_VIEWPORT_DEBOUNCE_MS } from '@dw/rpc-types'
import type { ChartSpec } from '@/stores/chart'
import { useChartStore } from '@/stores/chart'

const props = defineProps<{
  chart: ChartSpec
}>()

const chartStore = useChartStore()
const host = ref<HTMLElement | null>(null)
let plot: UPlotChart | null = null
let observer: ResizeObserver | null = null
let ready = false

const scheduleWindow = debounce((range: ViewportWindow) => {
  const spec = props.chart
  if (!spec.data) {
    return
  }
  const next = planViewportRequest({
    range,
    currentWindow: spec.window,
    dataExtent: dataExtent(spec.data.x),
    downsampled: spec.data.downsampled,
    sourceCount: spec.data.sourceCount,
    maxPoints: spec.data.maxPoints,
    kind: spec.type
  })
  if (!next) {
    return
  }
  void chartStore.rebuildWindow(spec.id, next)
}, CHART_VIEWPORT_DEBOUNCE_MS)

function plotData() {
  const series = props.chart.data
  if (!series) {
    return null
  }
  return {
    x: series.x.map((value) => (value == null ? Number.NaN : value)),
    ys: series.ys,
    xKind: series.xKind
  }
}

function render(): void {
  const el = host.value
  const data = plotData()
  if (!el || !data) {
    return
  }
  const width = el.clientWidth
  const height = el.clientHeight
  if (width < 40 || height < 40) {
    return
  }
  if (!plot) {
    plot = new UPlotChart(el)
  }
  plot.render({
    title: props.chart.title,
    xLabel: props.chart.xLabel,
    yLabel: props.chart.yLabel,
    legend: props.chart.legend,
    grid: props.chart.grid,
    kind: props.chart.type,
    styles: props.chart.series.map((item) => ({
      label: item.key,
      color: item.color,
      width: item.width
    })),
    data,
    width,
    height,
    onXRange: (range) => {
      scheduleWindow(range)
    }
  })
}

function applyData(): void {
  const data = plotData()
  if (!data) {
    return
  }
  if (!plot) {
    render()
    return
  }
  plot.setData(data, props.chart.window == null)
}

function resetView(): void {
  plot?.resetView()
}

function canvas(): HTMLCanvasElement | null {
  return plot?.canvas() ?? null
}

onMounted(() => {
  void nextTick(() => {
    render()
    ready = true
    observer = new ResizeObserver(() => {
      const el = host.value
      if (!el || !plot) {
        render()
        return
      }
      plot.setSize(el.clientWidth, el.clientHeight)
    })
    if (host.value) {
      observer.observe(host.value)
    }
  })
})

onBeforeUnmount(() => {
  ready = false
  scheduleWindow.cancel()
  observer?.disconnect()
  plot?.destroy()
  plot = null
})

watch(
  () => [
    props.chart.id,
    props.chart.title,
    props.chart.xLabel,
    props.chart.yLabel,
    props.chart.grid,
    props.chart.legend,
    props.chart.type,
    props.chart.series.map((item) => `${item.key}:${item.color}:${item.width}`).join('|')
  ],
  () => {
    if (ready) {
      render()
    }
  }
)

watch(
  () => props.chart.data,
  () => {
    if (ready) {
      applyData()
    }
  }
)

defineExpose({ resetView, canvas })
</script>

<template>
  <div ref="host" class="chart-host" />
</template>

<style scoped>
.chart-host {
  flex: 1;
  min-height: 0;
  width: 100%;
  height: 100%;
}
</style>
