<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { ElConfigProvider } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import enLocale from 'element-plus/es/locale/lang/en'
import { useI18n } from 'vue-i18n'
import AppRibbon from '@/ribbon/AppRibbon.vue'
import WorkbenchLayout from '@/layout/WorkbenchLayout.vue'
import { commandBus } from '@/commands/commandBus'
import { confirmAndQuit, syncDocumentTitle } from '@/project/session'
import { useLogStore } from '@/stores/log'
import { useDataStore } from '@/stores/data'
import { useProjectStore } from '@/stores/project'
import { useWorkflowStore } from '@/stores/workflow'
import { translateRpcError } from '@/rpc/rpcError'
import { getDesktopBridge } from '@/rpc/bridge'
import type { WorkflowFinishedParams, WorkflowNodeStateParams } from '@dw/rpc-types'

const { t, locale, te } = useI18n()
const epLocale = computed(() => (locale.value === 'zh-CN' ? zhCn : enLocale))
const log = useLogStore()
const data = useDataStore()
const workflow = useWorkflowStore()
const project = useProjectStore()
const offs: Array<() => void> = []

watch(
  () => [project.path, project.dirty, locale.value] as const,
  () => {
    void syncDocumentTitle()
  },
  { immediate: true }
)

onMounted(() => {
  const onKey = (event: KeyboardEvent): void => {
    if (!(event.ctrlKey || event.metaKey)) {
      return
    }
    const target = event.target
    if (target instanceof HTMLElement) {
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) {
        return
      }
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
    log.append('error', translateRpcError(err, t, te))
    return
  }
  offs.push(
    rpc.on('app.closeRequested', () => {
      void confirmAndQuit()
    })
  )
  offs.push(
    rpc.on('host.ready', (params) => {
      const p = params as { pid?: number; pandasAvailable?: boolean }
      log.append(
        'info',
        t('log.ready', {
          pid: p.pid ?? '?',
          pandas: p.pandasAvailable ? 'yes' : 'no'
        })
      )
      void data.refreshList().catch(() => {})
      void workflow.bootstrap().catch(() => {})
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
    rpc.on('log.protocolPollution', (params) => {
      const p = params as { raw?: string }
      log.append('warning', t('log.pollution', { raw: p.raw ?? '' }))
    })
  )
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
      <WorkbenchLayout />
    </div>
  </el-config-provider>
</template>
