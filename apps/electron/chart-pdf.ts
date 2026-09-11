import { BrowserWindow } from 'electron'
import { parseSvgPixelSize, wrapSvgAsPrintHtml } from './svg-print'

export async function renderSvgToPdf(svg: string): Promise<Buffer> {
  if (typeof svg !== 'string' || svg.trim().length === 0) {
    throw new Error('empty svg')
  }
  const html = wrapSvgAsPrintHtml(svg)
  const { width, height } = parseSvgPixelSize(svg)
  const win = new BrowserWindow({
    show: false,
    width: Math.max(1, Math.ceil(width)),
    height: Math.max(1, Math.ceil(height)),
    webPreferences: { offscreen: true }
  })
  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    const data = await win.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      margins: { marginType: 'none' }
    })
    return Buffer.from(data)
  } finally {
    if (!win.isDestroyed()) {
      win.destroy()
    }
  }
}
