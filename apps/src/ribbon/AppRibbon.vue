<script setup lang="ts">
import { ref } from 'vue'
import { MlRibbon } from '@mlightcad/ribbon'
import '@mlightcad/ribbon/style.css'
import type { RibbonLayout } from '@mlightcad/ribbon'
import { useI18n } from 'vue-i18n'
import { commandBus } from '@/commands/commandBus'
import { useRibbonSchema } from './schema'

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
      <button class="locale-btn" type="button" @click="toggleLocale">
        {{ locale === 'en' ? '中文' : 'EN' }}
      </button>
    </template>
  </MlRibbon>
</template>

<style scoped>
.locale-btn {
  margin-right: 8px;
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
