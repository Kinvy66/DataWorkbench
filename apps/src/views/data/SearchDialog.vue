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
  column: '',
  pattern: '',
  caseSensitive: false
})

const visible = computed({
  get: () => store.searchDialogOpen,
  set: (open: boolean) => {
    store.searchDialogOpen = open
  }
})

const columns = computed(() => store.schema?.columns.map((col) => col.name) ?? [])
const canApply = computed(() => Boolean(form.column) && Boolean(form.pattern.trim()) && !applying.value)

function resetForm(): void {
  form.column = columns.value[0] ?? ''
  form.pattern = ''
  form.caseSensitive = false
}

watch(
  () => store.currentId,
  (id) => {
    if (!id) {
      store.searchDialogOpen = false
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
  const pattern = form.pattern.trim()
  if (!store.currentId || !form.column || !pattern || applying.value) {
    return
  }
  applying.value = true
  try {
    const result = await store.search({
      column: form.column,
      pattern,
      caseSensitive: form.caseSensitive
    })
    store.searchDialogOpen = false
    if (!result) {
      return
    }
    const line = t('log.searchOk', {
      name: result.name,
      matched: result.matchedCount,
      removed: result.removedCount
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
    :title="t('ribbon.dataSearch')"
    width="420px"
    destroy-on-close
    append-to-body
    :close-on-click-modal="!applying"
  >
    <el-form label-position="top" size="small" @submit.prevent="confirm">
      <el-form-item :label="t('data.searchColumn')">
        <el-select v-model="form.column" filterable style="width: 100%" :placeholder="t('data.searchColumnHint')">
          <el-option v-for="name in columns" :key="name" :label="name" :value="name" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('data.searchPattern')">
        <el-input v-model="form.pattern" :placeholder="t('data.searchPlaceholder')" />
      </el-form-item>
      <el-form-item>
        <el-checkbox v-model="form.caseSensitive">{{ t('data.searchCaseSensitive') }}</el-checkbox>
      </el-form-item>
      <p class="hint">{{ t('data.searchHint') }}</p>
    </el-form>
    <template #footer>
      <el-button :disabled="applying" @click="visible = false">{{ t('data.searchCancel') }}</el-button>
      <el-button type="primary" :loading="applying" :disabled="!canApply" @click="confirm">
        {{ t('data.searchConfirm') }}
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
