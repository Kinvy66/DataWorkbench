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
    expect(created.window).toBeNull()
    expect(created.series[0].color).toBe('#5280C1')
    expect(chart.currentId).toBe(created.id)
    expect(chart.figures).toHaveLength(1)
    expect(chart.figures[0]?.slots).toEqual([created.id])
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
        annotations: [],
        data: null,
        window: null
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

  it('places text immediately and arrows on the second click', async () => {
    const data = useDataStore()
    data.datasets = [{ id: 'ds-1', name: 'wave', rows: 3, cols: 2 }]
    const chart = useChartStore()
    await chart.createFromBind({ type: 'line', dataId: 'ds-1', x: 't', y: ['ch1'] })
    chart.togglePlace('text')
    expect(chart.placeAt({ x: 1, y: 2 })).toBe(true)
    expect(chart.current?.annotations).toHaveLength(1)
    expect(chart.current?.annotations[0]).toMatchObject({ kind: 'text', text: 'Note', x: 1, y: 2 })
    expect(chart.placeKind).toBeNull()
    chart.togglePlace('arrow')
    expect(chart.placeAt({ x: 0, y: 0 })).toBe(false)
    expect(chart.placeAt({ x: 3, y: 4 })).toBe(true)
    expect(chart.current?.annotations).toHaveLength(2)
    expect(chart.current?.annotations[1]).toMatchObject({ kind: 'arrow', x: 0, y: 0, x2: 3, y2: 4 })
  })

  it('restores annotations from charts.json and defaults missing lists', async () => {
    invoke.mockResolvedValue({
      x: [0, 1],
      ys: [[1, 2]],
      pointCount: 2,
      sourceCount: 2,
      downsampled: false,
      xKind: 'number',
      maxPoints: 5000
    })
    const chart = useChartStore()
    await chart.restoreFromFile({
      currentId: 'c1',
      charts: [
        {
          id: 'c1',
          type: 'line',
          dataId: 'ds-1',
          x: 't',
          y: ['ch1'],
          title: 'wave',
          xLabel: 't',
          yLabel: 'ch1',
          grid: true,
          legend: true,
          series: [{ key: 'ch1', color: '#5280C1', width: 1.5 }],
          annotations: [{ id: 'n1', kind: 'text', x: 1, y: 2, text: 'peak', color: '#CE6043' }]
        },
        {
          id: 'c2',
          type: 'line',
          dataId: 'ds-1',
          x: 't',
          y: ['ch1'],
          title: 'old',
          xLabel: 't',
          yLabel: 'ch1',
          grid: true,
          legend: true,
          series: [{ key: 'ch1', color: '#5280C1', width: 1.5 }]
        }
      ]
    })
    expect(chart.charts[0]?.annotations[0]?.text).toBe('peak')
    expect(chart.charts[1]?.annotations).toEqual([])
    expect(chart.figures).toHaveLength(2)
    expect(chart.currentFigureId).toBeTruthy()
  })

  it('embeds annotations when exporting svg', async () => {
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
    chart.togglePlace('text')
    chart.placeAt({ x: 1, y: 2 })
    if (chart.current) {
      chart.updateAnnotation(chart.current.annotations[0]!.id, { text: 'peak' })
    }
    const ok = await chart.saveExport('svg')
    expect(ok).toBe(true)
    const payload = invoke.mock.calls.find((call) => call[0] === 'chart.saveExport')?.[1] as {
      content: string
    }
    expect(payload.content).toContain('peak')
  })

  it('saves pdf via chart.saveExport with svg markup', async () => {
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
    const ok = await chart.saveExport('pdf')
    expect(ok).toBe(true)
    expect(invoke).toHaveBeenCalledWith(
      'chart.saveExport',
      expect.objectContaining({
        format: 'pdf',
        suggestedName: 'Run 01.pdf',
        content: expect.stringContaining('<svg')
      })
    )
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

  it('rebuilds a window with xMin/xMax and resetWindow omits them', async () => {
    const data = useDataStore()
    data.datasets = [{ id: 'ds-1', name: 'wave', rows: 8, cols: 2 }]
    const chart = useChartStore()
    const created = await chart.createFromBind({
      type: 'line',
      dataId: 'ds-1',
      x: 't',
      y: ['ch1']
    })
    invoke.mockClear()
    invoke.mockResolvedValue({
      x: [2, 3, 4],
      ys: [[9, 8, 7]],
      pointCount: 3,
      sourceCount: 3,
      downsampled: false,
      xKind: 'number',
      maxPoints: 5000
    })
    expect(await chart.rebuildWindow(created.id, { xMin: 2, xMax: 4 })).toBe(true)
    expect(invoke).toHaveBeenCalledWith('chart.buildSeries', {
      dataId: 'ds-1',
      x: 't',
      y: ['ch1'],
      maxPoints: 5000,
      xMin: 2,
      xMax: 4
    })
    expect(chart.charts[0].window).toEqual({ xMin: 2, xMax: 4 })
    expect(chart.charts[0].data?.x).toEqual([2, 3, 4])

    invoke.mockClear()
    invoke.mockResolvedValue({
      x: [0, 1, 2],
      ys: [[1, 2, 3]],
      pointCount: 3,
      sourceCount: 8,
      downsampled: false,
      xKind: 'number',
      maxPoints: 5000
    })
    expect(await chart.resetWindow(created.id)).toBe(true)
    expect(invoke).toHaveBeenCalledWith('chart.buildSeries', {
      dataId: 'ds-1',
      x: 't',
      y: ['ch1'],
      maxPoints: 5000
    })
    expect(chart.charts[0].window).toBeNull()
  })

  it('rebuilds a histogram window with kind hist', async () => {
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
      y: ['ch1']
    })
    invoke.mockClear()
    invoke.mockResolvedValue({
      x: [0.25, 0.75],
      ys: [[2, 3]],
      pointCount: 2,
      sourceCount: 5,
      downsampled: false,
      xKind: 'number',
      maxPoints: 50
    })
    await chart.rebuildWindow(created.id, { xMin: 0, xMax: 1 })
    expect(invoke).toHaveBeenCalledWith('chart.buildSeries', {
      dataId: 'ds-1',
      y: ['ch1'],
      kind: 'hist',
      bins: 50,
      xMin: 0,
      xMax: 1
    })
  })

  it('ignores a stale window rebuild', async () => {
    const data = useDataStore()
    data.datasets = [{ id: 'ds-1', name: 'wave', rows: 8, cols: 2 }]
    const chart = useChartStore()
    const created = await chart.createFromBind({
      type: 'line',
      dataId: 'ds-1',
      x: 't',
      y: ['ch1']
    })
    let resolveFirst!: (value: unknown) => void
    const first = new Promise((resolve) => {
      resolveFirst = resolve
    })
    invoke.mockImplementationOnce(() => first)
    invoke.mockResolvedValueOnce({
      x: [20, 30],
      ys: [[2, 3]],
      pointCount: 2,
      sourceCount: 2,
      downsampled: false,
      xKind: 'number',
      maxPoints: 5000
    })
    const stale = chart.rebuildWindow(created.id, { xMin: 0, xMax: 10 })
    const fresh = chart.rebuildWindow(created.id, { xMin: 20, xMax: 30 })
    await expect(fresh).resolves.toBe(true)
    resolveFirst({
      x: [0, 10],
      ys: [[1, 2]],
      pointCount: 2,
      sourceCount: 2,
      downsampled: false,
      xKind: 'number',
      maxPoints: 5000
    })
    await expect(stale).resolves.toBe(false)
    expect(chart.charts[0].window).toEqual({ xMin: 20, xMax: 30 })
    expect(chart.charts[0].data?.x).toEqual([20, 30])
  })

  it('creates a subplot grid and binds the selected cell', async () => {
    const data = useDataStore()
    data.datasets = [{ id: 'ds-1', name: 'wave', rows: 3, cols: 2 }]
    const chart = useChartStore()
    const figure = chart.createSubplots('2x2')
    expect(figure?.slots).toEqual([null, null, null, null])
    expect(chart.currentId).toBeNull()
    const first = await chart.createFromBind({ type: 'line', dataId: 'ds-1', x: 't', y: ['ch1'], title: 'TL' })
    expect(chart.figures).toHaveLength(1)
    expect(chart.figures[0]?.slots[0]).toBe(first.id)
    chart.selectSlot(1)
    const second = await chart.createFromBind({ type: 'line', dataId: 'ds-1', x: 't', y: ['ch1'], title: 'TR' })
    expect(chart.figures[0]?.slots[1]).toBe(second.id)
    expect(chart.charts.map((item) => item.title)).toEqual(['TL', 'TR'])
    invoke.mockImplementation(async (method: string) => {
      if (method === 'chart.saveExport') {
        return { ok: true }
      }
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
      return {}
    })
    expect(await chart.saveExport('svg')).toBe(true)
    const payload = invoke.mock.calls.find((call) => call[0] === 'chart.saveExport')?.[1] as {
      content: string
      suggestedName: string
    }
    expect(payload.suggestedName).toBe('2×2.svg')
    expect(payload.content).toContain('TL')
    expect(payload.content).toContain('TR')
  })

  it('restores a saved subplot figure', async () => {
    invoke.mockResolvedValue({
      x: [0, 1],
      ys: [[1, 2]],
      pointCount: 2,
      sourceCount: 2,
      downsampled: false,
      xKind: 'number',
      maxPoints: 5000
    })
    const chart = useChartStore()
    await chart.restoreFromFile({
      currentId: 'c2',
      currentFigureId: 'fig-1',
      figures: [
        {
          id: 'fig-1',
          title: 'Pair',
          rows: 1,
          cols: 2,
          slots: ['c1', 'c2']
        }
      ],
      charts: [
        {
          id: 'c1',
          type: 'line',
          dataId: 'ds-1',
          x: 't',
          y: ['a'],
          title: 'A',
          xLabel: 't',
          yLabel: 'a',
          grid: true,
          legend: true,
          series: [{ key: 'a', color: '#5280C1', width: 1.5 }]
        },
        {
          id: 'c2',
          type: 'line',
          dataId: 'ds-1',
          x: 't',
          y: ['b'],
          title: 'B',
          xLabel: 't',
          yLabel: 'b',
          grid: true,
          legend: true,
          series: [{ key: 'b', color: '#669E8B', width: 1.5 }]
        }
      ]
    })
    expect(chart.figures).toHaveLength(1)
    expect(chart.currentFigureId).toBe('fig-1')
    expect(chart.currentId).toBe('c2')
    expect(chart.currentSlotIndex).toBe(1)
    expect(chart.figures[0]?.title).toBe('Pair')
  })

  it('sends custom hist bins on create and extra hist params on updateHist', async () => {
    invoke.mockResolvedValue({
      x: [0.5, 1.5],
      ys: [[4, 6]],
      pointCount: 2,
      sourceCount: 10,
      downsampled: false,
      xKind: 'number',
      maxPoints: 12
    })
    const data = useDataStore()
    data.datasets = [{ id: 'ds-1', name: 'wave', rows: 10, cols: 1 }]
    const chart = useChartStore()
    const created = await chart.createFromBind({
      type: 'hist',
      dataId: 'ds-1',
      y: ['ch1'],
      yLabel: 'Count',
      bins: 12
    })
    expect(invoke).toHaveBeenCalledWith('chart.buildSeries', {
      dataId: 'ds-1',
      y: ['ch1'],
      kind: 'hist',
      bins: 12
    })
    expect(created.bins).toBe(12)
    invoke.mockClear()
    await chart.updateHist(created.id, { binWidth: 1.5, histStat: 'density' })
    expect(invoke).toHaveBeenCalledWith('chart.buildSeries', {
      dataId: 'ds-1',
      y: ['ch1'],
      kind: 'hist',
      bins: 12,
      binWidth: 1.5,
      histStat: 'density'
    })
    expect(created.histStat).toBe('density')
    expect(created.yLabel).toBe('Density')
    chart.updateStyle(created.id, { yLabel: 'custom' })
    invoke.mockClear()
    await chart.updateHist(created.id, { histStat: 'percent' })
    expect(created.yLabel).toBe('custom')
    expect(created.histStat).toBe('percent')
  })

  it('restores hist fields and defaults missing ones on rebuild', async () => {
    invoke.mockResolvedValue({
      x: [0.5],
      ys: [[1]],
      pointCount: 1,
      sourceCount: 1,
      downsampled: false,
      xKind: 'number',
      maxPoints: 50
    })
    const chart = useChartStore()
    await chart.restoreFromFile({
      currentId: 'h1',
      charts: [
        {
          id: 'h1',
          type: 'hist',
          dataId: 'ds-1',
          x: 'v',
          y: ['v'],
          title: 'dense',
          xLabel: 'v',
          yLabel: 'Density',
          grid: true,
          legend: true,
          series: [{ key: 'v', color: '#5280C1', width: 1.5 }],
          bins: 20,
          binWidth: 0.5,
          histStat: 'density',
          histCumulative: true
        },
        {
          id: 'h2',
          type: 'hist',
          dataId: 'ds-1',
          x: 'v',
          y: ['v'],
          title: 'old',
          xLabel: 'v',
          yLabel: 'Count',
          grid: true,
          legend: true,
          series: [{ key: 'v', color: '#5280C1', width: 1.5 }]
        }
      ]
    })
    expect(chart.charts[0]?.bins).toBe(20)
    expect(chart.charts[0]?.binWidth).toBe(0.5)
    expect(chart.charts[0]?.histStat).toBe('density')
    expect(chart.charts[0]?.histCumulative).toBe(true)
    expect(chart.charts[1]?.bins).toBeUndefined()
    invoke.mockClear()
    await chart.rebuildWindow('h2')
    expect(invoke).toHaveBeenCalledWith('chart.buildSeries', {
      dataId: 'ds-1',
      y: ['v'],
      kind: 'hist',
      bins: 50
    })
    invoke.mockClear()
    await chart.rebuildWindow('h1')
    expect(invoke).toHaveBeenCalledWith('chart.buildSeries', {
      dataId: 'ds-1',
      y: ['v'],
      kind: 'hist',
      bins: 20,
      binWidth: 0.5,
      histStat: 'density',
      histCumulative: true
    })
  })
})
