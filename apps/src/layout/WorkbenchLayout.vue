<script setup lang="ts">
import { computed } from 'vue'
import { Splitpanes, Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import { useI18n } from 'vue-i18n'
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

const { t } = useI18n()
const log = useLogStore()
const workflow = useWorkflowStore()
const project = useProjectStore()

const rightPanel = computed(() => {
  if (workflow.centerTab === 'figure') {
    return 'chart'
  }
  if (workflow.selectedNodeId) {
    return 'node'
  }
  return 'dataset'
})

function onMainResized(panes: Array<{ size: number }>): void {
  if (project.restoring || panes.length < 2) {
    return
  }
  project.setSplits({ main: panes[0]!.size, log: panes[1]!.size })
}

function onCenterResized(panes: Array<{ size: number }>): void {
  if (project.restoring || panes.length < 3) {
    return
  }
  project.setSplits({ left: panes[0]!.size, center: panes[1]!.size, properties: panes[2]!.size })
}

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString()
}
</script>

<template>
  <div class="workbench">
    <Splitpanes class="default-theme main-split" horizontal @resized="onMainResized">
      <Pane :size="project.splits.main" :min-size="40">
        <Splitpanes class="default-theme" @resized="onCenterResized">
          <Pane :size="project.splits.left" :min-size="12">
            <section class="panel">
              <el-tabs v-model="workflow.leftTab" class="panel-tabs">
                <el-tab-pane :label="t('layout.datasets')" name="datasets">
                  <DatasetList />
                </el-tab-pane>
                <el-tab-pane :label="t('layout.nodes')" name="nodes">
                  <NodeToolbox />
                </el-tab-pane>
              </el-tabs>
            </section>
          </Pane>
          <Pane :size="project.splits.center" :min-size="30">
            <section class="panel">
              <el-tabs v-model="workflow.centerTab" class="panel-tabs">
                <el-tab-pane :label="t('layout.table')" name="table">
                  <VirtualTable />
                </el-tab-pane>
                <el-tab-pane :label="t('layout.workflow')" name="workflow">
                  <WorkflowCanvas />
                </el-tab-pane>
                <el-tab-pane :label="t('layout.figure')" name="figure">
                  <ChartWorkspace />
                </el-tab-pane>
              </el-tabs>
            </section>
          </Pane>
          <Pane :size="project.splits.properties" :min-size="12">
            <section class="panel">
              <header>{{ t('layout.properties') }}</header>
              <NodeProperties v-if="rightPanel === 'node'" />
              <ChartProperties v-else-if="rightPanel === 'chart'" />
              <DatasetProperties v-else />
            </section>
          </Pane>
        </Splitpanes>
      </Pane>
      <Pane :size="project.splits.log" :min-size="10">
        <section class="panel log-panel">
          <header>{{ t('layout.log') }}</header>
          <ol class="log-lines">
            <li v-for="line in log.lines" :key="line.id" :class="'lv-' + line.level">
              <span class="ts">{{ formatTime(line.at) }}</span>
              {{ line.message }}
            </li>
          </ol>
        </section>
      </Pane>
    </Splitpanes>
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
  </div>
</template>

<style scoped>
.workbench {
  flex: 1;
  min-height: 0;
}
.workbench :deep(.splitpanes) {
  height: 100%;
}
.panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #ebeef5;
  box-sizing: border-box;
}
.panel header {
  font-size: 12px;
  font-weight: 600;
  padding: 6px 10px;
  border-bottom: 1px solid #ebeef5;
  color: #303133;
  background: #f5f7fa;
}
.panel-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.panel-tabs :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 8px;
  background: #f5f7fa;
}
.panel-tabs :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.panel-tabs :deep(.el-tab-pane) {
  height: 100%;
  display: flex;
  flex-direction: column;
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
