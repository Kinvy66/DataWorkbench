import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('dw', {
  rpc: {
    invoke(method: string, params?: unknown): Promise<unknown> {
      return ipcRenderer.invoke('dw:rpc', method, params ?? {})
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
      return ipcRenderer.invoke('dw:window', 'minimize')
    },
    toggleMaximize(): Promise<void> {
      return ipcRenderer.invoke('dw:window', 'toggleMaximize')
    },
    close(): Promise<void> {
      return ipcRenderer.invoke('dw:window', 'close')
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
  }
})
