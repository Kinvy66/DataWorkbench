import { app, BrowserWindow, ipcMain } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { APP_VERSION } from '@dw/rpc-types'
import { SidecarBridge } from './sidecar'

const sidecar = new SidecarBridge()
let mainWindow: BrowserWindow | null = null
let isQuitting = false

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

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    title: 'DataWorkbench',
    webPreferences: {
      preload: resolvePreload(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    if (!app.isPackaged) {
      mainWindow?.webContents.openDevTools({ mode: 'detach' })
    }
  })

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

app.whenReady().then(() => {
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
