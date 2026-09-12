<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useLogStore } from '@/stores/log'

const { t } = useI18n()
const log = useLogStore()
const { lines } = storeToRefs(log)

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString()
}
</script>

<template>
  <section class="dock-panel log-panel">
    <p v-if="lines.length === 0" class="empty">{{ t('layout.logEmpty') }}</p>
    <ol v-else class="log-lines">
      <li v-for="line in lines" :key="line.id" :class="'lv-' + line.level">
        <span class="ts">{{ formatTime(line.at) }}</span>
        {{ line.message }}
      </li>
    </ol>
  </section>
</template>

<style scoped>
.dock-panel {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  box-sizing: border-box;
  color: #303133;
}
.empty {
  margin: 16px 12px;
  color: #909399;
  font-size: 13px;
}
.log-lines {
  margin: 0;
  padding: 6px 10px;
  overflow: auto;
  flex: 1;
  min-height: 0;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 12px;
  list-style: none;
  color: #303133;
}
.ts {
  color: #909399;
  margin-right: 8px;
}
.lv-warning {
  color: #b88230;
}
.lv-error {
  color: #c45656;
}
</style>
