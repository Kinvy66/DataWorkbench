<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { ElConfigProvider, ElMessage } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import enLocale from 'element-plus/es/locale/lang/en'
import { useI18n } from 'vue-i18n'
import AppRibbon from '@/ribbon/AppRibbon.vue'
import WorkbenchLayout from '@/layout/WorkbenchLayout.vue'
import StatusBar from '@/layout/StatusBar.vue'
import { commandBus } from '@/commands/commandBus'
import {
  confirmAndQuit,
  freezeAfterSidecarDeath,
  openProject,
  recoverAfterSidecarRestart,
  syncDocumentTitle
} from '@/project/session'
import { useLogStore } from '@/stores/log'
import { useDataStore } from '@/stores/data'
import { useProjectStore } from '@/stores/project'
import { useWorkflowStore } from '@/stores/workflow'
import { useAppUiStore } from '@/stores/appUi'
import { translateRpcError } from '@/rpc/rpcError'
import { getDesktopBridge } from '@/rpc/bridge'
import DwIcon from '@/icons/DwIcon.vue'
import type { HostCrashedParams, WorkflowFinishedParams, WorkflowNodeStateParams } from '@dw/rpc-types'

const { t, locale, te } = useI18n()
const epLocale = computed(() => (locale.value === 'zh-CN' ? zhCn : enLocale))
const log = useLogStore()
const data = useDataStore()
const workflow = useWorkflowStore()
const project = useProjectStore()
const ui = useAppUiStore()
const offs: Array<() => void> = []
let pendingOpenPath: string | null = null

const startupCopy = computed(() => {
  if (ui.engineStatus === 'restarting') {
    return t('startup.restarting')
  }
  if (ui.engineStatus === 'failed') {
    return t('startup.failed')
  }
  if (ui.engineStatus === 'stopped') {
    return t('startup.stopped')
  }
  return t('startup.starting')
})

watch(
  () => [project.path, project.dirty, locale.value] as const,
  () => {
    void syncDocumentTitle()
  },
  { immediate: true }
)

function tryOpenQueued(): void {
  if (!pendingOpenPath || !ui.engineReady) {
    return
  }
  const filePath = pendingOpenPath
  pendingOpenPath = null
  void openProject(filePath)
}

onMounted(() => {
  const onKey = (event: KeyboardEvent): void => {
    const target = event.target
    if (target instanceof HTMLElement) {
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) {
        return
      }
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return
      }
      event.preventDefault()
      void commandBus.dispatch('edit.delete')
      return
    }
    if (!(event.ctrlKey || event.metaKey)) {
      return
    }
    const key = event.key.toLowerCase()
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault()
      void commandBus.dispatch('edit.undo')
      return
    }
    if (key === 'y' || (key === 'z' && event.shiftKey)) {
      event.preventDefault()
      void commandBus.dispatch('edit.redo')
      return
    }
    if (key === 'c' && !event.shiftKey) {
      event.preventDefault()
      void commandBus.dispatch('edit.copy')
      return
    }
    if (key === 'x' && !event.shiftKey) {
      event.preventDefault()
      void commandBus.dispatch('edit.cut')
      return
    }
    if (key === 'v' && !event.shiftKey) {
      event.preventDefault()
      void commandBus.dispatch('edit.paste')
      return
    }
    if (key === 'a' && !event.shiftKey) {
      event.preventDefault()
      void commandBus.dispatch('edit.selectAll')
      return
    }
    if (key === 's') {
      event.preventDefault()
      void commandBus.dispatch(event.shiftKey ? 'file.saveAs' : 'file.save')
      return
    }
    if (key === 'o') {
      event.preventDefault()
      void commandBus.dispatch('file.open')
      return
    }
    if (key === 'n') {
      event.preventDefault()
      void commandBus.dispatch('file.new')
    }
  }
  window.addEventListener('keydown', onKey)
  offs.push(() => window.removeEventListener('keydown', onKey))

  let rpc: NonNullable<Window['dw']>['rpc']
  try {
    rpc = getDesktopBridge().rpc
  } catch (err) {
    ui.setEngineStatus('failed')
    log.append('error', translateRpcError(err, t, te))
    return
  }
  offs.push(
    rpc.on('app.closeRequested', () => {
      void confirmAndQuit()
    })
  )
  offs.push(
    rpc.on('app.openFile', (params) => {
      const p = params as { path?: string }
      if (typeof p.path === 'string' && p.path.trim()) {
        pendingOpenPath = p.path.trim()
        tryOpenQueued()
      }
    })
  )
  let sidecarGeneration = 0
  offs.push(
    rpc.on('host.crashed', (params) => {
      const p = params as HostCrashedParams
      void freezeAfterSidecarDeath()
      if (p.willRestart) {
        ui.setEngineStatus('restarting')
        log.append('warning', t('log.sidecarCrashed'))
        return
      }
      ui.setEngineStatus('stopped')
      const line = t('log.sidecarDead')
      log.append('error', line)
      ElMessage.error(line)
    })
  )
  offs.push(
    rpc.on('host.startFailed', () => {
      ui.setEngineStatus('failed')
      const line = t('log.engineStartFailed')
      log.append('error', line)
      ElMessage.error(line)
    })
  )
  offs.push(
    rpc.on('host.ready', () => {
      log.append('info', t('log.ready'))
      ui.setEngineStatus('ready')
      sidecarGeneration += 1
      if (sidecarGeneration === 1) {
        void data.refreshList().catch(() => {})
        void workflow.bootstrap().catch(() => {})
        tryOpenQueued()
        return
      }
      void recoverAfterSidecarRestart().then(() => {
        tryOpenQueued()
      })
    })
  )
  offs.push(
    rpc.on('workflow.nodeState', (params) => {
      const p = params as WorkflowNodeStateParams
      workflow.applyNodeState(p.workflowId, p.nodeId, p.state, p.displayText)
    })
  )
  offs.push(
    rpc.on('workflow.finished', (params) => {
      const p = params as WorkflowFinishedParams
      workflow.applyFinished(p.workflowId, Boolean(p.ok))
      void data.refreshList().catch(() => {})
      if (p.cancelled) {
        log.append('info', t('log.workflowStopped'))
      } else if (p.ok) {
        log.append('info', t('log.workflowFinished'))
      } else {
        log.append('error', t('log.workflowFailed', { error: p.error ?? '' }))
      }
    })
  )
  offs.push(
    rpc.on('log.line', (params) => {
      const p = params as { level?: string; message?: string }
      const level = p.level === 'error' || p.level === 'warning' ? p.level : 'info'
      log.append(level, p.message ?? '')
    })
  )
  offs.push(
    rpc.on('log.protocolPollution', () => {
      log.append('warning', t('log.pollution'))
    })
  )
  void rpc.invoke('app.rendererReady').catch(() => {
    // Without the handshake, startup log.line / host.ready stay queued in main.
  })
  void data.refreshList().catch(() => {
    // Sidecar may still be spawning; host.ready retries below.
  })
  void workflow.bootstrap().catch(() => {})
})

onUnmounted(() => {
  for (const off of offs) {
    off()
  }
})
</script>

<template>
  <el-config-provider :locale="epLocale">
    <div class="app-root">
      <AppRibbon />
      <div class="app-body">
        <WorkbenchLayout />
        <StatusBar />
        <div v-if="!ui.engineReady" class="startup-mask" role="status">
          <DwIcon name="app/icon" :size="40" />
          <p>{{ startupCopy }}</p>
        </div>
      </div>
    </div>
  </el-config-provider>
</template>

<style scoped>
.app-body {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.startup-mask {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: color-mix(in srgb, #f0f2f5 88%, transparent);
  color: #303133;
  font-size: 14px;
}
.startup-mask p {
  margin: 0;
  color: #606266;
}
</style>
