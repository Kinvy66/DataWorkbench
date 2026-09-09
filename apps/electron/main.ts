import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { APP_VERSION } from '@dw/rpc-types'
import { SidecarBridge } from './sidecar'
import {
  applyWindowChromeAction,
  framelessWindowOptions,
  isWindowChromeAction,
  wantsNativeApplicationMenu
} from './windowChrome'

const sidecar = new SidecarBridge()
let mainWindow: BrowserWindow | null = null
let isQuitting = false

function resolveWindowIcon(): string | undefined {
  const candidates = [
    path.join(process.cwd(), 'resources', 'icon.ico'),
    path.join(process.cwd(), 'apps', 'resources', 'icon.ico'),
    path.join(__dirname, '../../resources/icon.ico'),
    path.join(__dirname, '../resources/icon.ico')
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }
  return undefined
}

function resolvePreload(): string {
  const dir = path.join(__dirname, '../preload')
  for (const name of ['index.js', 'index.cjs', 'index.mjs']) {
    const candidate = path.join(dir, name)
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }
  return path.join(dir, 'index.js')
}

function installApplicationMenu(): void {
  if (wantsNativeApplicationMenu(process.platform)) {
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }])
    )
    return
  }
  Menu.setApplicationMenu(null)
}

function bindWindowState(win: BrowserWindow): void {
  const send = (): void => {
    if (!win.isDestroyed()) {
      win.webContents.send('dw:window-state', { maximized: win.isMaximized() })
    }
  }
  win.on('maximize', send)
  win.on('unmaximize', send)
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    title: 'DataWorkbench',
    icon: resolveWindowIcon(),
    ...framelessWindowOptions(process.platform),
    webPreferences: {
      preload: resolvePreload(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  bindWindowState(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    if (!app.isPackaged && process.env.DW_DEVTOOLS === '1') {
      mainWindow?.webContents.openDevTools({ mode: 'detach' })
    }
  })

  if (!app.isPackaged) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') {
        return
      }
      const toggle =
        input.key === 'F12' || (input.key === 'I' && input.control && input.shift)
      if (toggle) {
        event.preventDefault()
        mainWindow?.webContents.toggleDevTools()
      }
    })
  }

  mainWindow.webContents.once('did-finish-load', () => {
    sidecar.start()
    void sidecar
      .waitUntilReady(10000)
      .then(() =>
        sidecar.invoke('host.hello', {
          appVersion: APP_VERSION,
          workspaceRoot: app.getPath('userData')
        })
      )
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        forward('log.line', { level: 'error', message: `Sidecar start failed: ${message}` })
      })
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

function forward(method: string, params: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('dw:event', method, params)
  }
}

function targetWindow(sender: Electron.WebContents): BrowserWindow | null {
  const fromSender = BrowserWindow.fromWebContents(sender)
  if (fromSender && !fromSender.isDestroyed()) {
    return fromSender
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow
  }
  return null
}

function onWindowChrome(sender: Electron.WebContents, action: unknown) {
  if (!isWindowChromeAction(action)) {
    return false
  }
  const win = targetWindow(sender)
  if (!win) {
    return false
  }
  return applyWindowChromeAction(win, action) ?? null
}

app.whenReady().then(() => {
  installApplicationMenu()
  sidecar.onLog((entry) => {
    const level = entry.stream === 'protocol' ? 'warning' : 'info'
    console.error(`[sidecar ${entry.stream}] ${entry.text}`)
    forward('log.line', { level, message: entry.text })
  })
  sidecar.onNotify((method, params) => {
    forward(method, params)
  })
  createWindow()
})

ipcMain.on('dw:window', (event, action: unknown) => {
  onWindowChrome(event.sender, action)
})

ipcMain.handle('dw:window', (event, action: unknown) => {
  return onWindowChrome(event.sender, action)
})

ipcMain.handle('dw:rpc', async (_event, method: string, params: unknown) => {
  if (method === 'app.quit') {
    app.quit()
    return { ok: true }
  }
  return sidecar.invoke(method, params)
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('before-quit', (event) => {
  if (isQuitting) {
    return
  }
  event.preventDefault()
  isQuitting = true
  void sidecar.shutdown().finally(() => {
    app.exit(0)
  })
})
