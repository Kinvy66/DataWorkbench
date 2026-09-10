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
  useMin: false,
  useMax: false,
  min: 0,
  max: 0
})

const visible = computed({
  get: () => store.filterByColumnDialogOpen,
  set: (open: boolean) => {
    store.filterByColumnDialogOpen = open
  }
})

const columns = computed(() => store.schema?.columns.map((col) => col.name) ?? [])
const canApply = computed(() => Boolean(form.column) && !applying.value)

function resetForm(): void {
  form.column = columns.value[0] ?? ''
  form.useMin = false
  form.useMax = false
  form.min = 0
  form.max = 0
}

watch(
  () => store.currentId,
  (id) => {
    if (!id) {
      store.filterByColumnDialogOpen = false
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
    const result = await store.filterByColumn({
      column: form.column,
      min: form.useMin ? form.min : null,
      max: form.useMax ? form.max : null
    })
    store.filterByColumnDialogOpen = false
    if (!result) {
      return
    }
    const line = t('log.filterByColumnOk', {
      name: result.name,
      matched: result.matchedCount,
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
    :title="t('ribbon.dataFilterByColumn')"
    width="420px"
    destroy-on-close
    append-to-body
    :close-on-click-modal="!applying"
  >
    <el-form label-position="top" size="small" @submit.prevent>
      <el-form-item :label="t('data.filterByColumnColumn')">
        <el-select
          v-model="form.column"
          filterable
          style="width: 100%"
          :placeholder="t('data.filterByColumnColumnHint')"
        >
          <el-option v-for="name in columns" :key="name" :label="name" :value="name" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('data.filterByColumnMin')">
        <div class="bound-row">
          <el-switch v-model="form.useMin" />
          <el-input-number v-model="form.min" :disabled="!form.useMin" :step="1" style="flex: 1" />
        </div>
      </el-form-item>
      <el-form-item :label="t('data.filterByColumnMax')">
        <div class="bound-row">
          <el-switch v-model="form.useMax" />
          <el-input-number v-model="form.max" :disabled="!form.useMax" :step="1" style="flex: 1" />
        </div>
      </el-form-item>
      <p class="hint">{{ t('data.filterByColumnBoundHint') }}</p>
    </el-form>
    <template #footer>
      <el-button :disabled="applying" @click="visible = false">{{ t('data.filterByColumnCancel') }}</el-button>
      <el-button type="primary" :loading="applying" :disabled="!canApply" @click="confirm">
        {{ t('data.filterByColumnConfirm') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.bound-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.hint {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.4;
}
</style>
