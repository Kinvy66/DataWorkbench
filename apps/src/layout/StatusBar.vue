<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { APP_VERSION } from '@dw/rpc-types'
import { useAppUiStore, type EngineStatus } from '@/stores/appUi'
import { useProjectStore } from '@/stores/project'

const { t } = useI18n()
const ui = useAppUiStore()
const project = useProjectStore()

const statusLabel = computed(() => t(`status.${ui.engineStatus}` as const))

function tone(status: EngineStatus): string {
  if (status === 'ready') {
    return 'ok'
  }
  if (status === 'restarting' || status === 'starting') {
    return 'busy'
  }
  return 'bad'
}

const projectLabel = computed(() => {
  const name = project.displayName || t('project.untitled')
  return project.dirty ? `*${name}` : name
})
</script>

<template>
  <footer class="status-bar" role="status">
    <span class="engine">
      <span class="dot" :class="tone(ui.engineStatus)" aria-hidden="true" />
      {{ statusLabel }}
    </span>
    <span class="project" :title="project.path ?? ''">{{ projectLabel }}</span>
    <span class="version">{{ t('app.title') }} {{ APP_VERSION }}</span>
  </footer>
</template>

<style scoped>
.status-bar {
  flex: 0 0 24px;
  height: 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 10px;
  box-sizing: border-box;
  border-top: 1px solid #dcdfe6;
  background: #f5f7fa;
  color: #606266;
  font-size: 12px;
  line-height: 1;
  user-select: none;
}
.engine {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #c0c4cc;
}
.dot.ok {
  background: #67c23a;
}
.dot.busy {
  background: #e6a23c;
}
.dot.bad {
  background: #f56c6c;
}
.project {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.version {
  flex: 0 0 auto;
  color: #909399;
}
</style>
