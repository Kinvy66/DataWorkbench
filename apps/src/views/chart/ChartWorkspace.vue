<script setup lang="ts">
import 'uplot/dist/uPlot.min.css'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { isGridFigure } from '@/chart/figures'
import { useChartStore, type ChartSpec } from '@/stores/chart'
import { useDataStore } from '@/stores/data'
import DwIcon from '@/icons/DwIcon.vue'
import ChartView from './ChartView.vue'

type ChartViewExpose = {
  resetView: () => void
  canvas: () => HTMLCanvasElement | null
  pngDataUrl: () => string | null
  snapshotCanvas: () => HTMLCanvasElement | null
}

const { t } = useI18n()
const chart = useChartStore()
const data = useDataStore()
const views = ref<Record<string, ChartViewExpose>>({})

const current = computed(() => chart.current)
const currentFigure = computed(() => chart.currentFigure)
const grid = computed(() => Boolean(currentFigure.value && isGridFigure(currentFigure.value)))

watch(
  () => data.datasets.map((item) => item.id).join('\0'),
  () => {
    chart.prune(data.datasets.map((item) => item.id))
  }
)

const activeTab = computed({
  get: () => chart.currentFigureId ?? '',
  set: (id: string) => {
    if (id) {
      chart.selectFigure(id)
    }
  }
})

const gridStyle = computed(() => {
  const figure = currentFigure.value
  if (!figure) {
    return {}
  }
  return {
    gridTemplateColumns: `repeat(${figure.cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${figure.rows}, minmax(0, 1fr))`
  }
})

function chartById(id: string | null): ChartSpec | null {
  if (!id) {
    return null
  }
  return chart.charts.find((item) => item.id === id) ?? null
}

function setView(id: string, el: unknown): void {
  if (el) {
    views.value[id] = el as ChartViewExpose
    return
  }
  delete views.value[id]
}

function onTabRemove(name: string | number): void {
  chart.removeFigure(String(name))
}

async function resetView(): Promise<void> {
  if (!current.value) {
    return
  }
  await chart.resetWindow(current.value.id)
  views.value[current.value.id]?.resetView()
}

function compositePng(): string | null {
  const figure = currentFigure.value
  if (!figure) {
    return current.value ? (views.value[current.value.id]?.pngDataUrl() ?? null) : null
  }
  if (!isGridFigure(figure)) {
    const id = figure.slots[0]
    return id ? (views.value[id]?.pngDataUrl() ?? null) : null
  }
  const snaps = figure.slots.map((id) => (id ? views.value[id]?.snapshotCanvas() ?? null : null))
  const sample = snaps.find((item) => item && item.width > 0) ?? null
  if (!sample) {
    return null
  }
  const cellW = sample.width
  const cellH = sample.height
  const gap = 8
  const out = document.createElement('canvas')
  out.width = figure.cols * cellW + (figure.cols + 1) * gap
  out.height = figure.rows * cellH + (figure.rows + 1) * gap
  const ctx = out.getContext('2d')
  if (!ctx) {
    return null
  }
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, out.width, out.height)
  figure.slots.forEach((_, index) => {
    const col = index % figure.cols
    const row = Math.floor(index / figure.cols)
    const x = gap + col * (cellW + gap)
    const y = gap + row * (cellH + gap)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x, y, cellW, cellH)
    const snap = snaps[index]
    if (snap) {
      ctx.drawImage(snap, x, y, cellW, cellH)
    }
  })
  return out.toDataURL('image/png')
}

onMounted(() => {
  chart.setCanvasProvider(() => {
    const id = chart.currentId
    return id ? (views.value[id]?.canvas() ?? null) : null
  })
  chart.setPngCapture(() => compositePng())
})

onUnmounted(() => {
  chart.setCanvasProvider(null)
  chart.setPngCapture(null)
})
</script>

<template>
  <div v-if="!chart.figures.length" class="empty">
    <DwIcon name="gui/chart" :size="48" />
    <p class="muted">{{ t('layout.figureEmpty') }}</p>
  </div>
  <div v-else class="workspace">
    <el-tabs v-model="activeTab" type="card" closable class="chart-tabs" @tab-remove="onTabRemove">
      <el-tab-pane
        v-for="item in chart.figures"
        :key="item.id"
        :name="item.id"
        :label="item.title"
      />
    </el-tabs>
    <div v-if="currentFigure" class="toolbar">
      <el-button v-if="current" size="small" @click="resetView">{{ t('chart.resetView') }}</el-button>
      <span v-if="chart.placeKind" class="hint">{{ t(`chart.annotateHint.${chart.placeKind}`) }}</span>
      <span v-else-if="grid && !current" class="hint">{{ t('chart.subplotEmpty') }}</span>
      <span v-else-if="current?.data && (current.data.downsampled || current.window)" class="hint">
        {{ t('chart.downsampled', { points: current.data.pointCount, source: current.data.sourceCount }) }}
      </span>
    </div>
    <div v-if="currentFigure && grid" class="grid" :style="gridStyle">
      <div
        v-for="(slot, index) in currentFigure.slots"
        :key="`${currentFigure.id}-${index}`"
        class="cell"
        :class="{ selected: index === chart.currentSlotIndex }"
        @pointerdown="chart.selectSlot(index)"
      >
        <ChartView
          v-if="chartById(slot)"
          :key="slot!"
          :ref="(el) => setView(slot!, el)"
          :chart="chartById(slot)!"
        />
        <span v-else class="cell-empty">{{ t('chart.subplotCell') }}</span>
      </div>
    </div>
    <ChartView
      v-else-if="current"
      :key="current.id"
      :ref="(el) => setView(current.id, el)"
      :chart="current"
    />
  </div>
</template>

<style scoped>
.empty {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  opacity: 0.85;
}
.muted {
  margin: 8px 12px 0;
  color: #909399;
  font-size: 13px;
}
.workspace {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.chart-tabs {
  flex: 0 0 auto;
}
.chart-tabs :deep(.el-tabs__header) {
  margin: 0;
}
.chart-tabs :deep(.el-tabs__content) {
  display: none;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border-bottom: 1px solid #ebeef5;
  background: #fafafa;
}
.hint {
  color: #909399;
  font-size: 12px;
}
.grid {
  flex: 1;
  min-height: 0;
  display: grid;
  gap: 8px;
  padding: 8px;
  background: #f5f7fa;
}
.cell {
  min-width: 0;
  min-height: 0;
  display: flex;
  padding: 0;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #ffffff;
  cursor: pointer;
  overflow: hidden;
}
.cell.selected {
  border-color: #5280c1;
  box-shadow: inset 0 0 0 1px #5280c1;
}
.cell-empty {
  margin: auto;
  padding: 8px;
  color: #909399;
  font-size: 12px;
}
</style>
