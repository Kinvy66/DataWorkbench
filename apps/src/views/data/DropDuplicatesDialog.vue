<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { useDataStore } from '@/stores/data'
import { useLogStore } from '@/stores/log'
import { translateRpcError } from '@/rpc/rpcError'

type Keep = 'first' | 'last' | 'none'

const { t, te } = useI18n()
const store = useDataStore()
const log = useLogStore()
const applying = ref(false)
const form = reactive({
  keep: 'first' as Keep,
  subset: [] as string[]
})

const visible = computed({
  get: () => store.dropDuplicatesDialogOpen,
  set: (open: boolean) => {
    store.dropDuplicatesDialogOpen = open
  }
})

const columns = computed(() => store.schema?.columns.map((col) => col.name) ?? [])

function resetForm(): void {
  form.keep = 'first'
  form.subset = []
}

watch(
  () => store.currentId,
  (id) => {
    if (!id) {
      store.dropDuplicatesDialogOpen = false
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
    const result = await store.dropDuplicates({
      keep: form.keep,
      subset: form.subset.length ? [...form.subset] : undefined
    })
    store.dropDuplicatesDialogOpen = false
    if (!result) {
      return
    }
    const line = t('log.dropDuplicatesOk', {
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
    :title="t('ribbon.dataDropDuplicates')"
    width="420px"
    destroy-on-close
    append-to-body
    :close-on-click-modal="!applying"
  >
    <el-form label-position="top" size="small" @submit.prevent>
      <el-form-item :label="t('data.dropDuplicatesKeep')">
        <el-select v-model="form.keep" style="width: 100%">
          <el-option :label="t('data.dropDuplicatesKeepFirst')" value="first" />
          <el-option :label="t('data.dropDuplicatesKeepLast')" value="last" />
          <el-option :label="t('data.dropDuplicatesKeepNone')" value="none" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('data.dropDuplicatesSubset')">
        <el-select
          v-model="form.subset"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          clearable
          style="width: 100%"
          :placeholder="t('data.dropDuplicatesSubsetHint')"
        >
          <el-option v-for="name in columns" :key="name" :label="name" :value="name" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button :disabled="applying" @click="visible = false">{{ t('data.dropDuplicatesCancel') }}</el-button>
      <el-button type="primary" :loading="applying" @click="confirm">{{ t('data.dropDuplicatesConfirm') }}</el-button>
    </template>
  </el-dialog>
</template>
