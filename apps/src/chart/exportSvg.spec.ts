import { describe, expect, it } from 'vitest'
import { figureToSvg, seriesToSvg, suggestedExportName, xmlEscape } from '@dw/chart-core'

describe('seriesToSvg', () => {
  it('draws a line path and the title', () => {
    const svg = seriesToSvg({
      kind: 'line',
      title: 'Run 01',
      xLabel: 't',
      yLabel: 'ch1',
      legend: true,
      grid: true,
      styles: [{ label: 'ch1', color: '#5280C1', width: 1.5 }],
      data: {
        x: [0, 1, 2, 3],
        ys: [[1, 2, 3, 4]],
        xKind: 'number'
      }
    })
    expect(svg).toContain('<svg')
    expect(svg).toContain('Run 01')
    expect(svg).toContain('<path')
    expect(svg).toContain('#5280C1')
    expect(svg).toContain('ch1')
    expect(svg).toContain('font-family="Microsoft YaHei')
  })

  it('keeps a Chinese title as text', () => {
    const svg = seriesToSvg({
      kind: 'line',
      title: '分数随年龄',
      legend: false,
      grid: false,
      styles: [{ label: 'y', color: '#5280C1', width: 1 }],
      data: {
        x: [0, 1],
        ys: [[1, 2]],
        xKind: 'number'
      }
    })
    expect(svg).toContain('分数随年龄')
  })

  it('splits the path when y is null', () => {
    const svg = seriesToSvg({
      kind: 'line',
      legend: false,
      grid: false,
      styles: [{ label: 'y', color: '#5280C1', width: 1 }],
      data: {
        x: [0, 1, 2, 3],
        ys: [[1, null, 3, 4]],
        xKind: 'number'
      }
    })
    const paths = svg.match(/<path /g) ?? []
    expect(paths.length).toBe(2)
  })

  it('draws scatter as circles', () => {
    const svg = seriesToSvg({
      kind: 'scatter',
      legend: false,
      grid: false,
      styles: [{ label: 'y', color: '#CE6043', width: 2 }],
      data: {
        x: [0, 1, 2],
        ys: [[1, 2, 3]],
        xKind: 'number'
      }
    })
    expect(svg).toContain('<circle')
    expect(svg).not.toContain('<path')
  })

  it('draws hist as rects', () => {
    const svg = seriesToSvg({
      kind: 'hist',
      legend: false,
      grid: false,
      styles: [{ label: 'v', color: '#5280C1', width: 1 }],
      data: {
        x: [0.5, 1.5, 2.5],
        ys: [[2, 5, 3]],
        xKind: 'number'
      }
    })
    const rects = svg.match(/<rect /g) ?? []
    expect(rects.length).toBeGreaterThan(1)
    expect(svg).not.toContain('<path')
    expect(svg).not.toContain('<circle')
  })

  it('draws box plots from Tukey stats, not as bars', () => {
    const svg = seriesToSvg({
      kind: 'box',
      legend: true,
      grid: false,
      styles: [{ label: 'score', color: '#5280C1', width: 1.5 }],
      data: {
        x: [0],
        ys: [[1], [9]],
        xKind: 'number',
        boxes: [
          {
            key: 'score',
            n: 6,
            q1: 2,
            median: 5,
            q3: 7,
            whiskerLow: 1,
            whiskerHigh: 8,
            outliers: [12]
          }
        ]
      }
    })
    expect(svg).toContain('score')
    expect(svg).toContain('#5280C1')
    expect(svg).toContain('<circle')
    expect(svg).toMatch(/fill-opacity="0\.18"/)
  })
})

describe('figureToSvg', () => {
  const panel = {
    kind: 'line' as const,
    title: 'A',
    legend: false,
    grid: false,
    styles: [{ label: 'y', color: '#5280C1', width: 1 }],
    data: { x: [0, 1], ys: [[1, 2]], xKind: 'number' as const }
  }

  it('nests panel titles in a grid', () => {
    const svg = figureToSvg({
      title: 'Grid',
      rows: 1,
      cols: 2,
      panels: [panel, { ...panel, title: 'B' }]
    })
    expect(svg).toContain('Grid')
    expect(svg).toContain('>A<')
    expect(svg).toContain('>B<')
    expect(svg.match(/<svg /g)?.length).toBeGreaterThanOrEqual(3)
  })
})

describe('suggestedExportName', () => {
  it('strips illegal path characters', () => {
    expect(suggestedExportName('Run 01: a/b', 'svg')).toBe('Run 01_ a_b.svg')
    expect(suggestedExportName('Run 01', 'pdf')).toBe('Run 01.pdf')
  })
})

describe('xmlEscape', () => {
  it('escapes markup', () => {
    expect(xmlEscape('a < b & "c"')).toBe('a &lt; b &amp; &quot;c&quot;')
  })
})
