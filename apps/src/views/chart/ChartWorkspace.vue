<script setup lang="ts">
import 'uplot/dist/uPlot.min.css'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useChartStore } from '@/stores/chart'
import { useDataStore } from '@/stores/data'
import DwIcon from '@/icons/DwIcon.vue'
import ChartView from './ChartView.vue'

const { t } = useI18n()
const chart = useChartStore()
const data = useDataStore()
const view = ref<{
  resetView: () => void
  canvas: () => HTMLCanvasElement | null
  pngDataUrl: () => string | null
} | null>(null)

const current = computed(() => chart.current)

watch(
  () => data.datasets.map((item) => item.id).join('\0'),
  () => {
    chart.prune(data.datasets.map((item) => item.id))
  }
)

const activeTab = computed({
  get: () => chart.currentId ?? '',
  set: (id: string) => {
    if (id) {
      chart.select(id)
    }
  }
})

function onTabRemove(name: string | number): void {
  chart.remove(String(name))
}

async function resetView(): Promise<void> {
  if (!current.value) {
    return
  }
  await chart.resetWindow(current.value.id)
  view.value?.resetView()
}

onMounted(() => {
  chart.setCanvasProvider(() => view.value?.canvas() ?? null)
  chart.setPngCapture(() => view.value?.pngDataUrl() ?? null)
})

onUnmounted(() => {
  chart.setCanvasProvider(null)
  chart.setPngCapture(null)
})
</script>

<template>
  <div v-if="!chart.charts.length" class="empty">
    <DwIcon name="gui/chart" :size="48" />
    <p class="muted">{{ t('layout.figureEmpty') }}</p>
  </div>
  <div v-else class="workspace">
    <el-tabs v-model="activeTab" type="card" closable class="chart-tabs" @tab-remove="onTabRemove">
      <el-tab-pane v-for="item in chart.charts" :key="item.id" :name="item.id" :label="item.title" />
    </el-tabs>
    <div v-if="current" class="toolbar">
      <el-button size="small" @click="resetView">{{ t('chart.resetView') }}</el-button>
      <span v-if="chart.placeKind" class="hint">{{ t(`chart.annotateHint.${chart.placeKind}`) }}</span>
      <span v-else-if="current.data && (current.data.downsampled || current.window)" class="hint">
        {{ t('chart.downsampled', { points: current.data.pointCount, source: current.data.sourceCount }) }}
      </span>
    </div>
    <ChartView v-if="current" :key="current.id" ref="view" :chart="current" />
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
</style>
