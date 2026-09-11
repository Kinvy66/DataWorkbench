import fs from 'node:fs'
import path from 'node:path'

export type ChartExportFormat = 'png' | 'svg' | 'pdf'

const PDF_MAGIC = Buffer.from('%PDF')

export function isPdfBuffer(buf: Buffer): boolean {
  return buf.length >= 4 && buf.subarray(0, 4).equals(PDF_MAGIC)
}

export function decodeChartExportContent(format: Exclude<ChartExportFormat, 'pdf'>, content: string): Buffer {
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

export function writeChartExport(
  filePath: string,
  format: ChartExportFormat,
  content: string | Buffer
): string {
  const dest = withChartExportExtension(filePath, format)
  let bytes: Buffer
  if (format === 'pdf') {
    if (!Buffer.isBuffer(content)) {
      throw new Error('pdf export requires converted bytes')
    }
    if (!isPdfBuffer(content)) {
      throw new Error('pdf content is not a PDF')
    }
    bytes = content
  } else if (Buffer.isBuffer(content)) {
    bytes = content
  } else {
    bytes = decodeChartExportContent(format, content)
  }
  fs.writeFileSync(dest, bytes)
  return dest
}
