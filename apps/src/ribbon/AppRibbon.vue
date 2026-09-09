<script setup lang="ts">
import { ref } from 'vue'
import { MlRibbon } from '@mlightcad/ribbon'
import '@mlightcad/ribbon/style.css'
import type { RibbonLayout } from '@mlightcad/ribbon'
import { useI18n } from 'vue-i18n'
import { commandBus } from '@/commands/commandBus'
import { useRibbonSchema } from './schema'
import DwIcon from '@/icons/DwIcon.vue'
import WindowCaptionButtons from './WindowCaptionButtons.vue'

const { locale } = useI18n()
const { tabs, fileMenuItems } = useRibbonSchema()
const activeTab = ref('home')
const layout = ref<RibbonLayout>('classic')
const minimized = ref(false)

function onItemClick(payload: { itemId: string }): void {
  void commandBus.dispatch(payload.itemId)
}

function onFileMenuSelect(id: string): void {
  void commandBus.dispatch(id)
}

function toggleLocale(): void {
  locale.value = locale.value === 'en' ? 'zh-CN' : 'en'
}
</script>

<template>
  <MlRibbon
    v-model:active-tab="activeTab"
    v-model:layout="layout"
    v-model:minimized="minimized"
    :tabs="tabs"
    :file-menu-items="fileMenuItems"
    :show-open-backstage="false"
    @item-click="onItemClick"
    @file-menu-select="onFileMenuSelect"
  >
    <template #tabs-extra>
      <div class="ribbon-extra">
        <DwIcon name="app/icon" :size="22" />
        <button class="locale-btn" type="button" @click="toggleLocale">
          {{ locale === 'en' ? '中文' : 'EN' }}
        </button>
        <WindowCaptionButtons />
      </div>
    </template>
  </MlRibbon>
</template>

<style scoped>
.ribbon-extra {
  display: flex;
  align-items: center;
  gap: 8px;
  -webkit-app-region: no-drag;
}
.locale-btn {
  border: 1px solid #dcdfe6;
  background: #fff;
  color: #303133;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 12px;
  cursor: pointer;
}
.locale-btn:hover {
  border-color: var(--dw-accent, #5280c1);
  color: var(--dw-accent, #5280c1);
}
</style>
