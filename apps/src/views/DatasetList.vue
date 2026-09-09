<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { useDataStore } from '@/stores/data'
import { translateRpcError } from '@/rpc/rpcError'
import DwIcon from '@/icons/DwIcon.vue'

const { t, te } = useI18n()
const store = useDataStore()
const renamingId = ref<string | null>(null)
const renameText = ref('')
const renameInput = ref<HTMLInputElement | null>(null)

const items = computed(() => store.datasets)

function onSelect(id: string): void {
  if (renamingId.value === id) {
    return
  }
  void store.select(id)
}

async function startRename(id: string, name: string): Promise<void> {
  renamingId.value = id
  renameText.value = name
  await nextTick()
  renameInput.value?.focus()
}

async function commitRename(): Promise<void> {
  const id = renamingId.value
  const name = renameText.value.trim()
  renamingId.value = null
  if (!id || !name) {
    return
  }
  try {
    await store.rename(id, name)
  } catch (err) {
    ElMessage.error(translateRpcError(err, (k) => String(t(k)), (k) => te(k)))
  }
}

function cancelRename(): void {
  renamingId.value = null
}

function shape(rows: number, cols: number): string {
  return t('layout.shape', { rows, cols })
}
</script>

<template>
  <div class="dataset-list">
    <div v-if="items.length === 0" class="empty">
      <DwIcon name="gui/data" :size="48" />
      <p class="muted">{{ t('layout.datasetsEmpty') }}</p>
    </div>
    <ul v-else class="items">
      <li
        v-for="item in items"
        :key="item.id"
        :class="['item', { selected: item.id === store.currentId }]"
        @click="onSelect(item.id)"
        @dblclick="startRename(item.id, item.name)"
      >
        <DwIcon name="gui/data-table" :size="16" />
        <div class="meta">
          <input
            v-if="renamingId === item.id"
            ref="renameInput"
            v-model="renameText"
            class="rename"
            @blur="commitRename"
            @keydown.enter.prevent="commitRename"
            @keydown.esc.prevent="cancelRename"
            @click.stop
          />
          <span v-else class="name" :title="item.name">{{ item.name }}</span>
          <span class="shape">{{ shape(item.rows, item.cols) }}</span>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.dataset-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
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
.items {
  list-style: none;
  margin: 0;
  padding: 4px;
}
.item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
}
.item:hover {
  background: #f5f7fa;
}
.item.selected {
  background: #ecf2fb;
}
.meta {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.name {
  font-size: 13px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.shape {
  font-size: 11px;
  color: #909399;
}
.rename {
  width: 100%;
  box-sizing: border-box;
  font-size: 13px;
  border: 1px solid var(--dw-accent, #5280c1);
  border-radius: 2px;
  padding: 1px 4px;
}
</style>
