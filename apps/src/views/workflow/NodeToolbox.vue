<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { useWorkflowStore } from '@/stores/workflow'
import type { WorkflowNodeType } from '@dw/rpc-types'
import { translateRpcError } from '@/rpc/rpcError'
import { i18n } from '@/i18n'

const { t } = useI18n()
const store = useWorkflowStore()

const groups = computed(() => {
  const map = new Map<string, WorkflowNodeType[]>()
  for (const item of store.types) {
    const key = item.category || t('layout.nodes')
    const list = map.get(key) ?? []
    list.push(item)
    map.set(key, list)
  }
  return [...map.entries()]
})

function onDragStart(event: DragEvent, qualifiedName: string): void {
  if (!event.dataTransfer) {
    return
  }
  event.dataTransfer.setData('application/dw-node', qualifiedName)
  event.dataTransfer.effectAllowed = 'copy'
}

async function add(qualifiedName: string): Promise<void> {
  try {
    await store.addNode(qualifiedName)
  } catch (err) {
    ElMessage.error(translateRpcError(err, (k) => String(i18n.global.t(k)), (k) => i18n.global.te(k)))
  }
}
</script>

<template>
  <div class="toolbox">
    <p v-if="!store.types.length" class="muted">{{ t('layout.nodesEmpty') }}</p>
    <section v-for="[category, items] in groups" :key="category" class="group">
      <h3>{{ category }}</h3>
      <button
        v-for="item in items"
        :key="item.qualifiedName"
        type="button"
        class="node-btn"
        draggable="true"
        :disabled="!store.canEditGraph"
        @click="add(item.qualifiedName)"
        @dragstart="onDragStart($event, item.qualifiedName)"
      >
        {{ item.name }}
      </button>
    </section>
  </div>
</template>

<style scoped>
.toolbox {
  padding: 8px 10px;
  overflow: auto;
  flex: 1;
  min-height: 0;
}
.muted {
  color: #909399;
  font-size: 13px;
}
.group {
  margin-bottom: 12px;
}
.group h3 {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 600;
  color: #909399;
}
.node-btn {
  display: block;
  width: 100%;
  text-align: left;
  margin: 0 0 4px;
  padding: 6px 8px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  background: #fff;
  cursor: grab;
  font-size: 12px;
  color: #303133;
}
.node-btn:hover:not(:disabled) {
  border-color: #5280c1;
  color: #5280c1;
}
.node-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
