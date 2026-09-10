import fs from 'node:fs'
import path from 'node:path'

export type ChartExportFormat = 'png' | 'svg'

export function decodeChartExportContent(format: ChartExportFormat, content: string): Buffer {
  if (typeof content !== 'string' || content.length === 0) {
    throw new Error('empty export content')
  }
  if (format === 'svg') {
    return Buffer.from(content, 'utf8')
  }
  const comma = content.indexOf(',')
  const payload = content.startsWith('data:') && comma >= 0 ? content.slice(comma + 1) : content
  return Buffer.from(payload, 'base64')
}

export function withChartExportExtension(filePath: string, format: ChartExportFormat): string {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === `.${format}`) {
    return filePath
  }
  if (!ext) {
    return `${filePath}.${format}`
  }
  return filePath.slice(0, -ext.length) + `.${format}`
}

export function writeChartExport(filePath: string, format: ChartExportFormat, content: string): string {
  const dest = withChartExportExtension(filePath, format)
  fs.writeFileSync(dest, decodeChartExportContent(format, content))
  return dest
}
