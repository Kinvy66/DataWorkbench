<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useChartStore } from '@/stores/chart'
import DwIcon from '@/icons/DwIcon.vue'

const { t } = useI18n()
const chart = useChartStore()
const current = computed(() => chart.current)
</script>

<template>
  <div v-if="!current" class="empty">
    <DwIcon name="gui/chart" :size="48" />
    <p class="muted">{{ t('layout.propertiesEmpty') }}</p>
  </div>
  <div v-else class="props">
    <el-form label-position="top" size="small">
      <el-form-item :label="t('chart.title')">
        <el-input
          :model-value="current.title"
          @update:model-value="(value) => chart.updateStyle(current.id, { title: String(value) })"
        />
      </el-form-item>
      <el-form-item :label="t('chart.xLabel')">
        <el-input
          :model-value="current.xLabel"
          @update:model-value="(value) => chart.updateStyle(current.id, { xLabel: String(value) })"
        />
      </el-form-item>
      <el-form-item :label="t('chart.yLabel')">
        <el-input
          :model-value="current.yLabel"
          @update:model-value="(value) => chart.updateStyle(current.id, { yLabel: String(value) })"
        />
      </el-form-item>
      <el-form-item :label="t('chart.grid')">
        <el-switch
          :model-value="current.grid"
          @update:model-value="(value: boolean) => chart.updateStyle(current.id, { grid: value })"
        />
      </el-form-item>
      <el-form-item :label="t('chart.legend')">
        <el-switch
          :model-value="current.legend"
          @update:model-value="(value: boolean) => chart.updateStyle(current.id, { legend: value })"
        />
      </el-form-item>
      <div v-for="series in current.series" :key="series.key" class="series">
        <p class="series-name">{{ series.key }}</p>
        <el-form-item :label="t('chart.color')">
          <el-color-picker
            :model-value="series.color"
            @update:model-value="
              (value: string | null) => {
                if (value) chart.updateSeries(current.id, series.key, { color: value })
              }
            "
          />
        </el-form-item>
        <el-form-item :label="t('chart.width')">
          <el-input-number
            :model-value="series.width"
            :min="0.5"
            :max="8"
            :step="0.5"
            @update:model-value="
              (value: number | undefined) => {
                if (value != null) chart.updateSeries(current.id, series.key, { width: value })
              }
            "
          />
        </el-form-item>
      </div>
    </el-form>
  </div>
</template>

<style scoped>
.empty {
  margin: 16px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  opacity: 0.85;
}
.muted {
  margin: 8px 0 0;
  color: #909399;
  font-size: 13px;
}
.props {
  padding: 8px 10px;
  overflow: auto;
  flex: 1;
  min-height: 0;
}
.series {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #ebeef5;
}
.series-name {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 600;
  color: #303133;
}
</style>
