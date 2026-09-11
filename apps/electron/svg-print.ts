import { SVG_TEXT_FONT } from '../../packages/chart-core/src/exportSvg'

export function parseSvgPixelSize(svg: string): { width: number; height: number } {
  const width = Number(/width="([\d.]+)"/.exec(svg)?.[1])
  const height = Number(/height="([\d.]+)"/.exec(svg)?.[1])
  return {
    width: Number.isFinite(width) && width > 0 ? width : 960,
    height: Number.isFinite(height) && height > 0 ? height : 540
  }
}

export function wrapSvgAsPrintHtml(svg: string): string {
  const body = svg.replace(/^\s*<\?xml[^>]*>\s*/i, '')
  const { width, height } = parseSvgPixelSize(svg)
  const font = SVG_TEXT_FONT.replace(/"/g, '')
  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8"><style>',
    `@page { size: ${width}px ${height}px; margin: 0; }`,
    'html, body { margin: 0; padding: 0; background: #fff; }',
    'svg { display: block; }',
    `text, svg { font-family: ${font}; }`,
    '</style></head><body>',
    body,
    '</body></html>'
  ].join('')
}
