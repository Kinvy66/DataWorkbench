<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { ElConfigProvider } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import enLocale from 'element-plus/es/locale/lang/en'
import { useI18n } from 'vue-i18n'
import AppRibbon from '@/ribbon/AppRibbon.vue'
import WorkbenchLayout from '@/layout/WorkbenchLayout.vue'
import { useLogStore } from '@/stores/log'
import { useDataStore } from '@/stores/data'

const { t, locale } = useI18n()
const epLocale = computed(() => (locale.value === 'zh-CN' ? zhCn : enLocale))
const log = useLogStore()
const data = useDataStore()
const offs: Array<() => void> = []

onMounted(() => {
  void data.refreshList().catch(() => {
    // Sidecar may not be ready yet; host.ready retries below.
  })
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
      void data.refreshList().catch(() => {})
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
  <el-config-provider :locale="epLocale">
    <div class="app-root">
      <AppRibbon />
      <WorkbenchLayout />
    </div>
  </el-config-provider>
</template>
