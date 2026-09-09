<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDataStore } from '@/stores/data'
import DwIcon from '@/icons/DwIcon.vue'

const { t } = useI18n()
const store = useDataStore()
const current = computed(() => store.current)
const columns = computed(() => store.schema?.columns ?? [])
</script>

<template>
  <div v-if="!current" class="empty">
    <DwIcon name="gui/setting" :size="48" />
    <p class="muted">{{ t('layout.propertiesEmpty') }}</p>
  </div>
  <div v-else class="props">
    <dl>
      <div>
        <dt>{{ t('layout.name') }}</dt>
        <dd>{{ current.name }}</dd>
      </div>
      <div>
        <dt>{{ t('layout.size') }}</dt>
        <dd>{{ t('layout.shape', { rows: current.rows, cols: current.cols }) }}</dd>
      </div>
    </dl>
    <table v-if="columns.length" class="cols">
      <thead>
        <tr>
          <th>{{ t('layout.column') }}</th>
          <th>{{ t('layout.dtype') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="col in columns" :key="col.name">
          <td>{{ col.name }}</td>
          <td class="dtype">{{ col.dtype }}</td>
        </tr>
      </tbody>
    </table>
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
.props {
  padding: 8px 10px;
  overflow: auto;
  flex: 1;
  min-height: 0;
}
dl {
  margin: 0 0 10px;
}
dl > div {
  display: flex;
  gap: 8px;
  font-size: 12px;
  margin-bottom: 4px;
}
dt {
  color: #909399;
  min-width: 56px;
}
dd {
  margin: 0;
  color: #303133;
  word-break: break-all;
}
.cols {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.cols th,
.cols td {
  text-align: left;
  padding: 4px 6px;
  border-bottom: 1px solid #ebeef5;
}
.cols th {
  color: #909399;
  font-weight: 600;
}
.dtype {
  font-family: Consolas, 'Courier New', monospace;
  color: #606266;
}
</style>
