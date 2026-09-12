import { app, BrowserWindow, desktopCapturer, ipcMain, screen } from 'electron'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export type WikiCaptureConfig = {
  outDir: string
  csvPath: string
  userDataDir: string
  donePath: string
}

function envPath(name: string): string {
  const raw = process.env[name]?.trim() ?? ''
  return raw
}

export function wikiCaptureConfig(): WikiCaptureConfig | null {
  const outDir = envPath('DW_WIKI_CAPTURE')
  if (!outDir) {
    return null
  }
  const csvPath =
    envPath('DW_WIKI_CSV') || path.join(process.cwd(), 'docs/wiki/samples/wiki-demo.csv')
  const userDataDir = path.join(os.tmpdir(), 'dw-wiki-capture-userData')
  const donePath = envPath('DW_WIKI_DONE') || path.join(os.tmpdir(), 'dw-wiki-capture.done')
  return { outDir, csvPath, userDataDir, donePath }
}

export function applyWikiCaptureAppPaths(config: WikiCaptureConfig | null): void {
  if (!config) {
    return
  }
  app.setName('DataWorkbenchWikiCapture')
  app.setPath('userData', config.userDataDir)
}

function writeDone(config: WikiCaptureConfig, ok: boolean, detail: string): void {
  try {
    fs.mkdirSync(path.dirname(config.donePath), { recursive: true })
    fs.writeFileSync(config.donePath, `${ok ? 'ok' : 'fail'}\n${detail}\n`, 'utf8')
  } catch (err) {
    console.error('[wiki-capture] failed to write done file', err)
  }
}

async function grabWindowPng(win: BrowserWindow): Promise<Buffer> {
  const bounds = win.getBounds()
  const factor = screen.getDisplayMatching(bounds).scaleFactor || 1
  const thumbnailSize = {
    width: Math.max(1, Math.round(bounds.width * factor)),
    height: Math.max(1, Math.round(bounds.height * factor))
  }
  const sourceId = win.getMediaSourceId()
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize
    })
    const match = sources.find((item) => item.id === sourceId) ?? sources.find((item) => item.name.includes('DataWorkbench'))
    const png = match?.thumbnail.toPNG()
    if (png && png.length > 8000) {
      return png
    }
  } catch (err) {
    console.error('[wiki-capture] desktopCapturer failed, falling back to capturePage', err)
  }
  const image = await win.webContents.capturePage()
  return image.toPNG()
}

export function installWikiCapture(
  config: WikiCaptureConfig | null,
  getWindow: () => BrowserWindow | null
): void {
  if (!config) {
    return
  }
  fs.mkdirSync(config.outDir, { recursive: true })
  try {
    fs.unlinkSync(config.donePath)
  } catch {
    // no previous sentinel
  }

  ipcMain.handle('wiki:shot', async (_event, name: unknown) => {
    const win = getWindow()
    if (!win || win.isDestroyed()) {
      throw new Error('wiki:shot has no window')
    }
    if (typeof name !== 'string' || !name.endsWith('.png') || name.includes('..') || name.includes('/') || name.includes('\\')) {
      throw new Error(`invalid wiki shot name: ${String(name)}`)
    }
    const png = await grabWindowPng(win)
    const dest = path.join(config.outDir, name)
    fs.writeFileSync(dest, png)
    console.error(`[wiki-capture] wrote ${dest} (${png.length} bytes)`)
    return { ok: true, path: dest }
  })

  ipcMain.handle('wiki:done', () => {
    writeDone(config, true, 'captured')
    app.exit(0)
    return { ok: true }
  })

  ipcMain.handle('wiki:fail', (_event, message: unknown) => {
    const detail = typeof message === 'string' ? message : String(message)
    console.error(`[wiki-capture] fail: ${detail}`)
    writeDone(config, false, detail)
    app.exit(1)
    return { ok: false }
  })
}

export function notifyWikiCaptureReady(
  config: WikiCaptureConfig | null,
  win: BrowserWindow | null
): void {
  if (!config || !win || win.isDestroyed()) {
    return
  }
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setBounds({ x: 40, y: 40, width: 1280, height: 800 })
  win.show()
  win.focus()
  win.webContents.send('wiki:run', { csvPath: config.csvPath })
}
