<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { useDataStore } from '@/stores/data'
import { useLogStore } from '@/stores/log'
import { translateRpcError } from '@/rpc/rpcError'

type FilterType = 'greater_than' | 'less_than' | 'in_range' | 'out_of_range'
type RowLogic = 'any' | 'all'

const { t, te } = useI18n()
const store = useDataStore()
const log = useLogStore()
const applying = ref(false)
const form = reactive({
  filterType: 'greater_than' as FilterType,
  lower: 0,
  upper: 100,
  subset: [] as string[],
  rowLogic: 'any' as RowLogic,
  treatNan: false
})

const visible = computed({
  get: () => store.thresholdFilterDialogOpen,
  set: (open: boolean) => {
    store.thresholdFilterDialogOpen = open
  }
})

const columns = computed(() => store.schema?.columns.map((col) => col.name) ?? [])
const showLower = computed(() => form.filterType !== 'greater_than')
const showUpper = computed(() => form.filterType !== 'less_than')

function resetForm(): void {
  form.filterType = 'greater_than'
  form.lower = 0
  form.upper = 100
  form.subset = []
  form.rowLogic = 'any'
  form.treatNan = false
}

watch(
  () => store.currentId,
  (id) => {
    if (!id) {
      store.thresholdFilterDialogOpen = false
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
  if (!store.currentId || applying.value) {
    return
  }
  applying.value = true
  try {
    const result = await store.thresholdFilter({
      filterType: form.filterType,
      lower: form.lower,
      upper: form.upper,
      subset: form.subset.length ? [...form.subset] : undefined,
      rowLogic: form.rowLogic,
      treatNan: form.treatNan
    })
    store.thresholdFilterDialogOpen = false
    if (!result) {
      return
    }
    const line = t('log.thresholdFilterOk', {
      name: result.name,
      removed: result.removedCount,
      rows: result.rows,
      cols: result.cols
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
    :title="t('ribbon.dataThresholdFilter')"
    width="420px"
    destroy-on-close
    append-to-body
    :close-on-click-modal="!applying"
  >
    <el-form label-position="top" size="small" @submit.prevent>
      <el-form-item :label="t('data.thresholdFilterType')">
        <el-select v-model="form.filterType" style="width: 100%">
          <el-option :label="t('data.thresholdTypeGreater')" value="greater_than" />
          <el-option :label="t('data.thresholdTypeLess')" value="less_than" />
          <el-option :label="t('data.thresholdTypeInRange')" value="in_range" />
          <el-option :label="t('data.thresholdTypeOutOfRange')" value="out_of_range" />
        </el-select>
      </el-form-item>
      <el-form-item v-if="showLower" :label="t('data.thresholdLower')">
        <el-input-number v-model="form.lower" :step="1" style="width: 100%" />
      </el-form-item>
      <el-form-item v-if="showUpper" :label="t('data.thresholdUpper')">
        <el-input-number v-model="form.upper" :step="1" style="width: 100%" />
      </el-form-item>
      <el-form-item :label="t('data.thresholdSubset')">
        <el-select
          v-model="form.subset"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          clearable
          style="width: 100%"
          :placeholder="t('data.thresholdSubsetHint')"
        >
          <el-option v-for="name in columns" :key="name" :label="name" :value="name" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('data.thresholdRowLogic')">
        <el-select v-model="form.rowLogic" style="width: 100%">
          <el-option :label="t('data.thresholdRowLogicAny')" value="any" />
          <el-option :label="t('data.thresholdRowLogicAll')" value="all" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('data.thresholdTreatNan')">
        <el-switch v-model="form.treatNan" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button :disabled="applying" @click="visible = false">{{ t('data.thresholdCancel') }}</el-button>
      <el-button type="primary" :loading="applying" @click="confirm">{{ t('data.thresholdConfirm') }}</el-button>
    </template>
  </el-dialog>
</template>
