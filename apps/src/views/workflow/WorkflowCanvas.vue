<script setup lang="ts">
import { markRaw, nextTick, watch } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import type { Connection, EdgeChange, NodeChange } from '@vue-flow/core'
import { applyEdgeChanges, applyNodeChanges } from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import WorkflowNode from './WorkflowNode.vue'
import { useWorkflowStore } from '@/stores/workflow'
import { translateRpcError } from '@/rpc/rpcError'

const FLOW_ID = 'dw-flow'
const { t, te } = useI18n()
const store = useWorkflowStore()
const { screenToFlowCoordinate, fitView } = useVueFlow({ id: FLOW_ID })
const nodeTypes = { dw: markRaw(WorkflowNode) }

watch(
  () => store.centerTab,
  (tab) => {
    if (tab === 'workflow') {
      void nextTick(() => {
        void fitView()
      })
    }
  }
)

function report(err: unknown): void {
  ElMessage.error(translateRpcError(err, t, te))
}

function onNodesChange(changes: NodeChange[]): void {
  const next: NodeChange[] = []
  for (const change of changes) {
    if (change.type === 'remove') {
      if (!store.canEditGraph) {
        continue
      }
      void store.removeNode(change.id).catch(report)
      continue
    }
    next.push(change)
  }
  if (next.length) {
    store.setNodes(applyNodeChanges(next, store.nodes))
  }
}

function onEdgesChange(changes: EdgeChange[]): void {
  const next: EdgeChange[] = []
  for (const change of changes) {
    if (change.type === 'remove') {
      if (!store.canEditGraph) {
        continue
      }
      void store.removeEdge(change.id).catch(report)
      continue
    }
    next.push(change)
  }
  if (next.length) {
    store.setEdges(applyEdgeChanges(next, store.edges))
  }
}

function onConnect(connection: Connection): void {
  if (!store.canEditGraph) {
    return
  }
  void store.connectPorts(connection).catch(report)
}

function onNodeClick(_event: MouseEvent, node: { id: string }): void {
  store.selectedNodeId = node.id
}

function onPaneClick(): void {
  store.selectedNodeId = null
}

function onDragOver(event: DragEvent): void {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

function onDrop(event: DragEvent): void {
  event.preventDefault()
  const qualifiedName = event.dataTransfer?.getData('application/dw-node')
  if (!qualifiedName || !store.canEditGraph) {
    return
  }
  const position = screenToFlowCoordinate({ x: event.clientX, y: event.clientY })
  void store.addNode(qualifiedName, position).catch(report)
}
</script>

<template>
  <div class="canvas" @dragover="onDragOver" @drop="onDrop">
    <p v-if="!store.nodes.length" class="hint">{{ t('layout.workflowEmpty') }}</p>
    <VueFlow
      :id="FLOW_ID"
      :nodes="store.nodes"
      :edges="store.edges"
      :node-types="nodeTypes"
      :nodes-draggable="store.canEditGraph"
      :nodes-connectable="store.canEditGraph"
      :elements-selectable="true"
      fit-view-on-init
      @nodes-change="onNodesChange"
      @edges-change="onEdgesChange"
      @connect="onConnect"
      @node-click="onNodeClick"
      @pane-click="onPaneClick"
    >
      <Background />
      <Controls />
    </VueFlow>
  </div>
</template>

<style scoped>
.canvas {
  position: relative;
  flex: 1;
  min-height: 0;
  height: 100%;
}
.hint {
  position: absolute;
  z-index: 2;
  left: 12px;
  top: 12px;
  margin: 0;
  color: #909399;
  font-size: 12px;
  pointer-events: none;
}
.canvas :deep(.vue-flow) {
  width: 100%;
  height: 100%;
  background: #fafafa;
}
</style>
