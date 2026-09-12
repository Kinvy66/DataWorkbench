import { contextBridge, ipcRenderer } from 'electron'

const DW_RPC_ERROR = '__dwRpcError'

contextBridge.exposeInMainWorld('dw', {
  rpc: {
    invoke(method: string, params?: unknown): Promise<unknown> {
      return ipcRenderer.invoke('dw:rpc', method, params ?? {}).then((value: unknown) => {
        if (
          typeof value === 'object' &&
          value !== null &&
          (value as { [DW_RPC_ERROR]?: boolean })[DW_RPC_ERROR] === true
        ) {
          const payload = value as { code: number; message: string; i18nKey?: string }
          const err = new Error(payload.message)
          ;(err as Error & { code: number; i18nKey?: string }).code = payload.code
          ;(err as Error & { i18nKey?: string }).i18nKey = payload.i18nKey
          throw err
        }
        return value
      })
    },
    on(method: string, cb: (params: unknown) => void): () => void {
      const listener = (_event: unknown, m: string, params: unknown) => {
        if (m === method) {
          cb(params)
        }
      }
      ipcRenderer.on('dw:event', listener)
      return () => {
        ipcRenderer.removeListener('dw:event', listener)
      }
    }
  },
  window: {
    minimize(): Promise<void> {
      return ipcRenderer.invoke('dw:window', 'minimize').then(() => undefined)
    },
    toggleMaximize(): Promise<void> {
      return ipcRenderer.invoke('dw:window', 'toggleMaximize').then(() => undefined)
    },
    close(): Promise<void> {
      return ipcRenderer.invoke('dw:window', 'close').then(() => undefined)
    },
    isMaximized(): Promise<boolean> {
      return ipcRenderer.invoke('dw:window', 'isMaximized')
    },
    onMaximizedChange(cb: (maximized: boolean) => void): () => void {
      const listener = (_event: unknown, payload: { maximized?: boolean }) => {
        cb(Boolean(payload?.maximized))
      }
      ipcRenderer.on('dw:window-state', listener)
      return () => {
        ipcRenderer.removeListener('dw:window-state', listener)
      }
    }
  },
  wiki: {
    onRun(cb: (opts: { csvPath: string }) => void): void {
      ipcRenderer.on('wiki:run', (_event, opts: { csvPath: string }) => {
        cb(opts)
      })
    },
    shot(name: string): Promise<unknown> {
      return ipcRenderer.invoke('wiki:shot', name)
    },
    done(): Promise<unknown> {
      return ipcRenderer.invoke('wiki:done')
    },
    fail(message: string): Promise<unknown> {
      return ipcRenderer.invoke('wiki:fail', message)
    }
  }
})
