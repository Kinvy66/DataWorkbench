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
