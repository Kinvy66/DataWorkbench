import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkflowNodeType } from '@dw/rpc-types'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.mock('@/rpc/bridge', () => ({
  getDesktopBridge: () => ({
    rpc: { invoke, on: vi.fn() }
  })
}))

import { useWorkflowStore } from './workflow'

const constantType: WorkflowNodeType = {
  qualifiedName: 'dw_nodes_system.nodes.constant.ConstantNode',
  name: 'Constant',
  category: 'System / Data',
  inputs: [],
  outputs: [{ name: 'value', type: 'any' }],
  parameters: [{ name: 'value', type: 'code', default: '1' }]
}

const dataMgrType: WorkflowNodeType = {
  qualifiedName: 'dw_nodes_system.nodes.data_to_manager.DataToManagerNode',
  name: 'Output to DataManager',
  category: 'System / Data',
  inputs: [{ name: 'data', type: 'any', required: true }],
  outputs: [],
  parameters: [{ name: 'data_name', type: 'str', default: 'workflow_output' }]
}

describe('useWorkflowStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    let nodeSeq = 0
    invoke.mockReset()
    invoke.mockImplementation(async (method: string, params: Record<string, unknown> = {}) => {
      if (method === 'workflow.listNodeTypes') {
        return { types: [constantType, dataMgrType] }
      }
      if (method === 'workflow.create') {
        return { workflowId: 'wf-1', name: 'untitle' }
      }
      if (method === 'workflow.addNode') {
        nodeSeq += 1
        return { nodeId: `node-${nodeSeq}`, qualifiedName: params.qualifiedName }
      }
      if (method === 'workflow.connect') {
        return { connectionId: 'conn-1' }
      }
      if (method === 'workflow.execute') {
        return { accepted: true, workflowId: 'wf-1' }
      }
      if (method === 'workflow.stop') {
        return { ok: true }
      }
      return { ok: true }
    })
  })

  it('inserts a node only after addNode RPC succeeds', async () => {
    const store = useWorkflowStore()
    await store.addNode(constantType.qualifiedName, { x: 40, y: 80 })
    expect(store.nodes).toHaveLength(1)
    expect(store.nodes[0]?.id).toBe('node-1')
    expect(store.nodes[0]?.type).toBe('dw')
    expect(store.canRun).toBe(true)
    expect(invoke).toHaveBeenCalledWith('workflow.addNode', {
      workflowId: 'wf-1',
      qualifiedName: constantType.qualifiedName,
      position: { x: 40, y: 80 }
    })
  })

  it('does not insert a node when addNode RPC fails', async () => {
    const store = useWorkflowStore()
    await store.bootstrap()
    invoke.mockImplementationOnce(async () => {
      throw new Error('sidecar refused')
    })
    await expect(store.addNode(constantType.qualifiedName)).rejects.toThrow('sidecar refused')
    expect(store.nodes).toEqual([])
    expect(store.canRun).toBe(false)
  })

  it('adds an edge only after connect RPC succeeds', async () => {
    const store = useWorkflowStore()
    await store.addNode(constantType.qualifiedName)
    await store.addNode(dataMgrType.qualifiedName)
    invoke.mockImplementationOnce(async () => {
      throw new Error('duplicate')
    })
    await expect(
      store.connectPorts({
        source: 'node-1',
        target: 'node-2',
        sourceHandle: 'value',
        targetHandle: 'data'
      })
    ).rejects.toThrow('duplicate')
    expect(store.edges).toEqual([])

    await store.connectPorts({
      source: 'node-1',
      target: 'node-2',
      sourceHandle: 'value',
      targetHandle: 'data'
    })
    expect(store.edges).toHaveLength(1)
    expect(store.edges[0]?.id).toBe('conn-1')
  })

  it('wraps loadLogic via getGraph and never calls addNode', async () => {
    const store = useWorkflowStore()
    await store.bootstrap()
    invoke.mockClear()
    const graph = {
      workflowId: 'wf-loaded',
      name: 'logic',
      nodes: [
        {
          nodeId: 'const-1',
          qualifiedName: constantType.qualifiedName,
          parameters: { value: '[10, 20]' }
        },
        {
          nodeId: 'out-1',
          qualifiedName: dataMgrType.qualifiedName,
          parameters: { data_name: 'from_workflow' }
        }
      ],
      connections: [
        {
          connectionId: 'edge-1',
          fromId: 'const-1',
          fromPort: 'value',
          toId: 'out-1',
          toPort: 'data'
        }
      ]
    }
    invoke.mockImplementation(async (method: string) => {
      if (method === 'workflow.loadLogic') {
        return { workflowId: 'wf-loaded', name: 'logic' }
      }
      if (method === 'workflow.getGraph') {
        return graph
      }
      throw new Error(`unexpected ${method}`)
    })
    await store.loadAndWrap({ name: 'logic' })
    const methods = invoke.mock.calls.map((call) => call[0])
    expect(methods).toEqual(['workflow.loadLogic', 'workflow.getGraph'])
    expect(store.workflowId).toBe('wf-loaded')
    expect(store.nodes.map((item) => item.id)).toEqual(['const-1', 'out-1'])
    expect(store.edges).toHaveLength(1)
    expect(store.edges[0]?.id).toBe('edge-1')
    expect(store.paramValues['const-1']?.value).toBe('[10, 20]')
    expect(invoke).toHaveBeenCalledWith('workflow.loadLogic', {
      payload: { name: 'logic' },
      format: 'json',
      workflowId: 'wf-1'
    })
  })

  it('loadAndWrap lists types then wraps without create or addNode', async () => {
    const store = useWorkflowStore()
    invoke.mockImplementation(async (method: string) => {
      if (method === 'workflow.listNodeTypes') {
        return { types: [constantType, dataMgrType] }
      }
      if (method === 'workflow.loadLogic') {
        return { workflowId: 'wf-fresh', name: 'logic' }
      }
      if (method === 'workflow.getGraph') {
        return {
          workflowId: 'wf-fresh',
          name: 'logic',
          nodes: [
            {
              nodeId: 'const-1',
              qualifiedName: constantType.qualifiedName,
              parameters: { value: '1' }
            }
          ],
          connections: []
        }
      }
      throw new Error(`unexpected ${method}`)
    })
    await store.loadAndWrap({ name: 'logic' })
    expect(invoke.mock.calls.map((call) => call[0])).toEqual([
      'workflow.listNodeTypes',
      'workflow.loadLogic',
      'workflow.getGraph'
    ])
    expect(store.workflowId).toBe('wf-fresh')
    expect(store.nodes).toHaveLength(1)
  })

  it('keeps canvas positions when wrapping the same node ids', async () => {
    const store = useWorkflowStore()
    store.types = [constantType]
    store.nodes = [
      {
        id: 'const-1',
        type: 'dw',
        position: { x: 240, y: 160 },
        data: {
          label: 'Constant',
          qualifiedName: constantType.qualifiedName,
          state: 'idle',
          inputs: [],
          outputs: constantType.outputs
        }
      }
    ]
    store.applyWrappedGraph({
      workflowId: 'wf-2',
      name: 'logic',
      nodes: [
        {
          nodeId: 'const-1',
          qualifiedName: constantType.qualifiedName,
          parameters: { value: '1' }
        }
      ],
      connections: []
    })
    expect(store.nodes[0]?.position).toEqual({ x: 240, y: 160 })
  })

  it('clears running when the sidecar reports finished', async () => {
    const store = useWorkflowStore()
    await store.addNode(constantType.qualifiedName)
    await store.run()
    expect(store.running).toBe(true)
    expect(store.canEditGraph).toBe(false)
    store.applyFinished('wf-1', true)
    expect(store.running).toBe(false)
    expect(store.canRun).toBe(true)
  })
})
