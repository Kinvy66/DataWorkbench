<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import AppRibbon from '@/ribbon/AppRibbon.vue'
import WorkbenchLayout from '@/layout/WorkbenchLayout.vue'
import { useLogStore } from '@/stores/log'

const { t } = useI18n()
const log = useLogStore()
const offs: Array<() => void> = []

onMounted(() => {
  offs.push(
    window.dw.rpc.on('host.ready', (params) => {
      const p = params as { pid?: number; pandasAvailable?: boolean }
      log.append(
        'info',
        t('log.ready', {
          pid: p.pid ?? '?',
          pandas: p.pandasAvailable ? 'yes' : 'no'
        })
      )
    })
  )
  offs.push(
    window.dw.rpc.on('log.line', (params) => {
      const p = params as { level?: string; message?: string }
      const level = p.level === 'error' || p.level === 'warning' ? p.level : 'info'
      log.append(level, p.message ?? '')
    })
  )
  offs.push(
    window.dw.rpc.on('log.protocolPollution', (params) => {
      const p = params as { raw?: string }
      log.append('warning', t('log.pollution', { raw: p.raw ?? '' }))
    })
  )
})

onUnmounted(() => {
  for (const off of offs) {
    off()
  }
})
</script>

<template>
  <div class="app-root">
    <AppRibbon />
    <WorkbenchLayout />
  </div>
</template>
