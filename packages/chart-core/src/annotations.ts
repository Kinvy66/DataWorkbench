import { SVG_TEXT_FONT, xmlEscape } from './svgText'

export const ANNOTATION_COLOR = '#CE6043'

export type ChartAnnotationKind = 'text' | 'point' | 'arrow' | 'region'

export type ChartAnnotation = {
  id: string
  kind: ChartAnnotationKind
  color: string
  text: string
  x: number
  y: number
  x2: number
  y2: number
}

export type AnnotationScale = {
  x: (value: number) => number
  y: (value: number) => number
  plotLeft: number
  plotTop: number
  plotWidth: number
  plotHeight: number
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asKind(value: unknown): ChartAnnotationKind | null {
  return value === 'text' || value === 'point' || value === 'arrow' || value === 'region'
    ? value
    : null
}

export function parseChartAnnotation(raw: unknown): ChartAnnotation | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }
  const src = raw as Record<string, unknown>
  const kind = asKind(src.kind)
  const id = typeof src.id === 'string' ? src.id.trim() : ''
  const x = finite(src.x)
  if (!kind || !id || x == null) {
    return null
  }
  const color = typeof src.color === 'string' && src.color.trim() ? src.color.trim() : ANNOTATION_COLOR
  const text = typeof src.text === 'string' ? src.text : ''
  const y = finite(src.y) ?? 0
  const x2 = finite(src.x2) ?? x
  const y2 = finite(src.y2) ?? y
  if (kind === 'arrow' && (finite(src.x2) == null || finite(src.y2) == null)) {
    return null
  }
  if (kind === 'region' && finite(src.x2) == null) {
    return null
  }
  return { id, kind, color, text, x, y, x2, y2 }
}

export function parseChartAnnotations(raw: unknown): ChartAnnotation[] {
  if (!Array.isArray(raw)) {
    return []
  }
  const out: ChartAnnotation[] = []
  for (const item of raw) {
    const parsed = parseChartAnnotation(item)
    if (parsed) {
      out.push(parsed)
    }
  }
  return out
}

function markerId(id: string): string {
  return `dw-ann-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`
}

function withAlpha(color: string, alpha: number): string {
  const hex = /^#([0-9a-fA-F]{6})$/.exec(color)
  if (!hex) {
    return color
  }
  const n = Number.parseInt(hex[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${alpha})`
}

export function annotationSvgMarkup(items: ChartAnnotation[], scale: AnnotationScale): string {
  if (items.length === 0) {
    return ''
  }
  const clipId = 'dw-ann-clip'
  const parts: string[] = [
    `<defs><clipPath id="${clipId}"><rect x="${scale.plotLeft}" y="${scale.plotTop}" width="${scale.plotWidth}" height="${scale.plotHeight}"/></clipPath></defs>`,
    `<g clip-path="url(#${clipId})">`
  ]
  for (const item of items) {
    const color = xmlEscape(item.color)
    if (item.kind === 'region') {
      const x1 = Math.min(scale.x(item.x), scale.x(item.x2))
      const x2 = Math.max(scale.x(item.x), scale.x(item.x2))
      const width = Math.max(1, x2 - x1)
      parts.push(
        `<rect x="${x1.toFixed(2)}" y="${scale.plotTop}" width="${width.toFixed(2)}" height="${scale.plotHeight}" fill="${withAlpha(item.color, 0.18)}" stroke="${color}" stroke-width="1"/>`
      )
      if (item.text) {
        parts.push(
          `<text x="${(x1 + width / 2).toFixed(2)}" y="${(scale.plotTop + 16).toFixed(2)}" text-anchor="middle" font-size="12" fill="${color}" font-family="${SVG_TEXT_FONT}">${xmlEscape(item.text)}</text>`
        )
      }
      continue
    }
    const px = scale.x(item.x)
    const py = scale.y(item.y)
    if (item.kind === 'point') {
      parts.push(`<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="4.5" fill="${color}"/>`)
      if (item.text) {
        parts.push(
          `<text x="${(px + 8).toFixed(2)}" y="${(py + 4).toFixed(2)}" font-size="12" fill="${color}" font-family="${SVG_TEXT_FONT}">${xmlEscape(item.text)}</text>`
        )
      }
      continue
    }
    if (item.kind === 'arrow') {
      const mid = markerId(item.id)
      const x2 = scale.x(item.x2)
      const y2 = scale.y(item.y2)
      parts.push(
        `<defs><marker id="${mid}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${color}"/></marker></defs>`
      )
      parts.push(
        `<line x1="${px.toFixed(2)}" y1="${py.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${color}" stroke-width="1.8" marker-end="url(#${mid})"/>`
      )
      if (item.text) {
        parts.push(
          `<text x="${(x2 + 8).toFixed(2)}" y="${(y2 + 4).toFixed(2)}" font-size="12" fill="${color}" font-family="${SVG_TEXT_FONT}">${xmlEscape(item.text)}</text>`
        )
      }
      continue
    }
    parts.push(
      `<text x="${(px + 6).toFixed(2)}" y="${(py - 6).toFixed(2)}" font-size="13" fill="${color}" font-family="${SVG_TEXT_FONT}">${xmlEscape(item.text || 'Note')}</text>`
    )
  }
  parts.push('</g>')
  return parts.join('\n')
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): void {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const len = 9
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - len * Math.cos(angle - 0.4), y2 - len * Math.sin(angle - 0.4))
  ctx.lineTo(x2 - len * Math.cos(angle + 0.4), y2 - len * Math.sin(angle + 0.4))
  ctx.closePath()
  ctx.fill()
}

export function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  items: ChartAnnotation[],
  scale: AnnotationScale
): void {
  ctx.save()
  ctx.beginPath()
  ctx.rect(scale.plotLeft, scale.plotTop, scale.plotWidth, scale.plotHeight)
  ctx.clip()
  ctx.font = `12px ${SVG_TEXT_FONT}`
  for (const item of items) {
    ctx.fillStyle = item.color
    ctx.strokeStyle = item.color
    if (item.kind === 'region') {
      const x1 = Math.min(scale.x(item.x), scale.x(item.x2))
      const x2 = Math.max(scale.x(item.x), scale.x(item.x2))
      ctx.fillStyle = withAlpha(item.color, 0.18)
      ctx.fillRect(x1, scale.plotTop, Math.max(1, x2 - x1), scale.plotHeight)
      ctx.strokeRect(x1, scale.plotTop, Math.max(1, x2 - x1), scale.plotHeight)
      if (item.text) {
        ctx.fillStyle = item.color
        ctx.textAlign = 'center'
        ctx.fillText(item.text, x1 + Math.max(1, x2 - x1) / 2, scale.plotTop + 16)
        ctx.textAlign = 'start'
      }
      continue
    }
    const px = scale.x(item.x)
    const py = scale.y(item.y)
    if (item.kind === 'point') {
      ctx.beginPath()
      ctx.arc(px, py, 4.5, 0, Math.PI * 2)
      ctx.fill()
      if (item.text) {
        ctx.fillText(item.text, px + 8, py + 4)
      }
      continue
    }
    if (item.kind === 'arrow') {
      const x2 = scale.x(item.x2)
      const y2 = scale.y(item.y2)
      ctx.lineWidth = 1.8
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(x2, y2)
      ctx.stroke()
      drawArrowHead(ctx, px, py, x2, y2)
      if (item.text) {
        ctx.fillText(item.text, x2 + 8, y2 + 4)
      }
      continue
    }
    ctx.font = `13px ${SVG_TEXT_FONT}`
    ctx.fillText(item.text || 'Note', px + 6, py - 6)
    ctx.font = `12px ${SVG_TEXT_FONT}`
  }
  ctx.restore()
}
