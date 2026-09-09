<script setup lang="ts">
import { Splitpanes, Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import { useI18n } from 'vue-i18n'
import { useLogStore } from '@/stores/log'
import DatasetList from '@/views/DatasetList.vue'
import DatasetProperties from '@/views/DatasetProperties.vue'
import VirtualTable from '@/views/VirtualTable.vue'

const { t } = useI18n()
const log = useLogStore()

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString()
}
</script>

<template>
  <div class="workbench">
    <Splitpanes class="default-theme main-split" horizontal>
      <Pane :size="82" :min-size="40">
        <Splitpanes class="default-theme">
          <Pane :size="18" :min-size="12">
            <section class="panel">
              <header>{{ t('layout.datasets') }}</header>
              <DatasetList />
            </section>
          </Pane>
          <Pane :size="58" :min-size="30">
            <section class="panel">
              <header>{{ t('layout.table') }}</header>
              <VirtualTable />
            </section>
          </Pane>
          <Pane :size="24" :min-size="12">
            <section class="panel">
              <header>{{ t('layout.properties') }}</header>
              <DatasetProperties />
            </section>
          </Pane>
        </Splitpanes>
      </Pane>
      <Pane :size="18" :min-size="10">
        <section class="panel log-panel">
          <header>{{ t('layout.log') }}</header>
          <ol class="log-lines">
            <li v-for="line in log.lines" :key="line.id" :class="'lv-' + line.level">
              <span class="ts">{{ formatTime(line.at) }}</span>
              {{ line.message }}
            </li>
          </ol>
        </section>
      </Pane>
    </Splitpanes>
  </div>
</template>

<style scoped>
.workbench {
  flex: 1;
  min-height: 0;
}
.workbench :deep(.splitpanes) {
  height: 100%;
}
.panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #ebeef5;
  box-sizing: border-box;
}
.panel header {
  font-size: 12px;
  font-weight: 600;
  padding: 6px 10px;
  border-bottom: 1px solid #ebeef5;
  color: #303133;
  background: #f5f7fa;
}
.log-panel .log-lines {
  margin: 0;
  padding: 6px 10px;
  overflow: auto;
  flex: 1;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 12px;
  list-style: none;
}
.log-lines .ts {
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
