<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { useDataStore } from '@/stores/data'
import { useLogStore } from '@/stores/log'
import { translateRpcError } from '@/rpc/rpcError'

const METHODS = ['log', 'sqrt', 'reciprocal', 'power', 'boxcox'] as const

type TransformMethod = (typeof METHODS)[number]

const { t, te } = useI18n()
const store = useDataStore()
const log = useLogStore()
const applying = ref(false)
const form = reactive({
  method: 'log' as TransformMethod,
  lambdaValue: 0.5,
  addOne: true,
  subset: [] as string[]
})

const visible = computed({
  get: () => store.transformSkewedDialogOpen,
  set: (open: boolean) => {
    store.transformSkewedDialogOpen = open
  }
})

const columns = computed(() => store.schema?.columns.map((col) => col.name) ?? [])
const showLambda = computed(() => form.method === 'power')

function resetForm(): void {
  form.method = 'log'
  form.lambdaValue = 0.5
  form.addOne = true
  form.subset = []
}

watch(
  () => store.currentId,
  (id) => {
    if (!id) {
      store.transformSkewedDialogOpen = false
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
    const result = await store.transformSkewed({
      method: form.method,
      lambdaValue: form.lambdaValue,
      addOne: form.addOne,
      subset: form.subset.length ? [...form.subset] : undefined
    })
    store.transformSkewedDialogOpen = false
    if (!result) {
      return
    }
    const line = t('log.transformSkewedOk', {
      name: result.name,
      count: result.transformedCount,
      changed: result.changedCount
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
    :title="t('ribbon.dataTransformSkewed')"
    width="420px"
    destroy-on-close
    append-to-body
    :close-on-click-modal="!applying"
  >
    <el-form label-position="top" size="small" @submit.prevent>
      <el-form-item :label="t('data.transformSkewedMethod')">
        <el-select v-model="form.method" style="width: 100%">
          <el-option
            v-for="name in METHODS"
            :key="name"
            :label="t(`data.transformSkewedMethods.${name}`)"
            :value="name"
          />
        </el-select>
      </el-form-item>
      <el-form-item v-if="showLambda" :label="t('data.transformSkewedLambda')">
        <el-input-number
          v-model="form.lambdaValue"
          :min="-5"
          :max="5"
          :step="0.1"
          :precision="2"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item :label="t('data.transformSkewedAddOne')">
        <el-switch v-model="form.addOne" />
      </el-form-item>
      <el-form-item :label="t('data.transformSkewedSubset')">
        <el-select
          v-model="form.subset"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          clearable
          style="width: 100%"
          :placeholder="t('data.transformSkewedSubsetHint')"
        >
          <el-option v-for="name in columns" :key="name" :label="name" :value="name" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button :disabled="applying" @click="visible = false">{{ t('data.transformSkewedCancel') }}</el-button>
      <el-button type="primary" :loading="applying" @click="confirm">{{ t('data.transformSkewedConfirm') }}</el-button>
    </template>
  </el-dialog>
</template>
