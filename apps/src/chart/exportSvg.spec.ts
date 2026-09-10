import { describe, expect, it } from 'vitest'
import { seriesToSvg, suggestedExportName, xmlEscape } from '@dw/chart-core'

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
})

describe('suggestedExportName', () => {
  it('strips illegal path characters', () => {
    expect(suggestedExportName('Run 01: a/b', 'svg')).toBe('Run 01_ a_b.svg')
  })
})

describe('xmlEscape', () => {
  it('escapes markup', () => {
    expect(xmlEscape('a < b & "c"')).toBe('a &lt; b &amp; &quot;c&quot;')
  })
})
