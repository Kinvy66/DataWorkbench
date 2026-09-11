import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  decodeChartExportContent,
  withChartExportExtension,
  writeChartExport
} from './chart-export'
import { chartSaveDialogOptions } from './dialogs'

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

describe('chart export write helpers', () => {
  it('appends the format extension when missing', () => {
    expect(withChartExportExtension('C:\\tmp\\plot', 'svg')).toMatch(/plot\.svg$/)
    expect(withChartExportExtension('C:\\tmp\\plot.jpg', 'png')).toMatch(/plot\.png$/)
    expect(withChartExportExtension('C:\\tmp\\plot', 'pdf')).toMatch(/plot\.pdf$/)
  })

  it('decodes svg as utf-8 and png as base64', () => {
    expect(decodeChartExportContent('svg', '<svg/>').toString('utf8')).toBe('<svg/>')
    const png = decodeChartExportContent('png', TINY_PNG)
    expect(png[0]).toBe(0x89)
    expect(png[1]).toBe(0x50)
  })

  it('writes svg to disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dw-chart-export-'))
    try {
      const dest = writeChartExport(join(dir, 'plot'), 'svg', '<svg xmlns="http://www.w3.org/2000/svg"/>')
      expect(dest.endsWith('.svg')).toBe(true)
      expect(readFileSync(dest, 'utf8')).toContain('<svg')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('writes converted pdf bytes and rejects svg markup', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dw-chart-export-'))
    try {
      const dest = writeChartExport(join(dir, 'plot'), 'pdf', Buffer.from('%PDF-1.4 fake'))
      expect(dest.endsWith('.pdf')).toBe(true)
      expect(readFileSync(dest).subarray(0, 4).toString('ascii')).toBe('%PDF')
      expect(() => writeChartExport(join(dir, 'bad'), 'pdf', '<svg/>')).toThrow(/converted bytes/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('offers a format-specific save dialog', () => {
    expect(chartSaveDialogOptions('png', 'Run 01.png').filters?.[0].extensions).toEqual(['png'])
    expect(chartSaveDialogOptions('svg', 'Run 01.svg').defaultPath).toBe('Run 01.svg')
    expect(chartSaveDialogOptions('pdf', 'Run 01.pdf').filters?.[0].extensions).toEqual(['pdf'])
  })
})
