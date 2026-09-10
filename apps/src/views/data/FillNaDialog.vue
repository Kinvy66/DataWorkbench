<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { useDataStore } from '@/stores/data'
import { useLogStore } from '@/stores/log'
import { translateRpcError } from '@/rpc/rpcError'

type FillMethod = 'value' | 'forward' | 'backward' | 'mean' | 'median' | 'mode'

const { t, te } = useI18n()
const store = useDataStore()
const log = useLogStore()
const applying = ref(false)
const form = reactive({
  method: 'value' as FillMethod,
  value: '0',
  subset: [] as string[]
})

const visible = computed({
  get: () => store.fillNaDialogOpen,
  set: (open: boolean) => {
    store.fillNaDialogOpen = open
  }
})

const columns = computed(() => store.schema?.columns.map((col) => col.name) ?? [])
const showValue = computed(() => form.method === 'value')

function resetForm(): void {
  form.method = 'value'
  form.value = '0'
  form.subset = []
}

watch(
  () => store.currentId,
  (id) => {
    if (!id) {
      store.fillNaDialogOpen = false
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

function parseValue(raw: string): string | number {
  const text = raw.trim()
  if (text === '') {
    return 0
  }
  const asNumber = Number(text)
  return Number.isFinite(asNumber) && text !== '' ? asNumber : raw
}

async function confirm(): Promise<void> {
  if (!store.currentId || applying.value) {
    return
  }
  applying.value = true
  try {
    const result = await store.fillNa({
      method: form.method,
      subset: form.subset.length ? [...form.subset] : undefined,
      value: form.method === 'value' ? parseValue(form.value) : 0
    })
    store.fillNaDialogOpen = false
    if (!result) {
      return
    }
    const line = t('log.fillNaOk', {
      name: result.name,
      filled: result.filledCount
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
    :title="t('ribbon.dataFillNa')"
    width="420px"
    destroy-on-close
    append-to-body
    :close-on-click-modal="!applying"
  >
    <el-form label-position="top" size="small" @submit.prevent>
      <el-form-item :label="t('data.fillNaMethod')">
        <el-select v-model="form.method" style="width: 100%">
          <el-option :label="t('data.fillNaMethodValue')" value="value" />
          <el-option :label="t('data.fillNaMethodForward')" value="forward" />
          <el-option :label="t('data.fillNaMethodBackward')" value="backward" />
          <el-option :label="t('data.fillNaMethodMean')" value="mean" />
          <el-option :label="t('data.fillNaMethodMedian')" value="median" />
          <el-option :label="t('data.fillNaMethodMode')" value="mode" />
        </el-select>
      </el-form-item>
      <el-form-item v-if="showValue" :label="t('data.fillNaValue')">
        <el-input v-model="form.value" />
      </el-form-item>
      <el-form-item :label="t('data.fillNaSubset')">
        <el-select
          v-model="form.subset"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          clearable
          style="width: 100%"
          :placeholder="t('data.fillNaSubsetHint')"
        >
          <el-option v-for="name in columns" :key="name" :label="name" :value="name" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button :disabled="applying" @click="visible = false">{{ t('data.fillNaCancel') }}</el-button>
      <el-button type="primary" :loading="applying" @click="confirm">{{ t('data.fillNaConfirm') }}</el-button>
    </template>
  </el-dialog>
</template>
