<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { useDataStore } from '@/stores/data'
import { useLogStore } from '@/stores/log'
import { translateRpcError } from '@/rpc/rpcError'

const { t, te } = useI18n()
const store = useDataStore()
const log = useLogStore()
const applying = ref(false)
const form = reactive({
  oldValues: '',
  newValue: '',
  subset: [] as string[],
  caseSensitive: true
})

const visible = computed({
  get: () => store.replaceValuesDialogOpen,
  set: (open: boolean) => {
    store.replaceValuesDialogOpen = open
  }
})

const columns = computed(() => store.schema?.columns.map((col) => col.name) ?? [])
const canApply = computed(() => Boolean(form.oldValues.trim()) && !applying.value)

function resetForm(): void {
  form.oldValues = ''
  form.newValue = ''
  form.subset = []
  form.caseSensitive = true
}

watch(
  () => store.currentId,
  (id) => {
    if (!id) {
      store.replaceValuesDialogOpen = false
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
    return ''
  }
  const asNumber = Number(text)
  return Number.isFinite(asNumber) ? asNumber : raw
}

async function confirm(): Promise<void> {
  const oldValues = form.oldValues.trim()
  if (!store.currentId || !oldValues || applying.value) {
    return
  }
  applying.value = true
  try {
    const result = await store.replaceValues({
      oldValues,
      newValue: parseValue(form.newValue),
      subset: form.subset.length ? [...form.subset] : undefined,
      caseSensitive: form.caseSensitive
    })
    store.replaceValuesDialogOpen = false
    if (!result) {
      return
    }
    const line = t('log.replaceValuesOk', {
      name: result.name,
      replaced: result.replacedCount
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
    :title="t('ribbon.dataReplaceValues')"
    width="420px"
    destroy-on-close
    append-to-body
    :close-on-click-modal="!applying"
  >
    <el-form label-position="top" size="small" @submit.prevent>
      <el-form-item :label="t('data.replaceOldValues')">
        <el-input v-model="form.oldValues" :placeholder="t('data.replaceOldValuesHint')" />
      </el-form-item>
      <el-form-item :label="t('data.replaceNewValue')">
        <el-input v-model="form.newValue" :placeholder="t('data.replaceNewValueHint')" />
      </el-form-item>
      <el-form-item :label="t('data.replaceSubset')">
        <el-select
          v-model="form.subset"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          clearable
          style="width: 100%"
          :placeholder="t('data.replaceSubsetHint')"
        >
          <el-option v-for="name in columns" :key="name" :label="name" :value="name" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('data.replaceCaseSensitive')">
        <el-switch v-model="form.caseSensitive" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button :disabled="applying" @click="visible = false">{{ t('data.replaceCancel') }}</el-button>
      <el-button type="primary" :loading="applying" :disabled="!canApply" @click="confirm">{{
        t('data.replaceConfirm')
      }}</el-button>
    </template>
  </el-dialog>
</template>
