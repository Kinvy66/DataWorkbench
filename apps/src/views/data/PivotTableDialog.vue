<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { useDataStore } from '@/stores/data'
import { useLogStore } from '@/stores/log'
import { translateRpcError } from '@/rpc/rpcError'

const AGGFUNCS = [
  'mean',
  'sum',
  'count',
  'size',
  'min',
  'max',
  'median',
  'std',
  'var',
  'first',
  'last',
  'prod'
] as const

type PivotAggfunc = (typeof AGGFUNCS)[number]
type PivotRole = 'index' | 'columns' | 'values'

const { t, te } = useI18n()
const store = useDataStore()
const log = useLogStore()
const applying = ref(false)
const form = reactive({
  index: [] as string[],
  columns: [] as string[],
  values: [] as string[],
  aggfunc: 'mean' as PivotAggfunc,
  margins: false,
  marginsName: 'All',
  sort: false,
  name: ''
})

const visible = computed({
  get: () => store.pivotTableDialogOpen,
  set: (open: boolean) => {
    store.pivotTableDialogOpen = open
  }
})

const allColumns = computed(() => store.schema?.columns.map((col) => col.name) ?? [])
const canApply = computed(() => form.index.length > 0 && !applying.value)

function optionsFor(role: PivotRole): string[] {
  const taken = new Set<string>([
    ...(role === 'index' ? [] : form.index),
    ...(role === 'columns' ? [] : form.columns),
    ...(role === 'values' ? [] : form.values)
  ])
  return allColumns.value.filter((name) => !taken.has(name))
}

function assignRole(role: PivotRole, names: string[]): void {
  form[role] = names
  for (const other of ['index', 'columns', 'values'] as const) {
    if (other !== role) {
      form[other] = form[other].filter((name) => !names.includes(name))
    }
  }
}

function resetForm(): void {
  form.index = []
  form.columns = []
  form.values = []
  form.aggfunc = 'mean'
  form.margins = false
  form.marginsName = 'All'
  form.sort = false
  form.name = ''
}

watch(
  () => store.currentId,
  (id) => {
    if (!id) {
      store.pivotTableDialogOpen = false
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
  if (!store.currentId || !canApply.value) {
    return
  }
  applying.value = true
  try {
    const result = await store.pivotTable({
      index: [...form.index],
      columns: form.columns.length ? [...form.columns] : undefined,
      values: form.values.length ? [...form.values] : undefined,
      aggfunc: form.aggfunc,
      margins: form.margins,
      marginsName: form.marginsName.trim() || 'All',
      sort: form.sort,
      name: form.name.trim() || undefined
    })
    store.pivotTableDialogOpen = false
    if (!result) {
      return
    }
    const line = t('log.pivotTableOk', {
      name: result.name,
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
    :title="t('ribbon.dataPivotTable')"
    width="480px"
    destroy-on-close
    append-to-body
    :close-on-click-modal="!applying"
  >
    <el-form label-position="top" size="small" @submit.prevent>
      <el-form-item :label="t('data.pivotIndex')">
        <el-select
          :model-value="form.index"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          style="width: 100%"
          :placeholder="t('data.pivotIndexHint')"
          @update:model-value="(names: string[]) => assignRole('index', names)"
        >
          <el-option v-for="name in optionsFor('index')" :key="name" :label="name" :value="name" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('data.pivotColumns')">
        <el-select
          :model-value="form.columns"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          clearable
          style="width: 100%"
          :placeholder="t('data.pivotColumnsHint')"
          @update:model-value="(names: string[]) => assignRole('columns', names)"
        >
          <el-option v-for="name in optionsFor('columns')" :key="name" :label="name" :value="name" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('data.pivotValues')">
        <el-select
          :model-value="form.values"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          clearable
          style="width: 100%"
          :placeholder="t('data.pivotValuesHint')"
          @update:model-value="(names: string[]) => assignRole('values', names)"
        >
          <el-option v-for="name in optionsFor('values')" :key="name" :label="name" :value="name" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('data.pivotAggfunc')">
        <el-select v-model="form.aggfunc" style="width: 100%">
          <el-option
            v-for="name in AGGFUNCS"
            :key="name"
            :label="t(`data.pivotAggfuncs.${name}`)"
            :value="name"
          />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('data.pivotMargins')">
        <el-switch v-model="form.margins" />
      </el-form-item>
      <el-form-item v-if="form.margins" :label="t('data.pivotMarginsName')">
        <el-input v-model="form.marginsName" :placeholder="t('data.pivotMarginsNameHint')" />
      </el-form-item>
      <el-form-item :label="t('data.pivotSort')">
        <el-switch v-model="form.sort" />
      </el-form-item>
      <el-form-item :label="t('data.pivotName')">
        <el-input v-model="form.name" :placeholder="t('data.pivotNameHint', { name: store.current?.name ?? '' })" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button :disabled="applying" @click="visible = false">{{ t('data.pivotCancel') }}</el-button>
      <el-button type="primary" :loading="applying" :disabled="!canApply" @click="confirm">
        {{ t('data.pivotConfirm') }}
      </el-button>
    </template>
  </el-dialog>
</template>
