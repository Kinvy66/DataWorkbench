import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.mock('@/rpc/bridge', () => ({
  getDesktopBridge: () => ({
    rpc: { invoke, on: vi.fn() }
  })
}))

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), error: vi.fn() },
  ElMessageBox: { confirm: vi.fn() }
}))

import { captureCharts, captureUiLayout, saveProject } from '@/project/session'
import { useChartStore } from '@/stores/chart'
import { useDataStore } from '@/stores/data'
import { useProjectStore } from '@/stores/project'
import { useWorkflowStore } from '@/stores/workflow'

describe('useProjectStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('ignores touch while restoring', () => {
    const project = useProjectStore()
    project.beginRestore()
    project.touch()
    expect(project.dirty).toBe(false)
    project.endRestore()
    project.touch()
    expect(project.dirty).toBe(true)
  })
})

describe('project session', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    invoke.mockReset()
    invoke.mockImplementation(async (method: string) => {
      if (method === 'project.save') {
        return { ok: true, path: 'C:/tmp/demo.dwproj' }
      }
      if (method === 'workflow.listNodeTypes') {
        return { types: [] }
      }
      if (method === 'workflow.create') {
        return { workflowId: 'wf-1' }
      }
      if (method === 'app.setDocument') {
        return { ok: true }
      }
      return {}
    })
  })

  it('captures layout and charts without sampled points', async () => {
    const data = useDataStore()
    data.datasets = [{ id: 'ds-1', name: 'people', rows: 2, cols: 2 }]
    data.currentId = 'ds-1'
    const workflow = useWorkflowStore()
    workflow.workflowId = 'wf-1'
    workflow.nodes = [
      {
        id: 'n1',
        type: 'dw',
        position: { x: 40, y: 80 },
        data: { label: 'Constant', qualifiedName: 'Constant' }
      }
    ]
    workflow.centerTab = 'figure'
    const chart = useChartStore()
    chart.charts = [
      {
        id: 'c1',
        type: 'line',
        dataId: 'ds-1',
        x: 'age',
        y: ['value'],
        title: 'ages',
        xLabel: 'age',
        yLabel: 'value',
        grid: true,
        legend: true,
        series: [{ key: 'value', color: '#5280C1', width: 1.5 }],
        annotations: [],
        data: {
          x: [1, 2],
          ys: [[3, 4]],
          pointCount: 2,
          sourceCount: 2,
          downsampled: false,
          xKind: 'number',
          maxPoints: 5000
        },
        window: { xMin: 0, xMax: 1 }
      }
    ]
    chart.currentId = 'c1'
    const layout = captureUiLayout()
    expect(layout.nodes.n1).toEqual({ x: 40, y: 80 })
    expect(layout.currentDataId).toBe('ds-1')
    const charts = captureCharts()
    expect(charts.charts[0]?.y).toEqual(['value'])
    expect(JSON.stringify(charts)).not.toContain('"data":')
    expect(JSON.stringify(charts)).not.toContain('window')
  })

  it('saves through project.save and clears dirty', async () => {
    const project = useProjectStore()
    project.dirty = true
    const workflow = useWorkflowStore()
    workflow.workflowId = 'wf-1'
    const ok = await saveProject(false)
    expect(ok).toBe(true)
    expect(project.dirty).toBe(false)
    expect(project.path).toBe('C:/tmp/demo.dwproj')
    const call = invoke.mock.calls.find((item) => item[0] === 'project.save')
    expect(call?.[1]).toMatchObject({ workflowId: 'wf-1' })
    expect(JSON.stringify(call?.[1])).not.toContain('"pointCount"')
  })
})
