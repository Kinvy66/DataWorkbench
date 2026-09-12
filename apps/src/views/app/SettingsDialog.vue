<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { commandBus } from '@/commands/commandBus'
import { useAppUiStore } from '@/stores/appUi'
import { parseAppLocale, writeStoredLocale, type AppLocale } from '@/i18n/locale'
import { qaLabEnabled } from '@/qa-lab'

const { t, locale } = useI18n()
const ui = useAppUiStore()

const visible = computed({
  get: () => ui.settingsOpen,
  set: (open: boolean) => {
    ui.settingsOpen = open
  }
})

function onLocale(value: AppLocale): void {
  const next = parseAppLocale(value)
  locale.value = next
  if (!qaLabEnabled()) {
    writeStoredLocale(next)
  }
}

function openLogs(): void {
  void commandBus.dispatch('app.openLogs')
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="t('settings.title')"
    width="460px"
    append-to-body
    destroy-on-close
  >
    <el-form label-position="top" size="small">
      <el-form-item :label="t('settings.language')">
        <el-select :model-value="locale" style="width: 100%" @update:model-value="onLocale">
          <el-option :label="t('settings.languageZh')" value="zh-CN" />
          <el-option :label="t('settings.languageEn')" value="en" />
        </el-select>
        <p class="hint">{{ t('settings.languageHint') }}</p>
      </el-form-item>
      <el-form-item :label="t('settings.logs')">
        <el-button @click="openLogs">{{ t('settings.openLogs') }}</el-button>
        <p class="hint">{{ t('settings.logsHint') }}</p>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button type="primary" @click="visible = false">{{ t('settings.close') }}</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.hint {
  margin: 8px 0 0;
  color: #909399;
  font-size: 12px;
  line-height: 1.5;
}
</style>
