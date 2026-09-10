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
  percentiles: '0.25, 0.5, 0.75',
  name: ''
})

const visible = computed({
  get: () => store.describeDialogOpen,
  set: (open: boolean) => {
    store.describeDialogOpen = open
  }
})

function resetForm(): void {
  form.percentiles = '0.25, 0.5, 0.75'
  form.name = ''
}

watch(
  () => store.currentId,
  (id) => {
    if (!id) {
      store.describeDialogOpen = false
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
    const result = await store.describe({
      percentiles: form.percentiles,
      name: form.name.trim() || undefined
    })
    store.describeDialogOpen = false
    if (!result) {
      return
    }
    const line = t('log.describeOk', {
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
    :title="t('ribbon.dataDescribe')"
    width="420px"
    destroy-on-close
    append-to-body
    :close-on-click-modal="!applying"
  >
    <el-form label-position="top" size="small" @submit.prevent>
      <el-form-item :label="t('data.describePercentiles')">
        <el-input v-model="form.percentiles" :placeholder="t('data.describePercentilesHint')" />
      </el-form-item>
      <el-form-item :label="t('data.describeName')">
        <el-input v-model="form.name" :placeholder="t('data.describeNameHint', { name: store.current?.name ?? '' })" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button :disabled="applying" @click="visible = false">{{ t('data.describeCancel') }}</el-button>
      <el-button type="primary" :loading="applying" @click="confirm">{{ t('data.describeConfirm') }}</el-button>
    </template>
  </el-dialog>
</template>
