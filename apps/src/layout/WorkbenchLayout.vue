<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { GoldenLayout, LayoutConfig } from 'golden-layout'
import type { ComponentContainer, ComponentItem } from 'golden-layout'
import 'golden-layout/dist/css/goldenlayout-base.css'
import 'golden-layout/dist/css/themes/goldenlayout-light-theme.css'
import { useI18n } from 'vue-i18n'
import {
  DOCK_PANELS,
  defaultDockingConfig,
  isDockPanelId,
  persistableDocking,
  sanitizeDocking,
  type DockPanelId,
  type DockTitles
} from '@/layout/docking'
import { registerDockingCapture } from '@/layout/docking-runtime'
import { useLogStore } from '@/stores/log'
import { useProjectStore } from '@/stores/project'
import { useWorkflowStore } from '@/stores/workflow'
import DatasetList from '@/views/DatasetList.vue'
import DatasetProperties from '@/views/DatasetProperties.vue'
import VirtualTable from '@/views/VirtualTable.vue'
import NodeToolbox from '@/views/workflow/NodeToolbox.vue'
import NodeProperties from '@/views/workflow/NodeProperties.vue'
import WorkflowCanvas from '@/views/workflow/WorkflowCanvas.vue'
import DropNaDialog from '@/views/data/DropNaDialog.vue'
import DropDuplicatesDialog from '@/views/data/DropDuplicatesDialog.vue'
import FillNaDialog from '@/views/data/FillNaDialog.vue'
import InterpolateDialog from '@/views/data/InterpolateDialog.vue'
import IqrDialog from '@/views/data/IqrDialog.vue'
import ZscoreDialog from '@/views/data/ZscoreDialog.vue'
import TransformSkewedDialog from '@/views/data/TransformSkewedDialog.vue'
import ReplaceValuesDialog from '@/views/data/ReplaceValuesDialog.vue'
import ThresholdFilterDialog from '@/views/data/ThresholdFilterDialog.vue'
import FilterByColumnDialog from '@/views/data/FilterByColumnDialog.vue'
import EvalDialog from '@/views/data/EvalDialog.vue'
import SearchDialog from '@/views/data/SearchDialog.vue'
import DescribeDialog from '@/views/data/DescribeDialog.vue'
import PivotTableDialog from '@/views/data/PivotTableDialog.vue'
import QueryDialog from '@/views/data/QueryDialog.vue'
import SortDialog from '@/views/data/SortDialog.vue'
import ChartWorkspace from '@/views/chart/ChartWorkspace.vue'
import ChartProperties from '@/views/chart/ChartProperties.vue'
import ChartBindDialog from '@/views/chart/ChartBindDialog.vue'
import ChartSubplotDialog from '@/views/chart/ChartSubplotDialog.vue'

const { t, locale } = useI18n()
const log = useLogStore()
const workflow = useWorkflowStore()
const project = useProjectStore()
const hostEl = ref<HTMLElement | null>(null)
const hosts = reactive<Partial<Record<DockPanelId, HTMLElement>>>({})

let layout: GoldenLayout | null = null
let reloading = false

const rightPanel = computed(() => {
  if (workflow.centerTab === 'figure') {
    return 'chart'
  }
  if (workflow.selectedNodeId) {
    return 'node'
  }
  return 'dataset'
})

function dockTitles(): DockTitles {
  return {
    datasets: t('layout.datasets'),
    nodes: t('layout.nodes'),
    table: t('layout.table'),
    workflow: t('layout.workflow'),
    figure: t('layout.figure'),
    properties: t('layout.properties'),
    log: t('layout.log')
  }
}

function resolveConfig(): LayoutConfig {
  const fallback = defaultDockingConfig({
    splits: project.splits,
    centerTab: workflow.centerTab,
    leftTab: workflow.leftTab,
    titles: dockTitles(),
    maximiseLabel: t('window.maximize')
  })
  return sanitizeDocking(project.docking, fallback)
}

function snapshotDocking(): Record<string, unknown> | null {
  if (!layout) {
    return project.docking
  }
  return persistableDocking(LayoutConfig.fromResolved(layout.saveLayout()))
}

function notifyShown(): void {
  window.dispatchEvent(new Event('resize'))
}

function bindPanel(container: ComponentContainer, itemConfig: { componentType: unknown }): { virtual: false; component: undefined } {
  const type = String(itemConfig.componentType)
  if (isDockPanelId(type)) {
    hosts[type] = container.element
    container.element.classList.add('dw-gl-content')
    container.on('show', notifyShown)
  }
  return { virtual: false, component: undefined }
}

function unbindPanel(container: ComponentContainer): void {
  const type = String(container.componentType)
  if (isDockPanelId(type) && hosts[type] === container.element) {
    delete hosts[type]
  }
}

function applyTitles(): void {
  if (!layout) {
    return
  }
  const titles = dockTitles()
  for (const id of DOCK_PANELS) {
    layout.findFirstComponentItemById(id)?.setTitle(titles[id])
  }
}

function activatePanel(id: string): void {
  if (!layout || reloading) {
    return
  }
  const item = layout.findFirstComponentItemById(id)
  if (!item) {
    return
  }
  item.parentItem.setActiveComponentItem(item, true, true)
}

function onActiveItem(item: ComponentItem): void {
  if (reloading || project.restoring) {
    return
  }
  const id = String(item.componentType)
  if (id === 'table' || id === 'workflow' || id === 'figure') {
    workflow.centerTab = id
  } else if (id === 'datasets' || id === 'nodes') {
    workflow.leftTab = id
  }
}

function onStateChanged(): void {
  if (reloading || project.restoring || !layout) {
    return
  }
  const next = snapshotDocking()
  if (JSON.stringify(next) === JSON.stringify(project.docking)) {
    return
  }
  project.setDocking(next)
}

function reload(): void {
  if (!layout) {
    return
  }
  reloading = true
  try {
    layout.loadLayout(resolveConfig())
    applyTitles()
    activatePanel(workflow.leftTab)
    activatePanel(workflow.centerTab)
  } finally {
    void nextTick(() => {
      reloading = false
      if (!project.restoring && !project.docking) {
        project.hydrateDocking(snapshotDocking())
      }
      notifyShown()
    })
  }
}

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString()
}

onMounted(() => {
  const host = hostEl.value
  if (!host) {
    return
  }
  layout = new GoldenLayout(host, bindPanel, unbindPanel)
  layout.resizeWithContainerAutomatically = true
  layout.on('stateChanged', onStateChanged)
  layout.on('activeContentItemChanged', onActiveItem)
  registerDockingCapture(snapshotDocking)
  reload()
})

onUnmounted(() => {
  registerDockingCapture(null)
  if (layout) {
    layout.off('stateChanged', onStateChanged)
    layout.off('activeContentItemChanged', onActiveItem)
    layout.destroy()
    layout = null
  }
})

watch(
  () => project.dockingEpoch,
  () => {
    reload()
  },
  { flush: 'post' }
)

watch(
  () => workflow.centerTab,
  (tab) => {
    activatePanel(tab)
  }
)

watch(
  () => workflow.leftTab,
  (tab) => {
    activatePanel(tab)
  }
)

watch(locale, () => {
  applyTitles()
})
</script>

<template>
  <div class="workbench">
    <div id="dw-dock-stash" class="dock-stash" aria-hidden="true"></div>
    <div ref="hostEl" class="gl-host" />
    <Teleport :to="hosts.datasets ?? '#dw-dock-stash'">
      <section class="dock-panel">
        <DatasetList />
      </section>
    </Teleport>
    <Teleport :to="hosts.nodes ?? '#dw-dock-stash'">
      <section class="dock-panel">
        <NodeToolbox />
      </section>
    </Teleport>
    <Teleport :to="hosts.table ?? '#dw-dock-stash'">
      <section class="dock-panel">
        <VirtualTable />
      </section>
    </Teleport>
    <Teleport :to="hosts.workflow ?? '#dw-dock-stash'">
      <section class="dock-panel">
        <WorkflowCanvas />
      </section>
    </Teleport>
    <Teleport :to="hosts.figure ?? '#dw-dock-stash'">
      <section class="dock-panel">
        <ChartWorkspace />
      </section>
    </Teleport>
    <Teleport :to="hosts.properties ?? '#dw-dock-stash'">
      <section class="dock-panel">
        <NodeProperties v-if="rightPanel === 'node'" />
        <ChartProperties v-else-if="rightPanel === 'chart'" />
        <DatasetProperties v-else />
      </section>
    </Teleport>
    <Teleport :to="hosts.log ?? '#dw-dock-stash'">
      <section class="dock-panel log-panel">
        <ol class="log-lines">
          <li v-for="line in log.lines" :key="line.id" :class="'lv-' + line.level">
            <span class="ts">{{ formatTime(line.at) }}</span>
            {{ line.message }}
          </li>
        </ol>
      </section>
    </Teleport>
    <DropNaDialog />
    <DropDuplicatesDialog />
    <FillNaDialog />
    <InterpolateDialog />
    <IqrDialog />
    <ZscoreDialog />
    <TransformSkewedDialog />
    <ReplaceValuesDialog />
    <ThresholdFilterDialog />
    <FilterByColumnDialog />
    <EvalDialog />
    <SearchDialog />
    <DescribeDialog />
    <PivotTableDialog />
    <QueryDialog />
    <SortDialog />
    <ChartBindDialog />
    <ChartSubplotDialog />
  </div>
</template>

<style scoped>
.workbench {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
}
.dock-stash {
  display: none;
}
.gl-host {
  flex: 1;
  min-height: 0;
  min-width: 0;
  position: relative;
}
.dock-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: #fff;
  box-sizing: border-box;
}
.workbench :deep(.lm_goldenlayout) {
  height: 100%;
}
.workbench :deep(.lm_content) {
  overflow: hidden;
  background: #fff;
}
.workbench :deep(.dw-gl-content) {
  height: 100%;
  overflow: hidden;
}
.workbench :deep(.lm_header) {
  background: #f5f7fa;
}
.workbench :deep(.lm_tab) {
  font-family: 'Segoe UI', system-ui, sans-serif;
}
.log-panel .log-lines {
  margin: 0;
  padding: 6px 10px;
  overflow: auto;
  flex: 1;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 12px;
  list-style: none;
}
.log-lines .ts {
  color: #909399;
  margin-right: 8px;
}
.lv-warning {
  color: #b88230;
}
.lv-error {
  color: #c45656;
}
</style>
