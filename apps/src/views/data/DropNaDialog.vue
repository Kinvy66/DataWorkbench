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
  how: 'any' as 'any' | 'all',
  subset: [] as string[],
  minNonNa: 0
})

const visible = computed({
  get: () => store.dropNaDialogOpen,
  set: (open: boolean) => {
    store.dropNaDialogOpen = open
  }
})

const columns = computed(() => store.schema?.columns.map((col) => col.name) ?? [])

function resetForm(): void {
  form.how = 'any'
  form.subset = []
  form.minNonNa = 0
}

watch(
  () => store.currentId,
  (id) => {
    if (!id) {
      store.dropNaDialogOpen = false
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
    const result = await store.dropNa({
      how: form.how,
      subset: form.subset.length ? [...form.subset] : undefined,
      minNonNa: Number(form.minNonNa) || 0
    })
    store.dropNaDialogOpen = false
    if (!result) {
      return
    }
    const line = t('log.dropNaOk', {
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
    :title="t('ribbon.dataDropNa')"
    width="420px"
    destroy-on-close
    append-to-body
    :close-on-click-modal="!applying"
  >
    <el-form label-position="top" size="small" @submit.prevent>
      <el-form-item :label="t('data.dropNaHow')">
        <el-select v-model="form.how" style="width: 100%">
          <el-option :label="t('data.dropNaHowAny')" value="any" />
          <el-option :label="t('data.dropNaHowAll')" value="all" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('data.dropNaSubset')">
        <el-select
          v-model="form.subset"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          clearable
          style="width: 100%"
          :placeholder="t('data.dropNaSubsetHint')"
        >
          <el-option v-for="name in columns" :key="name" :label="name" :value="name" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('data.dropNaMinNonNa')">
        <el-input-number v-model="form.minNonNa" :min="0" :step="1" :precision="0" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button :disabled="applying" @click="visible = false">{{ t('data.dropNaCancel') }}</el-button>
      <el-button type="primary" :loading="applying" @click="confirm">{{ t('data.dropNaConfirm') }}</el-button>
    </template>
  </el-dialog>
</template>
