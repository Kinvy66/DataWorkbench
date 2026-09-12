import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { APP_VERSION, type ProjectSaveParams, type ProjectUnpackLogicResult } from '@dw/rpc-types'
import { writeChartExport } from './chart-export'
import { renderSvgToPdf } from './chart-pdf'
import {
  chartSaveDialogOptions,
  dataOpenDialogOptions,
  dataSaveDialogOptions,
  projectOpenDialogOptions,
  projectSaveDialogOptions
} from './dialogs'
import { openProjectArchive, ProjectFileError, saveProjectArchive, withProjectExtension } from './project-io'
import { AppFileLog, type AppLogKind } from './app-log'
import { RendererEventGate } from './renderer-events'
import { RpcError } from './rpc-error'
import { isAllowedHelpUrl } from './open-url'
import { findDocsRoot, listWikiPages, normalizeWikiPageId, readWikiPage } from './help-docs'
import { installHelpProtocol, registerHelpScheme } from './help-protocol'
import { closeHelpWindow, openHelpWindow } from './help-window'
import { parseClipboardWriteParams } from './clipboard-params'
import { readAppClipboardText, writeAppClipboard } from './app-clipboard'
import { SidecarBridge } from './sidecar'
import { findProjectPathFromArgv, shouldShowSidecarLogToUi } from './open-path'
import {
  applyWindowChromeAction,
  framelessWindowOptions,
  isWindowChromeAction,
  wantsNativeApplicationMenu
} from './windowChrome'
import {
  applyWikiCaptureAppPaths,
  installWikiCapture,
  notifyWikiCaptureReady,
  wikiCaptureConfig
} from './wiki-capture'
import { applyQaLabEnv } from './qa-lab'

registerHelpScheme()

const wikiCapture = wikiCaptureConfig()
applyWikiCaptureAppPaths(wikiCapture)
applyQaLabEnv({ skip: Boolean(wikiCapture) })

const sidecar = new SidecarBridge({ resourcesPath: process.resourcesPath })
let mainWindow: BrowserWindow | null = null
let isQuitting = false
let appLog: AppFileLog | null = null
let docsRootCache: string | null = null

function bundledDocsRoot(): string {
  if (!docsRootCache) {
    docsRootCache = findDocsRoot({
      startDir: __dirname,
      cwd: process.cwd(),
      resourcesPath: process.resourcesPath
    })
  }
  return docsRootCache
}

function fileLog(kind: AppLogKind, text: string): void {
  try {
    appLog?.write(kind, text)
  } catch {
    // Logging must never break RPC or window startup.
  }
}

function ensureSampleCsv(): void {
  try {
    const destDir = path.join(app.getPath('documents'), 'DataWorkbench')
    const dest = path.join(destDir, 'wiki-demo.csv')
    if (fs.existsSync(dest)) {
      fileLog('main', `Sample CSV already at ${dest}`)
      return
    }
    const sources = [
      path.join(bundledDocsRoot(), 'wiki', 'samples', 'wiki-demo.csv'),
      path.join(process.cwd(), 'docs', 'wiki', 'samples', 'wiki-demo.csv'),
      path.join(process.cwd(), '..', 'docs', 'wiki', 'samples', 'wiki-demo.csv')
    ]
    const src = sources.find((item) => fs.existsSync(item))
    if (!src) {
      fileLog('main', 'Sample CSV source missing')
      return
    }
    fs.mkdirSync(destDir, { recursive: true })
    fs.copyFileSync(src, dest)
    fileLog('main', `Copied sample CSV to ${dest}`)
  } catch (err) {
    fileLog('main', `Sample CSV copy failed: ${String(err)}`)
  }
}

// Hidden windows on Windows + titleBarOverlay often never paint, so ready-to-show
// never fires and the UI stays invisible. Disable occlusion and always have a show fallback.
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
}

function resolveWindowIcon(): string | undefined {
  const candidates = [
    path.join(process.resourcesPath, 'icon.ico'),
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
  // Prefer .cjs: apps/package.json has "type": "module", so a .js preload is
  // treated as ESM and the bundled `require('electron')` never runs.
  for (const name of ['index.cjs', 'index.js', 'index.mjs']) {
    const candidate = path.join(dir, name)
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }
  return path.join(dir, 'index.cjs')
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

function revealWindow(win: BrowserWindow | null, reason: string): void {
  if (!win || win.isDestroyed()) {
    return
  }
  if (!win.isVisible()) {
    console.error(`[window] show (${reason})`)
    win.show()
  }
  if (!app.isPackaged && process.env.DW_DEVTOOLS === '1' && !win.webContents.isDevToolsOpened()) {
    win.webContents.openDevTools({ mode: 'detach' })
  }
  win.focus()
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
      sandbox: false,
      backgroundThrottling: false,
      paintWhenInitiallyHidden: true
    }
  })

  bindWindowState(mainWindow)
  mainWindow.on('close', (event) => {
    if (isQuitting) {
      return
    }
    event.preventDefault()
    forward('app.closeRequested', {})
  })
  console.error(`[window] preload ${resolvePreload()}`)
  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error(`[window] preload-error ${preloadPath}: ${error}`)
  })

  const showFallback = setTimeout(() => {
    revealWindow(mainWindow, 'timeout')
  }, 1500)
  mainWindow.once('closed', () => {
    clearTimeout(showFallback)
  })

  mainWindow.on('ready-to-show', () => {
    clearTimeout(showFallback)
    revealWindow(mainWindow, 'ready-to-show')
  })

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, url) => {
    console.error(`[window] did-fail-load code=${errorCode} ${errorDescription} url=${url}`)
    clearTimeout(showFallback)
    revealWindow(mainWindow, 'did-fail-load')
  })
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[window] renderer gone: ${details.reason} exit=${details.exitCode}`)
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
    // Do not wait solely on ready-to-show: a hidden WCO window may never paint.
    clearTimeout(showFallback)
    revealWindow(mainWindow, 'did-finish-load')
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
        fileLog('main', `Sidecar start failed: ${message}`)
        forward('host.startFailed', {})
      })
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

const rendererEvents = new RendererEventGate()

function sendToRenderer(method: string, params: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('dw:event', method, params)
  }
}

function forward(method: string, params: unknown): void {
  rendererEvents.forward(method, params, sendToRenderer)
}

function flushRendererEvents(): void {
  rendererEvents.flush(sendToRenderer)
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

app.on('second-instance', (_event, argv) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }
    revealWindow(mainWindow, 'second-instance')
  }
  const filePath = findProjectPathFromArgv(argv)
  if (filePath) {
    forward('app.openFile', { path: filePath })
  }
})

app.on('open-file', (event, filePath) => {
  event.preventDefault()
  if (filePath.toLowerCase().endsWith('.dwproj')) {
    forward('app.openFile', { path: filePath })
  }
})

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
  if (!gotLock) {
    return
  }
  appLog = new AppFileLog({ userDataDir: app.getPath('userData') })
  fileLog('main', 'App ready')
  ensureSampleCsv()
  installHelpProtocol(() => bundledDocsRoot())
  installApplicationMenu()
  sidecar.onLog((entry) => {
    const level = entry.stream === 'protocol' ? 'warning' : 'info'
    console.error(`[sidecar ${entry.stream}] ${entry.text}`)
    fileLog('sidecar', `${entry.stream} ${entry.text}`)
    if (shouldShowSidecarLogToUi(entry.stream, entry.text)) {
      forward('log.line', { level, message: entry.text })
    }
  })
  sidecar.onNotify((method, params) => {
    if (method === 'host.crashed') {
      fileLog('main', `Sidecar crashed ${JSON.stringify(params)}`)
    }
    forward(method, params)
  })
  sidecar.start()
  fileLog('main', 'Sidecar spawn requested')
  installWikiCapture(wikiCapture, () => mainWindow)
  createWindow()
  const launchFile = findProjectPathFromArgv(process.argv)
  if (launchFile) {
    forward('app.openFile', { path: launchFile })
  }
})

ipcMain.on('dw:window', (event, action: unknown) => {
  onWindowChrome(event.sender, action)
})

ipcMain.handle('dw:window', (event, action: unknown) => {
  return onWindowChrome(event.sender, action)
})

ipcMain.handle('dw:rpc', async (event, method: string, params: unknown) => {
  try {
    return await handleRendererRpc(event, method, params)
  } catch (err) {
    if (err instanceof RpcError) {
      return err.toPayload()
    }
    throw err
  }
})

async function handleRendererRpc(
  event: Electron.IpcMainInvokeEvent,
  method: string,
  params: unknown
): Promise<unknown> {
  if (method === 'app.quit') {
    app.quit()
    return { ok: true }
  }
  if (method === 'app.rendererReady') {
    flushRendererEvents()
    notifyWikiCaptureReady(wikiCapture, mainWindow)
    return { ok: true }
  }
  if (method === 'app.openUrl') {
    const url = typeof (params as { url?: unknown } | null)?.url === 'string' ? (params as { url: string }).url : ''
    if (!isAllowedHelpUrl(url)) {
      throw new RpcError(-32602, 'URL is not allowed', 'help.urlBlocked')
    }
    await shell.openExternal(url)
    return { ok: true }
  }
  if (method === 'app.openHelp') {
    const page = normalizeWikiPageId((params as { page?: unknown } | null)?.page) ?? 'README.md'
    openHelpWindow(
      {
        getMainWindow: () => mainWindow,
        resolvePreload,
        resolveIcon: resolveWindowIcon
      },
      page
    )
    return { ok: true }
  }
  if (method === 'help.list') {
    return { pages: listWikiPages(bundledDocsRoot()) }
  }
  if (method === 'help.read') {
    const page = normalizeWikiPageId((params as { page?: unknown } | null)?.page)
    if (!page) {
      throw new RpcError(-32602, 'Help page is not allowed', 'help.pageNotFound')
    }
    try {
      return readWikiPage(bundledDocsRoot(), page)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new RpcError(3001, message, 'help.pageNotFound')
    }
  }
  if (method === 'app.clipboardWrite') {
    writeAppClipboard(parseClipboardWriteParams(params))
    return { ok: true }
  }
  if (method === 'app.clipboardRead') {
    return { text: readAppClipboardText() }
  }
  if (method === 'app.openLogs') {
    const logsDir = path.join(app.getPath('userData'), 'logs')
    fs.mkdirSync(logsDir, { recursive: true })
    await shell.openPath(logsDir)
    return { ok: true }
  }
  const win = targetWindow(event.sender)
  if (method === 'app.setDocument') {
    const p = (params ?? {}) as { displayName?: string; dirty?: boolean }
    const name = typeof p.displayName === 'string' && p.displayName.trim() ? p.displayName.trim() : 'Untitled'
    if (win && !win.isDestroyed()) {
      win.setTitle(`${p.dirty ? '*' : ''}${name} - DataWorkbench`)
    }
    return { ok: true }
  }
  if (method === 'project.packLogic' || method === 'project.unpackLogic') {
    throw new RpcError(-32601, `Method not found: ${method}`)
  }
  if (method === 'data.import') {
    const p = (params ?? {}) as { path?: string; format?: string }
    let filePath = p.path
    if (!filePath) {
      if (!win) {
        return { cancelled: true }
      }
      const picked = await dialog.showOpenDialog(win, dataOpenDialogOptions())
      if (picked.canceled || !picked.filePaths[0]) {
        return { cancelled: true }
      }
      filePath = picked.filePaths[0]
    }
    return sidecar.invoke('data.import', { path: filePath, format: p.format })
  }
  if (method === 'data.export') {
    const p = (params ?? {}) as { id?: string; path?: string; format?: string; suggestedName?: string }
    if (!p.id) {
      throw new RpcError(1001, 'Dataset id is required', 'data.notFound')
    }
    let filePath = p.path
    if (!filePath) {
      if (!win) {
        return { cancelled: true }
      }
      const picked = await dialog.showSaveDialog(win, dataSaveDialogOptions(p.suggestedName))
      if (picked.canceled || !picked.filePath) {
        return { cancelled: true }
      }
      filePath = picked.filePath
      if (!path.extname(filePath)) {
        filePath += '.csv'
      }
    }
    const format = p.format ?? path.extname(filePath).replace(/^\./, '').toLowerCase()
    return sidecar.invoke('data.export', { id: p.id, path: filePath, format })
  }
  if (method === 'chart.saveExport') {
    const p = (params ?? {}) as {
      format?: string
      suggestedName?: string
      path?: string
      content?: string
    }
    const format = p.format === 'svg' || p.format === 'png' || p.format === 'pdf' ? p.format : null
    if (!format) {
      throw new RpcError(-32602, 'format must be png, svg or pdf', 'rpc.invalidParams')
    }
    if (typeof p.content !== 'string' || p.content.length === 0) {
      throw new RpcError(-32602, 'content is required', 'rpc.invalidParams')
    }
    let filePath = p.path
    if (!filePath) {
      if (!win) {
        return { cancelled: true }
      }
      const picked = await dialog.showSaveDialog(win, chartSaveDialogOptions(format, p.suggestedName))
      if (picked.canceled || !picked.filePath) {
        return { cancelled: true }
      }
      filePath = picked.filePath
    }
    try {
      if (format === 'pdf') {
        writeChartExport(filePath, 'pdf', await renderSvgToPdf(p.content))
      } else {
        writeChartExport(filePath, format, p.content)
      }
      return { ok: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new RpcError(3001, message, 'data.ioError')
    }
  }
  if (method === 'project.save') {
    const p = (params ?? {}) as ProjectSaveParams
    if (!p.workflowId) {
      throw new RpcError(-32602, 'workflowId is required', 'rpc.invalidParams')
    }
    let filePath = p.path
    if (!filePath) {
      if (!win) {
        return { cancelled: true }
      }
      const picked = await dialog.showSaveDialog(win, projectSaveDialogOptions('Untitled.dwproj'))
      if (picked.canceled || !picked.filePath) {
        return { cancelled: true }
      }
      filePath = withProjectExtension(picked.filePath)
    }
    try {
      const dumped = (await sidecar.invoke('workflow.dumpLogic', {
        workflowId: p.workflowId,
        format: 'json'
      })) as { payload: unknown }
      await saveProjectArchive({
        dest: filePath,
        workflowLogic: dumped.payload,
        uiLayout: p.uiLayout,
        charts: p.charts,
        packLogic: async (dir) => {
          await sidecar.invoke('project.packLogic', { dir })
        }
      })
      fileLog('main', `Project saved ${filePath}`)
      return { ok: true, path: filePath }
    } catch (err) {
      fileLog('main', `Project save failed ${filePath}: ${err instanceof Error ? err.message : String(err)}`)
      throw projectError(err)
    }
  }
  if (method === 'project.open') {
    const p = (params ?? {}) as { path?: string }
    let filePath = p.path
    if (!filePath) {
      if (!win) {
        return { cancelled: true }
      }
      const picked = await dialog.showOpenDialog(win, projectOpenDialogOptions())
      if (picked.canceled || !picked.filePaths[0]) {
        return { cancelled: true }
      }
      filePath = picked.filePaths[0]
    }
    try {
      const opened = await openProjectArchive({
        src: filePath,
        unpackLogic: (dir) => sidecar.invoke('project.unpackLogic', { dir }) as Promise<ProjectUnpackLogicResult>
      })
      fileLog('main', `Project opened ${filePath}`)
      return {
        path: filePath,
        workflowId: opened.workflowId,
        uiLayout: opened.uiLayout,
        charts: opened.charts
      }
    } catch (err) {
      fileLog('main', `Project open failed ${filePath}: ${err instanceof Error ? err.message : String(err)}`)
      throw projectError(err)
    }
  }
  return sidecar.invoke(method, params)
}

function projectError(err: unknown): RpcError {
  if (err instanceof RpcError) {
    return err
  }
  if (err instanceof ProjectFileError) {
    return new RpcError(err.code, err.message, err.i18nKey)
  }
  const message = err instanceof Error ? err.message : String(err)
  return new RpcError(3001, message, 'data.ioError')
}

app.on('window-all-closed', () => {
  app.quit()
})

app.on('before-quit', (event) => {
  if (isQuitting) {
    return
  }
  event.preventDefault()
  isQuitting = true
  fileLog('main', 'App quitting')
  closeHelpWindow()
  void sidecar.shutdown().finally(() => {
    app.exit(0)
  })
})
