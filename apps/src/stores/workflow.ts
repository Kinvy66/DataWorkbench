import { defineStore } from 'pinia'
import type { Connection, Edge, Node } from '@vue-flow/core'
import type {
  WorkflowAddNodeResult,
  WorkflowConnectResult,
  WorkflowCreateResult,
  WorkflowListNodeTypesResult,
  WorkflowNodeType,
  WorkflowParamSpec
} from '@dw/rpc-types'
import { getDesktopBridge } from '@/rpc/bridge'

export type NodeRunState = 'idle' | 'running' | 'ok' | 'error'

function defaultParamValue(spec: WorkflowParamSpec): unknown {
  if (spec.default !== undefined) {
    return spec.default
  }
  if (spec.type === 'bool') {
    return false
  }
  if (spec.type === 'int' || spec.type === 'float') {
    return spec.min ?? 0
  }
  return ''
}

function rpc() {
  return getDesktopBridge().rpc
}

function busyError(): Error {
  const err = new Error('Workflow is running [@@workflow.busy]')
  ;(err as Error & { i18nKey: string }).i18nKey = 'workflow.busy'
  return err
}

export const useWorkflowStore = defineStore('workflow', {
  state: () => ({
    workflowId: null as string | null,
    types: [] as WorkflowNodeType[],
    nodes: [] as Node[],
    edges: [] as Edge[],
    selectedNodeId: null as string | null,
    running: false,
    paramValues: {} as Record<string, Record<string, unknown>>,
    centerTab: 'table' as 'table' | 'workflow',
    leftTab: 'datasets' as 'datasets' | 'nodes',
    nextPlace: { x: 80, y: 80 }
  }),
  getters: {
    typeByName: (state) => {
      const map = new Map<string, WorkflowNodeType>()
      for (const item of state.types) {
        map.set(item.qualifiedName, item)
      }
      return map
    },
    selectedType(): WorkflowNodeType | null {
      const node = this.nodes.find((item) => item.id === this.selectedNodeId)
      if (!node) {
        return null
      }
      const qn = String((node.data as { qualifiedName?: string })?.qualifiedName ?? '')
      return this.typeByName.get(qn) ?? null
    },
    canRun(): boolean {
      return Boolean(this.workflowId) && !this.running && this.nodes.length > 0
    },
    canStop(): boolean {
      return this.running
    },
    canEditGraph(): boolean {
      return !this.running
    }
  },
  actions: {
    async bootstrap(): Promise<void> {
      const listed = (await rpc().invoke('workflow.listNodeTypes', {})) as WorkflowListNodeTypesResult
      this.types = listed.types
      if (!this.workflowId) {
        const created = (await rpc().invoke('workflow.create', { name: 'untitle' })) as WorkflowCreateResult
        this.workflowId = created.workflowId
      }
    },
    async ensureWorkflow(): Promise<string> {
      if (this.workflowId) {
        return this.workflowId
      }
      await this.bootstrap()
      if (!this.workflowId) {
        throw new Error('Failed to create workflow')
      }
      return this.workflowId
    },
    async addNode(qualifiedName: string, position?: { x: number; y: number }): Promise<void> {
      if (this.running) {
        throw busyError()
      }
      const workflowId = await this.ensureWorkflow()
      const spec = this.typeByName.get(qualifiedName)
      const pos = position ?? { x: this.nextPlace.x, y: this.nextPlace.y }
      const added = (await rpc().invoke('workflow.addNode', {
        workflowId,
        qualifiedName,
        position: pos
      })) as WorkflowAddNodeResult
      const params: Record<string, unknown> = {}
      for (const p of spec?.parameters ?? []) {
        params[p.name] = defaultParamValue(p)
      }
      this.paramValues[added.nodeId] = params
      this.nodes = [
        ...this.nodes,
        {
          id: added.nodeId,
          type: 'dw',
          position: pos,
          data: {
            label: spec?.name ?? added.qualifiedName,
            qualifiedName: added.qualifiedName,
            state: 'idle' as NodeRunState,
            inputs: spec?.inputs ?? [],
            outputs: spec?.outputs ?? []
          }
        }
      ]
      this.nextPlace = { x: pos.x + 36, y: pos.y + 36 }
      this.selectedNodeId = added.nodeId
      this.centerTab = 'workflow'
      this.leftTab = 'nodes'
    },
    async connectPorts(connection: Connection): Promise<void> {
      if (this.running) {
        throw busyError()
      }
      if (!this.workflowId || !connection.source || !connection.target) {
        return
      }
      const sourceNode = this.nodes.find((item) => item.id === connection.source)
      const targetNode = this.nodes.find((item) => item.id === connection.target)
      const fromPort =
        connection.sourceHandle ||
        ((sourceNode?.data as { outputs?: Array<{ name: string }> })?.outputs?.[0]?.name ?? '')
      const toPort =
        connection.targetHandle ||
        ((targetNode?.data as { inputs?: Array<{ name: string }> })?.inputs?.[0]?.name ?? '')
      if (!fromPort || !toPort) {
        return
      }
      const result = (await rpc().invoke('workflow.connect', {
        workflowId: this.workflowId,
        fromId: connection.source,
        fromPort,
        toId: connection.target,
        toPort
      })) as WorkflowConnectResult
      this.edges = [
        ...this.edges,
        {
          id: result.connectionId,
          source: connection.source,
          target: connection.target,
          sourceHandle: fromPort,
          targetHandle: toPort
        }
      ]
    },
    async removeNode(nodeId: string): Promise<void> {
      if (this.running) {
        throw busyError()
      }
      if (!this.workflowId) {
        return
      }
      await rpc().invoke('workflow.removeNode', { workflowId: this.workflowId, nodeId })
      this.nodes = this.nodes.filter((item) => item.id !== nodeId)
      this.edges = this.edges.filter((item) => item.source !== nodeId && item.target !== nodeId)
      delete this.paramValues[nodeId]
      if (this.selectedNodeId === nodeId) {
        this.selectedNodeId = null
      }
    },
    async removeEdge(edgeId: string): Promise<void> {
      if (this.running) {
        throw busyError()
      }
      if (!this.workflowId) {
        return
      }
      await rpc().invoke('workflow.disconnect', { workflowId: this.workflowId, connectionId: edgeId })
      this.edges = this.edges.filter((item) => item.id !== edgeId)
    },
    async setParam(nodeId: string, name: string, value: unknown): Promise<void> {
      if (this.running) {
        throw busyError()
      }
      if (!this.workflowId) {
        return
      }
      await rpc().invoke('workflow.setParam', {
        workflowId: this.workflowId,
        nodeId,
        name,
        value
      })
      const current = this.paramValues[nodeId] ?? {}
      this.paramValues[nodeId] = { ...current, [name]: value }
    },
    async run(): Promise<void> {
      if (!this.workflowId) {
        return
      }
      this.running = true
      try {
        await rpc().invoke('workflow.execute', { workflowId: this.workflowId })
      } catch (err) {
        this.running = false
        throw err
      }
    },
    async stop(): Promise<void> {
      if (!this.workflowId) {
        return
      }
      await rpc().invoke('workflow.stop', { workflowId: this.workflowId })
    },
    applyNodeState(workflowId: string, nodeId: string, state: NodeRunState): void {
      if (workflowId !== this.workflowId) {
        return
      }
      this.nodes = this.nodes.map((item) => {
        if (item.id !== nodeId) {
          return item
        }
        return { ...item, data: { ...item.data, state } }
      })
    },
    applyFinished(workflowId: string, ok: boolean): void {
      if (workflowId !== this.workflowId) {
        return
      }
      this.running = false
      if (!ok) {
        return
      }
    },
    setNodes(nodes: Node[]): void {
      this.nodes = nodes
    },
    setEdges(edges: Edge[]): void {
      this.edges = edges
    }
  }
})
