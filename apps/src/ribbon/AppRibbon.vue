<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MlRibbon } from '@mlightcad/ribbon'
import '@mlightcad/ribbon/style.css'
import type { RibbonLayout } from '@mlightcad/ribbon'
import { useI18n } from 'vue-i18n'
import { commandBus } from '@/commands/commandBus'
import { parseAppLocale, writeStoredLocale } from '@/i18n/locale'
import { ribbonContextTabId, useRibbonSchema } from './schema'
import { ribbonActiveTab as activeTab } from './activeTab'
import { useWorkflowStore } from '@/stores/workflow'
import DwIcon from '@/icons/DwIcon.vue'

const { t, locale } = useI18n()
const workflow = useWorkflowStore()
const { tabs, fileMenuItems } = useRibbonSchema()
const layout = ref<RibbonLayout>('classic')
const minimized = ref(false)

watch(
  () => workflow.centerTab,
  (tab) => {
    // Startup stays on Home. Jump to Operate / Workflow / Chart only after
    // the user focuses a workspace window (centerTab actually changes).
    activeTab.value = ribbonContextTabId(tab)
  }
)

watch(
  () =>
    tabs.value
      .filter((tab) => tab.visible !== false)
      .map((tab) => tab.id)
      .join(','),
  (visibleIds) => {
    const ids = visibleIds.split(',').filter(Boolean)
    if (!ids.includes(activeTab.value)) {
      const contextId = ribbonContextTabId(workflow.centerTab)
      activeTab.value = ids.includes(contextId) ? contextId : 'home'
    }
  }
)

const ribbonTexts = computed(() => ({
  fileMenuLabel: t('ribbon.file'),
  minimizeTooltip: t('ribbon.minimizeRibbon')
}))

function onItemClick(payload: { itemId: string }): void {
  void commandBus.dispatch(payload.itemId)
}

function onFileMenuSelect(id: string): void {
  void commandBus.dispatch(id)
}

function toggleLocale(): void {
  const next = parseAppLocale(locale.value === 'en' ? 'zh-CN' : 'en')
  locale.value = next
  writeStoredLocale(next)
}
</script>

<template>
  <div class="ribbon-shell">
    <div class="titlebar-logo" aria-hidden="true">
      <DwIcon name="app/icon" :size="24" />
    </div>
    <MlRibbon
      v-model:active-tab="activeTab"
      v-model:layout="layout"
      v-model:minimized="minimized"
      :tabs="tabs"
      :file-menu-items="fileMenuItems"
      :texts="ribbonTexts"
      :show-open-backstage="false"
      hide-layout-switcher
      hide-key-tips-toggle
      @item-click="onItemClick"
      @file-menu-select="onFileMenuSelect"
    >
      <template #tabs-extra>
        <div class="ribbon-extra">
          <button class="locale-btn" type="button" @click="toggleLocale">
            <span class="locale-btn__label" :class="{ 'is-on': locale !== 'en' }">EN</span>
            <span class="locale-btn__label" :class="{ 'is-on': locale === 'en' }">中文</span>
          </button>
        </div>
      </template>
    </MlRibbon>
  </div>
</template>

<style scoped>
.ribbon-shell {
  position: relative;
  flex: 0 0 auto;
  --dw-caption-height: 36px;
  --dw-title-logo-width: 36px;
}
.titlebar-logo {
  position: absolute;
  top: 0;
  left: env(titlebar-area-x, 0px);
  z-index: 20;
  width: var(--dw-title-logo-width);
  height: env(titlebar-area-height, var(--dw-caption-height));
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  -webkit-app-region: drag;
}
/*
 * Windows/Linux caption buttons are native titleBarOverlay, not HTML.
 * env(titlebar-area-*) is the safe rectangle beside those controls
 * (and beside macOS traffic lights). Reserve its first 36px for the app logo.
 */
.ribbon-shell :deep(.ml-ribbon__header) {
  box-sizing: border-box;
  min-height: env(titlebar-area-height, var(--dw-caption-height));
  margin-left: calc(env(titlebar-area-x, 0px) + var(--dw-title-logo-width));
  width: calc(env(titlebar-area-width, 100%) - var(--dw-title-logo-width));
}
.ribbon-shell :deep(.ml-ribbon-collection--column .ml-ribbon-item-host.is-large) {
  grid-row: 1 / -1;
  min-height: 0;
}
.ribbon-shell :deep(.ml-ribbon-item-host.is-large .ml-ribbon-item-host__icon) {
  width: 32px;
  height: 32px;
  font-size: 32px;
  overflow: visible;
}
.ribbon-shell :deep(.ml-ribbon-item-host.is-large .dw-ribbon-icon) {
  width: 32px;
  height: 32px;
  object-fit: contain;
  object-position: center;
}
/*
 * mlRibbon paints each contextual tab as a rounded bordered pill. Restyle toward
 * SARibbon: a top color bar on the group (border, not inset — a filled active
 * tab would cover inset shadow and leave only a bottom bar). Selected page uses
 * a solid fill + weight, not a different highlight edge from its sibling.
 */
.ribbon-shell :deep(.ml-ribbon-contextual-tabs) {
  align-items: stretch;
}
.ribbon-shell :deep(.ml-ribbon-contextual-tabs__ctx) {
  gap: 0;
  align-items: stretch;
  margin-left: 4px;
}
.ribbon-shell :deep(.ml-ribbon-contextual-tabs__block) {
  border: none;
  border-top: 3px solid var(--ctx-color);
  border-radius: 0;
  padding: 0;
  background: color-mix(in oklab, var(--ctx-color) 12%, transparent);
}
.ribbon-shell :deep(.ml-ribbon-contextual-tabs__block + .ml-ribbon-contextual-tabs__block) {
  box-shadow: inset 1px 0 0 color-mix(in oklab, var(--ctx-color) 28%, transparent);
}
.ribbon-shell :deep(.ml-ribbon-contextual-tabs__block .ml-ribbon-tab) {
  border-bottom-color: transparent;
  color: var(--ml-rb-muted);
  font-weight: 400;
}
.ribbon-shell :deep(.ml-ribbon-contextual-tabs__block .ml-ribbon-tab.is-active) {
  background: var(--ml-rb-surface, #fff);
  color: var(--ml-rb-tab-text, #303133);
  font-weight: 600;
  border-bottom-color: transparent;
}
.ribbon-extra {
  display: flex;
  align-items: center;
  gap: 8px;
  -webkit-app-region: no-drag;
}
.locale-btn {
  display: inline-grid;
  place-items: center;
  box-sizing: border-box;
  border: 1px solid #dcdfe6;
  background: #fff;
  color: #303133;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 12px;
  line-height: 1.2;
  cursor: pointer;
}
.locale-btn__label {
  grid-area: 1 / 1;
  visibility: hidden;
  white-space: nowrap;
}
.locale-btn__label.is-on {
  visibility: visible;
}
.locale-btn:hover {
  border-color: var(--dw-accent, #5280c1);
  color: var(--dw-accent, #5280c1);
}
</style>

<style>
/*
 * File menu popper is teleported to <body>. Vue CSS v-bind compiles to custom
 * properties on this component root, which the popper cannot inherit — that
 * left an empty 18px ::before slot. Vite url() is resolved at build time.
 * nth-child order must match schema.ts fileMenuItems.
 */
.ml-ribbon-file-menu-dropdown .el-dropdown-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ml-ribbon-file-menu-dropdown .el-dropdown-menu__item::before {
  content: '';
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  background: center / contain no-repeat;
}
.ml-ribbon-file-menu-dropdown .el-dropdown-menu__item:nth-child(1)::before {
  background-image: url('@/assets/icons/app/appendProject.svg');
}
.ml-ribbon-file-menu-dropdown .el-dropdown-menu__item:nth-child(2)::before {
  background-image: url('@/assets/icons/app/file.svg');
}
.ml-ribbon-file-menu-dropdown .el-dropdown-menu__item:nth-child(3)::before {
  background-image: url('@/assets/icons/app/save.svg');
}
.ml-ribbon-file-menu-dropdown .el-dropdown-menu__item:nth-child(4)::before {
  background-image: url('@/assets/icons/app/save-as.svg');
}
.ml-ribbon-file-menu-dropdown .el-dropdown-menu__item:nth-child(5)::before {
  background-image: url('@/assets/icons/gui/cancel.svg');
}
</style>
