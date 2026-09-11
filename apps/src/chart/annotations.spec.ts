import { describe, expect, it } from 'vitest'
import {
  ANNOTATION_COLOR,
  annotationSvgMarkup,
  parseChartAnnotation,
  parseChartAnnotations,
  seriesToSvg
} from '@dw/chart-core'

const scale = {
  x: (value: number) => value * 10,
  y: (value: number) => 100 - value * 10,
  plotLeft: 0,
  plotTop: 0,
  plotWidth: 200,
  plotHeight: 100
}

describe('parseChartAnnotations', () => {
  it('keeps valid items and drops junk', () => {
    expect(parseChartAnnotations(undefined)).toEqual([])
    expect(
      parseChartAnnotations([
        { id: 'a', kind: 'text', x: 1, y: 2, text: 'peak', color: '#CE6043' },
        { kind: 'text', x: 1 },
        { id: 'b', kind: 'nope', x: 1, y: 2 }
      ])
    ).toEqual([
      {
        id: 'a',
        kind: 'text',
        x: 1,
        y: 2,
        x2: 1,
        y2: 2,
        text: 'peak',
        color: '#CE6043'
      }
    ])
  })

  it('requires arrow end and region x2', () => {
    expect(parseChartAnnotation({ id: 'a', kind: 'arrow', x: 0, y: 1 })).toBeNull()
    expect(parseChartAnnotation({ id: 'r', kind: 'region', x: 0, x2: 4 })).toMatchObject({
      kind: 'region',
      x: 0,
      x2: 4,
      color: ANNOTATION_COLOR
    })
  })
})

describe('annotationSvgMarkup', () => {
  it('draws text, point, arrow and a vertical region band', () => {
    const svg = annotationSvgMarkup(
      [
        { id: 't', kind: 'text', x: 1, y: 2, x2: 1, y2: 2, text: '峰值', color: '#CE6043' },
        { id: 'p', kind: 'point', x: 2, y: 3, x2: 2, y2: 3, text: '', color: '#5280C1' },
        { id: 'a1', kind: 'arrow', x: 0, y: 0, x2: 4, y2: 4, text: '', color: '#669E8B' },
        { id: 'r', kind: 'region', x: 1, y: 0, x2: 3, y2: 0, text: 'band', color: '#E6C27C' }
      ],
      scale
    )
    expect(svg).toContain('峰值')
    expect(svg).toContain('<circle')
    expect(svg).toContain('marker-end')
    expect(svg).toContain('band')
    expect(svg).toContain('clipPath')
  })
})

describe('seriesToSvg annotations', () => {
  it('embeds annotation text in the exported svg', () => {
    const svg = seriesToSvg({
      kind: 'line',
      title: 'Run 01',
      legend: false,
      grid: false,
      styles: [{ label: 'y', color: '#5280C1', width: 1 }],
      data: { x: [0, 1, 2], ys: [[1, 2, 3]], xKind: 'number' },
      annotations: [
        { id: 'n1', kind: 'text', x: 1, y: 2, x2: 1, y2: 2, text: 'peak', color: '#CE6043' }
      ]
    })
    expect(svg).toContain('peak')
    expect(svg).toContain('clipPath')
  })
})
