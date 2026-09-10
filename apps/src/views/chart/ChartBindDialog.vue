<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { useChartStore, type BindableChartType } from '@/stores/chart'
import { useDataStore } from '@/stores/data'
import { useLogStore } from '@/stores/log'
import { translateRpcError } from '@/rpc/rpcError'

const { t, te } = useI18n()
const chart = useChartStore()
const data = useDataStore()
const log = useLogStore()
const applying = ref(false)

const form = reactive({
  x: '',
  y: [] as string[],
  title: ''
})

const visible = computed({
  get: () => chart.bindDialogOpen,
  set: (open: boolean) => {
    chart.bindDialogOpen = open
  }
})

const columns = computed(() => data.schema?.columns ?? [])

function isNumericDtype(dtype: string): boolean {
  const value = dtype.toLowerCase()
  return /int|uint|float|double|number|decimal|bool/.test(value)
}

function isTimeDtype(dtype: string): boolean {
  const value = dtype.toLowerCase()
  return value.includes('datetime') || value.includes('timestamp')
}

const numericNames = computed(() =>
  columns.value.filter((col) => isNumericDtype(col.dtype)).map((col) => col.name)
)

const xCandidates = computed(() => {
  const timed = columns.value.filter((col) => isTimeDtype(col.dtype)).map((col) => col.name)
  const rest = columns.value.map((col) => col.name)
  return [...new Set([...timed, ...numericNames.value, ...rest])]
})

const yCandidates = computed(() => numericNames.value)

const isHist = computed(() => chart.pendingType === 'hist')

const canApply = computed(
  () =>
    Boolean(data.currentId && form.y.length && (isHist.value || form.x)) && !applying.value
)

function typeLabel(type: BindableChartType): string {
  if (type === 'scatter') {
    return t('ribbon.chartScatter')
  }
  if (type === 'bar') {
    return t('ribbon.chartBar')
  }
  if (type === 'hist') {
    return t('ribbon.chartHist')
  }
  return t('ribbon.chartLine')
}

function resetForm(): void {
  const names = columns.value.map((col) => col.name)
  const timed = columns.value.find((col) => isTimeDtype(col.dtype))?.name
  const firstNumeric = numericNames.value[0] ?? names[0] ?? ''
  form.x = timed ?? firstNumeric
  const yDefault = numericNames.value.find((name) => name !== form.x) ?? numericNames.value[0] ?? ''
  form.y = yDefault ? [yDefault] : []
  form.title = ''
}

watch(
  () => data.currentId,
  (id) => {
    if (!id) {
      chart.bindDialogOpen = false
    }
  }
)

watch(visible, (open) => {
  if (open) {
    resetForm()
  }
})

function report(err: unknown): void {
  const message = translateRpcError(err, t, te)
  ElMessage.error(message)
  log.append('error', message)
}

async function confirm(): Promise<void> {
  if (!data.currentId || !canApply.value) {
    return
  }
  applying.value = true
  try {
    const created = await chart.createFromBind({
      type: chart.pendingType,
      dataId: data.currentId,
      x: isHist.value ? undefined : form.x,
      y: [...form.y],
      title: form.title,
      yLabel: isHist.value ? t('chart.count') : undefined
    })
    chart.bindDialogOpen = false
    const line = t('log.chartOk', {
      title: created.title,
      points: created.data?.pointCount ?? 0,
      source: created.data?.sourceCount ?? 0
    })
    log.append('info', line)
    ElMessage.success(line)
  } catch (err) {
    report(err)
  } finally {
    applying.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="t('chart.bindTitle', { type: typeLabel(chart.pendingType) })"
    width="460px"
    destroy-on-close
    append-to-body
    :close-on-click-modal="!applying"
  >
    <el-form label-position="top" size="small" @submit.prevent>
      <el-form-item v-if="!isHist" :label="t('chart.xColumn')">
        <el-select v-model="form.x" filterable style="width: 100%">
          <el-option v-for="name in xCandidates" :key="name" :label="name" :value="name" />
        </el-select>
      </el-form-item>
      <el-form-item :label="isHist ? t('chart.valueColumns') : t('chart.yColumns')">
        <el-select v-model="form.y" multiple filterable style="width: 100%">
          <el-option v-for="name in yCandidates" :key="name" :label="name" :value="name" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('chart.title')">
        <el-input v-model="form.title" :placeholder="t('chart.titleHint')" />
      </el-form-item>
      <p class="hint">{{ isHist ? t('chart.bindHistHint') : t('chart.bindHint') }}</p>
    </el-form>
    <template #footer>
      <el-button :disabled="applying" @click="visible = false">{{ t('chart.bindCancel') }}</el-button>
      <el-button type="primary" :loading="applying" :disabled="!canApply" @click="confirm">
        {{ t('chart.bindConfirm') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.hint {
  margin: 0;
  color: #909399;
  font-size: 12px;
  line-height: 1.5;
}
</style>
