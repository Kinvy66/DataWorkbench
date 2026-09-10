<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { useDataStore } from '@/stores/data'
import { useLogStore } from '@/stores/log'
import { translateRpcError } from '@/rpc/rpcError'

const ACTIONS = [
  'remove',
  'replace_mean',
  'replace_median',
  'replace_boundary',
  'replace_custom'
] as const

type IqrAction = (typeof ACTIONS)[number]

const { t, te } = useI18n()
const store = useDataStore()
const log = useLogStore()
const applying = ref(false)
const form = reactive({
  multiplier: 1.5,
  action: 'remove' as IqrAction,
  customValue: 0,
  reindex: true,
  subset: [] as string[]
})

const visible = computed({
  get: () => store.iqrDialogOpen,
  set: (open: boolean) => {
    store.iqrDialogOpen = open
  }
})

const columns = computed(() => store.schema?.columns.map((col) => col.name) ?? [])
const showCustom = computed(() => form.action === 'replace_custom')
const showReindex = computed(() => form.action === 'remove')

function resetForm(): void {
  form.multiplier = 1.5
  form.action = 'remove'
  form.customValue = 0
  form.reindex = true
  form.subset = []
}

watch(
  () => store.currentId,
  (id) => {
    if (!id) {
      store.iqrDialogOpen = false
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
    const result = await store.removeOutliersIqr({
      multiplier: form.multiplier,
      action: form.action,
      customValue: form.customValue,
      reindex: form.reindex,
      subset: form.subset.length ? [...form.subset] : undefined
    })
    store.iqrDialogOpen = false
    if (!result) {
      return
    }
    const line =
      result.action === 'remove'
        ? t('log.iqrRemoveOk', {
            name: result.name,
            removed: result.removedCount,
            rows: result.rows,
            cols: result.cols
          })
        : t('log.iqrReplaceOk', {
            name: result.name,
            replaced: result.replacedCount,
            action: t(`data.iqrActions.${result.action}`)
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
    :title="t('ribbon.dataIqr')"
    width="420px"
    destroy-on-close
    append-to-body
    :close-on-click-modal="!applying"
  >
    <el-form label-position="top" size="small" @submit.prevent>
      <el-form-item :label="t('data.iqrMultiplier')">
        <el-input-number
          v-model="form.multiplier"
          :min="0.5"
          :max="10"
          :step="0.1"
          :precision="2"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item :label="t('data.iqrAction')">
        <el-select v-model="form.action" style="width: 100%">
          <el-option
            v-for="name in ACTIONS"
            :key="name"
            :label="t(`data.iqrActions.${name}`)"
            :value="name"
          />
        </el-select>
      </el-form-item>
      <el-form-item v-if="showCustom" :label="t('data.iqrCustomValue')">
        <el-input-number v-model="form.customValue" :step="1" style="width: 100%" />
      </el-form-item>
      <el-form-item v-if="showReindex" :label="t('data.iqrReindex')">
        <el-switch v-model="form.reindex" />
      </el-form-item>
      <el-form-item :label="t('data.iqrSubset')">
        <el-select
          v-model="form.subset"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          clearable
          style="width: 100%"
          :placeholder="t('data.iqrSubsetHint')"
        >
          <el-option v-for="name in columns" :key="name" :label="name" :value="name" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button :disabled="applying" @click="visible = false">{{ t('data.iqrCancel') }}</el-button>
      <el-button type="primary" :loading="applying" @click="confirm">{{ t('data.iqrConfirm') }}</el-button>
    </template>
  </el-dialog>
</template>
