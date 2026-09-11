<script setup lang="ts">
import { computed, ref } from 'vue'
import { MlRibbon } from '@mlightcad/ribbon'
import '@mlightcad/ribbon/style.css'
import type { RibbonLayout } from '@mlightcad/ribbon'
import { useI18n } from 'vue-i18n'
import { commandBus } from '@/commands/commandBus'
import { useRibbonSchema } from './schema'
import DwIcon from '@/icons/DwIcon.vue'

const { t, locale } = useI18n()
const { tabs, fileMenuItems } = useRibbonSchema()
const activeTab = ref('home')
const layout = ref<RibbonLayout>('classic')
const minimized = ref(false)

const ribbonTexts = computed(() => ({
  fileMenuLabel: t('ribbon.file'),
  layoutSwitcherTooltip: t('ribbon.layoutSwitcher'),
  minimizeTooltip: t('ribbon.minimizeRibbon'),
  keyTipsToggleText: t('ribbon.keyTips')
}))

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
      @item-click="onItemClick"
      @file-menu-select="onFileMenuSelect"
    >
      <template #tabs-extra>
        <div class="ribbon-extra">
          <button class="locale-btn" type="button" @click="toggleLocale">
            {{ locale === 'en' ? '中文' : 'EN' }}
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
