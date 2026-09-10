import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.mock('@/rpc/bridge', () => ({
  getDesktopBridge: () => ({
    rpc: { invoke, on: vi.fn() }
  })
}))

import { useChartStore } from './chart'
import { useDataStore } from './data'
import { useWorkflowStore } from './workflow'

describe('useChartStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    invoke.mockReset()
    invoke.mockResolvedValue({
      x: [0, 1, 2],
      ys: [[1, 2, 3]],
      pointCount: 3,
      sourceCount: 3,
      downsampled: false,
      xKind: 'number',
      maxPoints: 5000
    })
  })

  it('builds a line chart and switches the center tab to figure', async () => {
    const data = useDataStore()
    data.datasets = [{ id: 'ds-1', name: 'wave', rows: 3, cols: 2 }]
    const workflow = useWorkflowStore()
    const chart = useChartStore()
    const created = await chart.createFromBind({
      type: 'line',
      dataId: 'ds-1',
      x: 't',
      y: ['ch1']
    })
    expect(invoke).toHaveBeenCalledWith('chart.buildSeries', {
      dataId: 'ds-1',
      x: 't',
      y: ['ch1'],
      maxPoints: 5000
    })
    expect(created.data?.pointCount).toBe(3)
    expect(created.series[0].color).toBe('#5280C1')
    expect(chart.currentId).toBe(created.id)
    expect(workflow.centerTab).toBe('figure')
  })

  it('drops charts whose dataset is gone', () => {
    const chart = useChartStore()
    chart.charts = [
      {
        id: 'c1',
        type: 'line',
        dataId: 'gone',
        x: 't',
        y: ['y'],
        title: 'gone',
        xLabel: 't',
        yLabel: 'y',
        grid: true,
        legend: true,
        series: [{ key: 'y', color: '#5280C1', width: 1.5 }],
        data: null
      }
    ]
    chart.currentId = 'c1'
    chart.prune(['keep'])
    expect(chart.charts).toEqual([])
    expect(chart.currentId).toBeNull()
  })
})
