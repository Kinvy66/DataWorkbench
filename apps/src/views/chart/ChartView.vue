<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  UPlotChart,
  annotationSvgMarkup,
  dataExtent,
  debounce,
  drawAnnotations,
  planViewportRequest,
  type ChartAnnotation,
  type OverlayRect,
  type ViewportWindow
} from '@dw/chart-core'
import { CHART_VIEWPORT_DEBOUNCE_MS } from '@dw/rpc-types'
import type { ChartSpec } from '@/stores/chart'
import { useChartStore } from '@/stores/chart'

const props = defineProps<{
  chart: ChartSpec
}>()

const chartStore = useChartStore()
const wrap = ref<HTMLElement | null>(null)
const host = ref<HTMLElement | null>(null)
let plot: UPlotChart | null = null
let observer: ResizeObserver | null = null
let ready = false

const overlay = ref<OverlayRect | null>(null)
const pendingEnd = ref<{ x: number; y: number } | null>(null)

const placing = computed(() => Boolean(chartStore.placeKind))

const overlayItems = computed((): ChartAnnotation[] => {
  const items = [...props.chart.annotations]
  const kind = chartStore.placeKind
  const start = chartStore.placeAnchor
  const end = pendingEnd.value
  if (kind && start && end && (kind === 'arrow' || kind === 'region')) {
    items.push({
      id: 'pending',
      kind,
      color: '#CE6043',
      text: '',
      x: start.x,
      y: start.y,
      x2: end.x,
      y2: end.y
    })
  }
  return items
})

const overlayMarkup = computed(() => {
  const rect = overlay.value
  if (!rect || !plot) {
    return ''
  }
  return annotationSvgMarkup(overlayItems.value, {
    x: (value) => plot?.dataToOverlay(value, 0)?.x ?? 0,
    y: (value) => plot?.dataToOverlay(0, value)?.y ?? 0,
    plotLeft: 0,
    plotTop: 0,
    plotWidth: rect.width,
    plotHeight: rect.height
  })
})

const overlayStyle = computed(() => {
  const rect = overlay.value
  if (!rect) {
    return { display: 'none' as const }
  }
  return {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`
  }
})

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

function syncOverlay(): void {
  const el = wrap.value
  overlay.value = el && plot ? plot.overlayRect(el) : null
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
    },
    onFrame: () => {
      syncOverlay()
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

function snapshotCanvas(): HTMLCanvasElement | null {
  const src = canvas()
  const scale = plot?.canvasScale()
  if (!src || src.width < 1 || src.height < 1) {
    return null
  }
  const out = document.createElement('canvas')
  out.width = src.width
  out.height = src.height
  const ctx = out.getContext('2d')
  if (!ctx) {
    return null
  }
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(src, 0, 0)
  if (scale) {
    drawAnnotations(ctx, props.chart.annotations, scale)
  }
  return out
}

function pngDataUrl(): string | null {
  return snapshotCanvas()?.toDataURL('image/png') ?? null
}

function onOverlayClick(event: MouseEvent): void {
  if (!placing.value || !plot) {
    return
  }
  const point = plot.overlayToData(event.offsetX, event.offsetY)
  if (!point) {
    return
  }
  pendingEnd.value = null
  chartStore.placeAt(point)
}

function onOverlayMove(event: MouseEvent): void {
  if (!placing.value || !plot || !chartStore.placeAnchor) {
    return
  }
  pendingEnd.value = plot.overlayToData(event.offsetX, event.offsetY)
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    pendingEnd.value = null
    chartStore.cancelPlace()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
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
  window.removeEventListener('keydown', onKeyDown)
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

watch(
  () => chartStore.placeKind,
  (kind) => {
    if (!kind) {
      pendingEnd.value = null
    }
  }
)

defineExpose({ resetView, canvas, pngDataUrl, snapshotCanvas })
</script>

<template>
  <div ref="wrap" class="chart-wrap">
    <div ref="host" class="chart-host" />
    <svg
      class="ann-overlay"
      :class="{ placing }"
      :style="overlayStyle"
      :viewBox="overlay ? `0 0 ${overlay.width} ${overlay.height}` : '0 0 1 1'"
      v-html="overlayMarkup"
      @click="onOverlayClick"
      @mousemove="onOverlayMove"
    />
  </div>
</template>

<style scoped>
.chart-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  width: 100%;
  height: 100%;
}
.chart-host {
  width: 100%;
  height: 100%;
}
.ann-overlay {
  position: absolute;
  pointer-events: none;
  overflow: visible;
}
.ann-overlay.placing {
  pointer-events: auto;
  cursor: crosshair;
}
</style>
