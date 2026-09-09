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
  }
})
