import { describe, expect, it } from 'vitest'
import { parseSvgPixelSize, wrapSvgAsPrintHtml } from './svg-print'

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
<text>分数随年龄</text>
</svg>`

describe('svg print html for PDF', () => {
  it('reads width and height from the svg', () => {
    expect(parseSvgPixelSize(SAMPLE)).toEqual({ width: 960, height: 540 })
    expect(parseSvgPixelSize('<svg></svg>')).toEqual({ width: 960, height: 540 })
  })

  it('wraps svg as a zero-margin print page and keeps Chinese', () => {
    const html = wrapSvgAsPrintHtml(SAMPLE)
    expect(html).toContain('@page { size: 960px 540px; margin: 0; }')
    expect(html).not.toContain('<?xml')
    expect(html).toContain('分数随年龄')
    expect(html).toContain('Microsoft YaHei')
  })
})
