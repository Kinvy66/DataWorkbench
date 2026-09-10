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

type ZscoreAction = (typeof ACTIONS)[number]

const { t, te } = useI18n()
const store = useDataStore()
const log = useLogStore()
const applying = ref(false)
const form = reactive({
  threshold: 3,
  robust: false,
  action: 'remove' as ZscoreAction,
  customValue: 0,
  reindex: true,
  subset: [] as string[]
})

const visible = computed({
  get: () => store.zscoreDialogOpen,
  set: (open: boolean) => {
    store.zscoreDialogOpen = open
  }
})

const columns = computed(() => store.schema?.columns.map((col) => col.name) ?? [])
const showCustom = computed(() => form.action === 'replace_custom')
const showReindex = computed(() => form.action === 'remove')

function resetForm(): void {
  form.threshold = 3
  form.robust = false
  form.action = 'remove'
  form.customValue = 0
  form.reindex = true
  form.subset = []
}

watch(
  () => store.currentId,
  (id) => {
    if (!id) {
      store.zscoreDialogOpen = false
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
    const result = await store.removeOutliersZscore({
      threshold: form.threshold,
      robust: form.robust,
      action: form.action,
      customValue: form.customValue,
      reindex: form.reindex,
      subset: form.subset.length ? [...form.subset] : undefined
    })
    store.zscoreDialogOpen = false
    if (!result) {
      return
    }
    const line =
      result.action === 'remove'
        ? t('log.zscoreRemoveOk', {
            name: result.name,
            removed: result.removedCount,
            rows: result.rows,
            cols: result.cols
          })
        : t('log.zscoreReplaceOk', {
            name: result.name,
            replaced: result.replacedCount,
            action: t(`data.zscoreActions.${result.action}`)
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
    :title="t('ribbon.dataZscore')"
    width="420px"
    destroy-on-close
    append-to-body
    :close-on-click-modal="!applying"
  >
    <el-form label-position="top" size="small" @submit.prevent>
      <el-form-item :label="t('data.zscoreThreshold')">
        <el-input-number
          v-model="form.threshold"
          :min="1"
          :max="10"
          :step="0.1"
          :precision="2"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item :label="t('data.zscoreRobust')">
        <el-switch v-model="form.robust" />
      </el-form-item>
      <el-form-item :label="t('data.zscoreAction')">
        <el-select v-model="form.action" style="width: 100%">
          <el-option
            v-for="name in ACTIONS"
            :key="name"
            :label="t(`data.zscoreActions.${name}`)"
            :value="name"
          />
        </el-select>
      </el-form-item>
      <el-form-item v-if="showCustom" :label="t('data.zscoreCustomValue')">
        <el-input-number v-model="form.customValue" :step="1" style="width: 100%" />
      </el-form-item>
      <el-form-item v-if="showReindex" :label="t('data.zscoreReindex')">
        <el-switch v-model="form.reindex" />
      </el-form-item>
      <el-form-item :label="t('data.zscoreSubset')">
        <el-select
          v-model="form.subset"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          clearable
          style="width: 100%"
          :placeholder="t('data.zscoreSubsetHint')"
        >
          <el-option v-for="name in columns" :key="name" :label="name" :value="name" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button :disabled="applying" @click="visible = false">{{ t('data.zscoreCancel') }}</el-button>
      <el-button type="primary" :loading="applying" @click="confirm">{{ t('data.zscoreConfirm') }}</el-button>
    </template>
  </el-dialog>
</template>
