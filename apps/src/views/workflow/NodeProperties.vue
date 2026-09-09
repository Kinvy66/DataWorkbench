<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import type { WorkflowParamSpec } from '@dw/rpc-types'
import { useWorkflowStore } from '@/stores/workflow'
import { translateRpcError } from '@/rpc/rpcError'
import DwIcon from '@/icons/DwIcon.vue'

const { t, te } = useI18n()
const store = useWorkflowStore()
const draft = ref<Record<string, unknown>>({})
let debounceTimer: ReturnType<typeof setTimeout> | undefined

const nodeId = computed(() => store.selectedNodeId)
const spec = computed(() => store.selectedType)
const parameters = computed(() => spec.value?.parameters ?? [])

watch(
  () => [store.selectedNodeId, store.paramValues[store.selectedNodeId ?? '']],
  () => {
    const id = store.selectedNodeId
    draft.value = id ? { ...(store.paramValues[id] ?? {}) } : {}
  },
  { immediate: true, deep: true }
)

function report(err: unknown): void {
  ElMessage.error(translateRpcError(err, t, te))
}

function controlKind(param: WorkflowParamSpec): 'number' | 'switch' | 'select' | 'textarea' | 'input' {
  if (param.choices?.length) {
    return 'select'
  }
  if (param.type === 'bool') {
    return 'switch'
  }
  if (param.type === 'int' || param.type === 'float') {
    return 'number'
  }
  if (param.type === 'code' || param.layout === 'below') {
    return 'textarea'
  }
  return 'input'
}

function commit(name: string, value: unknown, immediate = false): void {
  const id = nodeId.value
  if (!id) {
    return
  }
  draft.value = { ...draft.value, [name]: value }
  const send = () => {
    void store.setParam(id, name, value).catch(report)
  }
  if (immediate) {
    send()
    return
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  debounceTimer = setTimeout(send, 300)
}
</script>

<template>
  <div v-if="!nodeId || !spec" class="empty">
    <DwIcon name="gui/setting" :size="48" />
    <p class="muted">{{ t('layout.propertiesEmpty') }}</p>
  </div>
  <div v-else class="form">
    <p class="node-name">{{ spec.name }}</p>
    <el-form label-position="top" size="small" @submit.prevent>
      <el-form-item v-for="param in parameters" :key="param.name" :label="param.name">
        <el-input-number
          v-if="controlKind(param) === 'number'"
          :model-value="Number(draft[param.name] ?? 0)"
          :min="param.min"
          :max="param.max"
          :step="param.step ?? (param.type === 'int' ? 1 : 0.1)"
          :precision="param.type === 'int' ? 0 : param.decimals"
          :disabled="!store.canEditGraph"
          controls-position="right"
          @change="(v: number | undefined) => commit(param.name, v ?? 0)"
        />
        <el-switch
          v-else-if="controlKind(param) === 'switch'"
          :model-value="Boolean(draft[param.name])"
          :disabled="!store.canEditGraph"
          @change="(v: string | number | boolean) => commit(param.name, Boolean(v), true)"
        />
        <el-select
          v-else-if="controlKind(param) === 'select'"
          :model-value="String(draft[param.name] ?? '')"
          :disabled="!store.canEditGraph"
          @change="(v: string) => commit(param.name, v, true)"
        >
          <el-option v-for="choice in param.choices" :key="choice" :label="choice" :value="choice" />
        </el-select>
        <el-input
          v-else-if="controlKind(param) === 'textarea'"
          type="textarea"
          :autosize="{ minRows: 3, maxRows: 8 }"
          :disabled="!store.canEditGraph"
          :model-value="String(draft[param.name] ?? '')"
          @input="(v: string) => commit(param.name, v)"
        />
        <el-input
          v-else
          :disabled="!store.canEditGraph"
          :model-value="String(draft[param.name] ?? '')"
          @input="(v: string) => commit(param.name, v)"
        />
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped>
.empty {
  margin: 16px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  opacity: 0.85;
}
.muted {
  margin: 8px 0 0;
  color: #909399;
  font-size: 13px;
}
.form {
  padding: 8px 10px;
  overflow: auto;
  flex: 1;
  min-height: 0;
}
.node-name {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
}
.el-input-number,
.el-select {
  width: 100%;
}
</style>
