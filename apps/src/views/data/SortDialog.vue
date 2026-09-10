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
  columns: [] as string[],
  ascending: true
})

const visible = computed({
  get: () => store.sortDialogOpen,
  set: (open: boolean) => {
    store.sortDialogOpen = open
  }
})

const columns = computed(() => store.schema?.columns.map((col) => col.name) ?? [])
const canApply = computed(() => form.columns.length > 0 && !applying.value)

function resetForm(): void {
  form.columns = []
  form.ascending = true
}

watch(
  () => store.currentId,
  (id) => {
    if (!id) {
      store.sortDialogOpen = false
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
  const selected = [...form.columns]
  const ascending = form.ascending
  try {
    const result = await store.sort({
      columns: selected,
      ascending
    })
    store.sortDialogOpen = false
    if (!result) {
      return
    }
    const line = t('log.sortOk', {
      name: result.name,
      columns: selected.join(', '),
      order: ascending ? t('data.sortAscending') : t('data.sortDescending')
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
    :title="t('ribbon.dataSort')"
    width="420px"
    destroy-on-close
    append-to-body
    :close-on-click-modal="!applying"
  >
    <el-form label-position="top" size="small" @submit.prevent>
      <el-form-item :label="t('data.sortColumns')">
        <el-select
          v-model="form.columns"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          style="width: 100%"
          :placeholder="t('data.sortColumnsHint')"
        >
          <el-option v-for="name in columns" :key="name" :label="name" :value="name" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('data.sortOrder')">
        <el-switch
          v-model="form.ascending"
          :active-text="t('data.sortAscending')"
          :inactive-text="t('data.sortDescending')"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button :disabled="applying" @click="visible = false">{{ t('data.sortCancel') }}</el-button>
      <el-button type="primary" :loading="applying" :disabled="!canApply" @click="confirm">
        {{ t('data.sortConfirm') }}
      </el-button>
    </template>
  </el-dialog>
</template>
