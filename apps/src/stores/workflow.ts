import { defineStore } from 'pinia'
import type { Connection, Edge, Node } from '@vue-flow/core'
import type {
  WorkflowAddNodeResult,
  WorkflowConnectResult,
  WorkflowCreateResult,
  WorkflowDumpLogicResult,
  WorkflowGetGraphResult,
  WorkflowGraphConnection,
  WorkflowGraphNode,
  WorkflowListNodeTypesResult,
  WorkflowLoadLogicResult,
  WorkflowNodeType,
  WorkflowParamSpec
} from '@dw/rpc-types'
import { getDesktopBridge } from '@/rpc/bridge'
import { touchProject } from './project'
import {
  HISTORY_LIMIT,
  samePoint,
  type HistoryCommand,
  type HistoryEdge
} from './workflowHistory'

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

function layoutFromNodes(nodes: Node[]): Record<string, { x: number; y: number }> {
  const layout: Record<string, { x: number; y: number }> = {}
  for (const node of nodes) {
    layout[node.id] = { x: node.position.x, y: node.position.y }
  }
  return layout
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
    centerTab: 'table' as 'table' | 'workflow' | 'figure',
    leftTab: 'datasets' as 'datasets' | 'nodes',
    nextPlace: { x: 80, y: 80 },
    undoStack: [] as HistoryCommand[],
    redoStack: [] as HistoryCommand[],
    historyLock: 0
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
    },
    canUndo(): boolean {
      return !this.running && this.undoStack.length > 0
    },
    canRedo(): boolean {
      return !this.running && this.redoStack.length > 0
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
    async addNode(
      qualifiedName: string,
      position?: { x: number; y: number },
      options?: { nodeId?: string; record?: boolean }
    ): Promise<string> {
      if (this.running) {
        throw busyError()
      }
      const workflowId = await this.ensureWorkflow()
      const spec = this.typeByName.get(qualifiedName)
      const pos = position ?? { x: this.nextPlace.x, y: this.nextPlace.y }
      const payload: Record<string, unknown> = {
        workflowId,
        qualifiedName,
        position: pos
      }
      if (options?.nodeId) {
        payload.nodeId = options.nodeId
      }
      const added = (await rpc().invoke('workflow.addNode', payload)) as WorkflowAddNodeResult
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
            outputs: spec?.outputs ?? [],
            bodyShape: spec?.bodyShape
          }
        }
      ]
      this.nextPlace = { x: pos.x + 36, y: pos.y + 36 }
      this.selectedNodeId = added.nodeId
      this.centerTab = 'workflow'
      this.leftTab = 'nodes'
      if (this.shouldRecord(options?.record)) {
        this.pushHistory({
          kind: 'addNode',
          nodeId: added.nodeId,
          qualifiedName: added.qualifiedName,
          position: { ...pos },
          params: { ...params }
        })
      }
      return added.nodeId
    },
    async connectPorts(
      connection: Connection,
      options?: { record?: boolean; connectionId?: string }
    ): Promise<string | undefined> {
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
      const payload: Record<string, unknown> = {
        workflowId: this.workflowId,
        fromId: connection.source,
        fromPort,
        toId: connection.target,
        toPort
      }
      if (options?.connectionId) {
        payload.connectionId = options.connectionId
      }
      const result = (await rpc().invoke('workflow.connect', payload)) as WorkflowConnectResult
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
      if (this.shouldRecord(options?.record)) {
        this.pushHistory({
          kind: 'connect',
          connectionId: result.connectionId,
          fromId: connection.source,
          fromPort,
          toId: connection.target,
          toPort
        })
      }
      return result.connectionId
    },
    async removeNode(nodeId: string, options?: { record?: boolean }): Promise<void> {
      if (this.running) {
        throw busyError()
      }
      if (!this.workflowId) {
        return
      }
      const node = this.nodes.find((item) => item.id === nodeId)
      if (!node) {
        return
      }
      const snapshot: HistoryCommand = {
        kind: 'removeNode',
        nodeId,
        qualifiedName: String((node.data as { qualifiedName?: string })?.qualifiedName ?? ''),
        position: { x: node.position.x, y: node.position.y },
        params: { ...(this.paramValues[nodeId] ?? {}) },
        edges: this.edges
          .filter((edge) => edge.source === nodeId || edge.target === nodeId)
          .map((edge) => ({
            connectionId: edge.id,
            fromId: edge.source,
            fromPort: String(edge.sourceHandle ?? ''),
            toId: edge.target,
            toPort: String(edge.targetHandle ?? '')
          }))
      }
      await rpc().invoke('workflow.removeNode', { workflowId: this.workflowId, nodeId })
      this.nodes = this.nodes.filter((item) => item.id !== nodeId)
      this.edges = this.edges.filter((item) => item.source !== nodeId && item.target !== nodeId)
      delete this.paramValues[nodeId]
      if (this.selectedNodeId === nodeId) {
        this.selectedNodeId = null
      }
      if (this.shouldRecord(options?.record)) {
        this.pushHistory(snapshot)
      }
    },
    async removeEdge(edgeId: string, options?: { record?: boolean }): Promise<void> {
      if (this.running) {
        throw busyError()
      }
      if (!this.workflowId) {
        return
      }
      const edge = this.edges.find((item) => item.id === edgeId)
      if (!edge) {
        return
      }
      const snapshot: HistoryCommand = {
        kind: 'disconnect',
        connectionId: edge.id,
        fromId: edge.source,
        fromPort: String(edge.sourceHandle ?? ''),
        toId: edge.target,
        toPort: String(edge.targetHandle ?? '')
      }
      await rpc().invoke('workflow.disconnect', { workflowId: this.workflowId, connectionId: edgeId })
      this.edges = this.edges.filter((item) => item.id !== edgeId)
      if (this.shouldRecord(options?.record)) {
        this.pushHistory(snapshot)
      }
    },
    async setParam(nodeId: string, name: string, value: unknown, options?: { record?: boolean }): Promise<void> {
      if (this.running) {
        throw busyError()
      }
      if (!this.workflowId) {
        return
      }
      const oldValue = this.paramValues[nodeId]?.[name]
      if (oldValue === value) {
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
      if (this.shouldRecord(options?.record)) {
        this.pushHistory({
          kind: 'setParam',
          nodeId,
          name,
          oldValue,
          newValue: value
        })
      }
    },
    async dumpLogic(): Promise<WorkflowDumpLogicResult> {
      if (!this.workflowId) {
        throw new Error('Failed to create workflow')
      }
      return (await rpc().invoke('workflow.dumpLogic', {
        workflowId: this.workflowId,
        format: 'json'
      })) as WorkflowDumpLogicResult
    },
    async loadAndWrap(payload: unknown, format: 'json' | 'xml' = 'json'): Promise<void> {
      if (this.running) {
        throw busyError()
      }
      if (!this.types.length) {
        const listed = (await rpc().invoke('workflow.listNodeTypes', {})) as WorkflowListNodeTypesResult
        this.types = listed.types
      }
      const layout = layoutFromNodes(this.nodes)
      const params: { payload: unknown; format: 'json' | 'xml'; workflowId?: string } = {
        payload,
        format
      }
      if (this.workflowId) {
        params.workflowId = this.workflowId
      }
      const loaded = (await rpc().invoke('workflow.loadLogic', params)) as WorkflowLoadLogicResult
      const graph = (await rpc().invoke('workflow.getGraph', {
        workflowId: loaded.workflowId
      })) as WorkflowGetGraphResult
      this.applyWrappedGraph(graph, layout)
      this.centerTab = 'workflow'
    },
    async adoptWorkflow(
      workflowId: string,
      layout: Record<string, { x: number; y: number }>
    ): Promise<void> {
      if (!this.types.length) {
        const listed = (await rpc().invoke('workflow.listNodeTypes', {})) as WorkflowListNodeTypesResult
        this.types = listed.types
      }
      const graph = (await rpc().invoke('workflow.getGraph', {
        workflowId
      })) as WorkflowGetGraphResult
      this.applyWrappedGraph(graph, layout)
    },
    captureLayout(): Record<string, { x: number; y: number }> {
      return layoutFromNodes(this.nodes)
    },
    resetSession(): void {
      this.workflowId = null
      this.nodes = []
      this.edges = []
      this.paramValues = {}
      this.selectedNodeId = null
      this.undoStack = []
      this.redoStack = []
      this.running = false
      this.centerTab = 'table'
      this.leftTab = 'datasets'
      this.nextPlace = { x: 80, y: 80 }
    },
    applyWrappedGraph(graph: WorkflowGetGraphResult, layout?: Record<string, { x: number; y: number }>): void {
      const positions = layout ?? layoutFromNodes(this.nodes)
      this.workflowId = graph.workflowId
      this.running = false
      this.selectedNodeId = null
      const paramValues: Record<string, Record<string, unknown>> = {}
      const nodes: Node[] = graph.nodes.map((item: WorkflowGraphNode, index: number) => {
        const spec = this.typeByName.get(item.qualifiedName)
        const params: Record<string, unknown> = {}
        for (const p of spec?.parameters ?? []) {
          params[p.name] = defaultParamValue(p)
        }
        Object.assign(params, item.parameters ?? {})
        paramValues[item.nodeId] = params
        const pos = positions[item.nodeId] ?? { x: 80 + index * 36, y: 80 + index * 36 }
        return {
          id: item.nodeId,
          type: 'dw',
          position: pos,
          data: {
            label: spec?.name ?? item.qualifiedName,
            qualifiedName: item.qualifiedName,
            state: 'idle' as NodeRunState,
            inputs: spec?.inputs ?? [],
            outputs: spec?.outputs ?? [],
            bodyShape: spec?.bodyShape,
            displayText: item.runtimeState?.displayText
          }
        }
      })
      this.nodes = nodes
      this.edges = graph.connections.map((conn: WorkflowGraphConnection) => ({
        id: conn.connectionId,
        source: conn.fromId,
        target: conn.toId,
        sourceHandle: conn.fromPort,
        targetHandle: conn.toPort
      }))
      this.paramValues = paramValues
      this.undoStack = []
      this.redoStack = []
      const last = nodes[nodes.length - 1]
      if (last) {
        this.nextPlace = { x: last.position.x + 36, y: last.position.y + 36 }
      }
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
    applyNodeState(workflowId: string, nodeId: string, state: NodeRunState, displayText?: string): void {
      if (workflowId !== this.workflowId) {
        return
      }
      this.nodes = this.nodes.map((item) => {
        if (item.id !== nodeId) {
          return item
        }
        const data = { ...item.data, state } as Record<string, unknown>
        if (displayText !== undefined) {
          data.displayText = displayText
        }
        return { ...item, data }
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
    recordMove(nodeId: string, from: { x: number; y: number }, to: { x: number; y: number }): void {
      if (this.running || samePoint(from, to) || !this.shouldRecord(true)) {
        return
      }
      this.pushHistory({
        kind: 'move',
        nodeId,
        from: { ...from },
        to: { ...to }
      })
    },
    async undo(): Promise<void> {
      if (this.running) {
        throw busyError()
      }
      const cmd = this.undoStack[this.undoStack.length - 1]
      if (!cmd) {
        return
      }
      this.historyLock += 1
      try {
        await this.playHistory(cmd, 'undo')
        this.undoStack.pop()
        this.redoStack.push(cmd)
        touchProject()
      } finally {
        this.historyLock -= 1
      }
    },
    async redo(): Promise<void> {
      if (this.running) {
        throw busyError()
      }
      const cmd = this.redoStack[this.redoStack.length - 1]
      if (!cmd) {
        return
      }
      this.historyLock += 1
      try {
        await this.playHistory(cmd, 'redo')
        this.redoStack.pop()
        this.undoStack.push(cmd)
        touchProject()
      } finally {
        this.historyLock -= 1
      }
    },
    shouldRecord(record?: boolean): boolean {
      return record !== false && this.historyLock === 0 && !this.running
    },
    pushHistory(cmd: HistoryCommand): void {
      this.undoStack = [...this.undoStack, cmd].slice(-HISTORY_LIMIT)
      this.redoStack = []
      touchProject()
    },
    async playHistory(cmd: HistoryCommand, direction: 'undo' | 'redo'): Promise<void> {
      const reverse = direction === 'undo'
      if (cmd.kind === 'addNode') {
        if (reverse) {
          await this.removeNode(cmd.nodeId, { record: false })
        } else {
          await this.restoreNode(cmd)
        }
        return
      }
      if (cmd.kind === 'removeNode') {
        if (reverse) {
          await this.restoreNode(cmd)
        } else {
          await this.removeNode(cmd.nodeId, { record: false })
        }
        return
      }
      if (cmd.kind === 'connect') {
        if (reverse) {
          await this.removeEdge(cmd.connectionId, { record: false })
        } else {
          await this.restoreEdge(cmd)
        }
        return
      }
      if (cmd.kind === 'disconnect') {
        if (reverse) {
          await this.restoreEdge(cmd)
        } else {
          await this.removeEdge(cmd.connectionId, { record: false })
        }
        return
      }
      if (cmd.kind === 'setParam') {
        await this.setParam(cmd.nodeId, cmd.name, reverse ? cmd.oldValue : cmd.newValue, { record: false })
        return
      }
      const pos = reverse ? cmd.from : cmd.to
      this.nodes = this.nodes.map((item) => {
        if (item.id !== cmd.nodeId) {
          return item
        }
        return { ...item, position: { x: pos.x, y: pos.y } }
      })
    },
    async restoreNode(cmd: Extract<HistoryCommand, { kind: 'addNode' | 'removeNode' }>): Promise<void> {
      await this.addNode(cmd.qualifiedName, cmd.position, { nodeId: cmd.nodeId, record: false })
      for (const [name, value] of Object.entries(cmd.params)) {
        await this.setParam(cmd.nodeId, name, value, { record: false })
      }
      if (cmd.kind !== 'removeNode') {
        return
      }
      for (const edge of cmd.edges) {
        const other = edge.fromId === cmd.nodeId ? edge.toId : edge.fromId
        if (!this.nodes.some((item) => item.id === other)) {
          continue
        }
        await this.restoreEdge(edge)
      }
    },
    async restoreEdge(edge: HistoryEdge): Promise<void> {
      const connectionId = await this.connectPorts(
        {
          source: edge.fromId,
          target: edge.toId,
          sourceHandle: edge.fromPort,
          targetHandle: edge.toPort
        },
        { record: false, connectionId: edge.connectionId }
      )
      if (connectionId) {
        edge.connectionId = connectionId
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
