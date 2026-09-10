<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { useDataStore } from '@/stores/data'
import { useLogStore } from '@/stores/log'
import { translateRpcError } from '@/rpc/rpcError'

const METHODS = [
  'linear',
  'time',
  'index',
  'pad',
  'nearest',
  'zero',
  'slinear',
  'quadratic',
  'cubic',
  'spline',
  'barycentric',
  'polynomial',
  'krogh',
  'piecewise_polynomial',
  'pchip',
  'akima'
] as const

type InterpolateMethod = (typeof METHODS)[number]

const { t, te } = useI18n()
const store = useDataStore()
const log = useLogStore()
const applying = ref(false)
const form = reactive({
  method: 'linear' as InterpolateMethod,
  order: 3,
  limit: 0,
  subset: [] as string[]
})

const visible = computed({
  get: () => store.interpolateDialogOpen,
  set: (open: boolean) => {
    store.interpolateDialogOpen = open
  }
})

const columns = computed(() => store.schema?.columns.map((col) => col.name) ?? [])
const showOrder = computed(() => form.method === 'spline' || form.method === 'polynomial')

function resetForm(): void {
  form.method = 'linear'
  form.order = 3
  form.limit = 0
  form.subset = []
}

watch(
  () => store.currentId,
  (id) => {
    if (!id) {
      store.interpolateDialogOpen = false
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
    const result = await store.interpolate({
      method: form.method,
      subset: form.subset.length ? [...form.subset] : undefined,
      limit: form.limit > 0 ? form.limit : undefined,
      order: form.order
    })
    store.interpolateDialogOpen = false
    if (!result) {
      return
    }
    const line = t('log.interpolateOk', {
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
    :title="t('ribbon.dataInterpolate')"
    width="420px"
    destroy-on-close
    append-to-body
    :close-on-click-modal="!applying"
  >
    <el-form label-position="top" size="small" @submit.prevent>
      <el-form-item :label="t('data.interpolateMethod')">
        <el-select v-model="form.method" style="width: 100%">
          <el-option
            v-for="name in METHODS"
            :key="name"
            :label="t(`data.interpolateMethods.${name}`)"
            :value="name"
          />
        </el-select>
      </el-form-item>
      <el-form-item v-if="showOrder" :label="t('data.interpolateOrder')">
        <el-input-number v-model="form.order" :min="1" :max="10" :step="1" style="width: 100%" />
      </el-form-item>
      <el-form-item :label="t('data.interpolateLimit')">
        <el-input-number v-model="form.limit" :min="0" :max="10000" :step="1" style="width: 100%" />
      </el-form-item>
      <el-form-item :label="t('data.interpolateSubset')">
        <el-select
          v-model="form.subset"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          clearable
          style="width: 100%"
          :placeholder="t('data.interpolateSubsetHint')"
        >
          <el-option v-for="name in columns" :key="name" :label="name" :value="name" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button :disabled="applying" @click="visible = false">{{ t('data.interpolateCancel') }}</el-button>
      <el-button type="primary" :loading="applying" @click="confirm">{{ t('data.interpolateConfirm') }}</el-button>
    </template>
  </el-dialog>
</template>
