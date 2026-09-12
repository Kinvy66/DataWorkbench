import { BrowserWindow } from 'electron'
import path from 'node:path'
import type { WikiPageId } from './help-docs'
import { framelessWindowOptions } from './windowChrome'

export type HelpWindowDeps = {
  getMainWindow: () => BrowserWindow | null
  resolvePreload: () => string
  resolveIcon: () => string | undefined
}

let helpWindow: BrowserWindow | null = null

function revealHelpWindow(win: BrowserWindow): void {
  if (win.isDestroyed()) {
    return
  }
  if (win.isMinimized()) {
    win.restore()
  }
  if (!win.isVisible()) {
    win.show()
  }
  win.focus()
}

function helpRendererUrl(page: WikiPageId): { type: 'url'; url: string } | { type: 'file'; file: string; query: { page: string } } {
  const queryPage = encodeURIComponent(page)
  if (process.env.ELECTRON_RENDERER_URL) {
    const origin = process.env.ELECTRON_RENDERER_URL.replace(/\/$/, '')
    return { type: 'url', url: `${origin}/help.html?page=${queryPage}` }
  }
  return {
    type: 'file',
    file: path.join(__dirname, '../renderer/help.html'),
    query: { page }
  }
}

function loadHelpPage(win: BrowserWindow, page: WikiPageId): void {
  const target = helpRendererUrl(page)
  if (target.type === 'url') {
    void win.loadURL(target.url)
    return
  }
  void win.loadFile(target.file, { query: target.query })
}

export function openHelpWindow(deps: HelpWindowDeps, page: WikiPageId): void {
  const main = deps.getMainWindow()
  if (helpWindow && !helpWindow.isDestroyed()) {
    const send = (): void => {
      if (!helpWindow || helpWindow.isDestroyed()) {
        return
      }
      helpWindow.webContents.send('dw:event', 'help.showPage', { page })
    }
    if (helpWindow.webContents.isLoading()) {
      helpWindow.webContents.once('did-finish-load', send)
    } else {
      send()
    }
    revealHelpWindow(helpWindow)
    return
  }
  const parent = main && !main.isDestroyed() ? main : undefined
  const win = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 640,
    minHeight: 480,
    show: false,
    title: 'DataWorkbench',
    icon: deps.resolveIcon(),
    parent,
    ...framelessWindowOptions(process.platform),
    webPreferences: {
      preload: deps.resolvePreload(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  helpWindow = win
  win.on('closed', () => {
    if (helpWindow === win) {
      helpWindow = null
    }
  })
  win.once('ready-to-show', () => {
    revealHelpWindow(win)
  })
  win.webContents.once('did-finish-load', () => {
    revealHelpWindow(win)
  })
  loadHelpPage(win, page)
}

export function closeHelpWindow(): void {
  if (helpWindow && !helpWindow.isDestroyed()) {
    helpWindow.close()
  }
  helpWindow = null
}
