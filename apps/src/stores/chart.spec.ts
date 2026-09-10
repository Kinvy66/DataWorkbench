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

  it('builds a histogram without sending x or maxPoints', async () => {
    invoke.mockResolvedValue({
      x: [0.5, 1.5],
      ys: [[4, 6]],
      pointCount: 2,
      sourceCount: 10,
      downsampled: false,
      xKind: 'number',
      maxPoints: 50
    })
    const data = useDataStore()
    data.datasets = [{ id: 'ds-1', name: 'wave', rows: 10, cols: 1 }]
    const chart = useChartStore()
    const created = await chart.createFromBind({
      type: 'hist',
      dataId: 'ds-1',
      y: ['ch1'],
      yLabel: 'Count'
    })
    expect(invoke).toHaveBeenCalledWith('chart.buildSeries', {
      dataId: 'ds-1',
      y: ['ch1'],
      kind: 'hist',
      bins: 50
    })
    expect(created.type).toBe('hist')
    expect(created.xLabel).toBe('ch1')
    expect(created.yLabel).toBe('Count')
    expect(created.data?.pointCount).toBe(2)
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

  it('saves svg via chart.saveExport', async () => {
    invoke.mockImplementation(async (method: string) => {
      if (method === 'chart.buildSeries') {
        return {
          x: [0, 1, 2],
          ys: [[1, 2, 3]],
          pointCount: 3,
          sourceCount: 3,
          downsampled: false,
          xKind: 'number',
          maxPoints: 5000
        }
      }
      if (method === 'chart.saveExport') {
        return { ok: true }
      }
      return {}
    })
    const data = useDataStore()
    data.datasets = [{ id: 'ds-1', name: 'wave', rows: 3, cols: 2 }]
    const chart = useChartStore()
    await chart.createFromBind({
      type: 'line',
      dataId: 'ds-1',
      x: 't',
      y: ['ch1'],
      title: 'Run 01'
    })
    const ok = await chart.saveExport('svg')
    expect(ok).toBe(true)
    expect(invoke).toHaveBeenCalledWith(
      'chart.saveExport',
      expect.objectContaining({
        format: 'svg',
        suggestedName: 'Run 01.svg',
        content: expect.stringContaining('<svg')
      })
    )
    const payload = invoke.mock.calls.find((call) => call[0] === 'chart.saveExport')?.[1] as {
      content: string
    }
    expect(payload.content).toContain('Run 01')
    expect(payload.content).toContain('<path')
  })

  it('returns false when the save dialog is cancelled', async () => {
    invoke.mockImplementation(async (method: string) => {
      if (method === 'chart.buildSeries') {
        return {
          x: [0, 1],
          ys: [[1, 2]],
          pointCount: 2,
          sourceCount: 2,
          downsampled: false,
          xKind: 'number',
          maxPoints: 5000
        }
      }
      if (method === 'chart.saveExport') {
        return { cancelled: true }
      }
      return {}
    })
    const data = useDataStore()
    data.datasets = [{ id: 'ds-1', name: 'wave', rows: 2, cols: 2 }]
    const chart = useChartStore()
    await chart.createFromBind({ type: 'line', dataId: 'ds-1', x: 't', y: ['ch1'] })
    expect(await chart.saveExport('svg')).toBe(false)
  })

  it('throws when there is no chart to export', async () => {
    const chart = useChartStore()
    await expect(chart.saveExport('svg')).rejects.toMatchObject({ i18nKey: 'chart.exportMissing' })
  })
})
