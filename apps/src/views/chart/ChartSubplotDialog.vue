<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { SUBPLOT_LAYOUTS } from '@/chart/figures'
import { useChartStore } from '@/stores/chart'

const { t } = useI18n()
const chart = useChartStore()
const layout = ref<(typeof SUBPLOT_LAYOUTS)[number]>('2x2')

const visible = computed({
  get: () => chart.subplotDialogOpen,
  set: (open: boolean) => {
    chart.subplotDialogOpen = open
  }
})

function confirm(): void {
  chart.createSubplots(layout.value)
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="t('chart.subplotTitle')"
    width="400px"
    destroy-on-close
    append-to-body
  >
    <p class="hint">{{ t('chart.subplotHint') }}</p>
    <el-radio-group v-model="layout" class="layouts">
      <el-radio-button v-for="item in SUBPLOT_LAYOUTS" :key="item" :label="item">
        {{ item.replace('x', '×') }}
      </el-radio-button>
    </el-radio-group>
    <template #footer>
      <el-button @click="visible = false">{{ t('chart.bindCancel') }}</el-button>
      <el-button type="primary" @click="confirm">{{ t('chart.subplotConfirm') }}</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.hint {
  margin: 0 0 12px;
  color: #909399;
  font-size: 13px;
  line-height: 1.45;
}
.layouts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
