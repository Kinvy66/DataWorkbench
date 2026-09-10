<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { WorkflowPortSpec } from '@dw/rpc-types'

const props = defineProps<{
  data: {
    label: string
    qualifiedName: string
    state: 'idle' | 'running' | 'ok' | 'error'
    inputs: WorkflowPortSpec[]
    outputs: WorkflowPortSpec[]
    bodyShape?: string
  }
}>()

const inputs = computed(() => props.data.inputs ?? [])
const outputs = computed(() => props.data.outputs ?? [])
const isDiamond = computed(() => props.data.bodyShape === 'Diamond')

function handleTop(index: number, count: number): string {
  if (count <= 1) {
    return '50%'
  }
  return `${((index + 1) / (count + 1)) * 100}%`
}
</script>

<template>
  <div class="dw-node" :class="['st-' + data.state, { diamond: isDiamond }]">
    <Handle
      v-for="(port, index) in inputs"
      :id="port.name"
      :key="'in-' + port.name"
      class="dw-handle"
      type="target"
      :position="Position.Left"
      :style="{ top: handleTop(index, inputs.length) }"
    />
    <div class="title">{{ data.label }}</div>
    <Handle
      v-for="(port, index) in outputs"
      :id="port.name"
      :key="'out-' + port.name"
      class="dw-handle"
      type="source"
      :position="Position.Right"
      :style="{ top: handleTop(index, outputs.length) }"
    />
  </div>
</template>

<style scoped>
.dw-node {
  min-width: 140px;
  background: #fff;
  border: 1px solid #dcdfe6;
  border-left-width: 4px;
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 12px;
  box-shadow: 0 1px 2px rgb(0 0 0 / 6%);
}
.st-idle {
  border-left-color: #909399;
}
.st-running {
  border-left-color: #5280c1;
}
.st-ok {
  border-left-color: #669e8b;
}
.st-error {
  border-left-color: #ce6043;
}
.title {
  font-weight: 600;
  color: #303133;
  text-align: center;
}
.dw-handle {
  width: 8px;
  height: 8px;
  background: #5280c1;
  border: 1px solid #fff;
}
.dw-node.diamond {
  min-width: 168px;
  min-height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e3f2fd;
  border: none;
  border-radius: 0;
  clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
  box-shadow: inset 0 0 0 2px #2196f3;
}
.dw-node.diamond.st-running {
  box-shadow: inset 0 0 0 3px #5280c1;
}
.dw-node.diamond.st-ok {
  box-shadow: inset 0 0 0 3px #669e8b;
}
.dw-node.diamond.st-error {
  box-shadow: inset 0 0 0 3px #ce6043;
}
</style>
