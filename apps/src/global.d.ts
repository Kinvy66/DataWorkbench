export {}

declare global {
  interface Window {
    dw?: {
      rpc: {
        invoke(method: string, params?: unknown): Promise<unknown>
        on(method: string, cb: (params: unknown) => void): () => void
      }
      window: {
        minimize(): Promise<void>
        toggleMaximize(): Promise<void>
        close(): Promise<void>
        isMaximized(): Promise<boolean>
        onMaximizedChange(cb: (maximized: boolean) => void): () => void
      }
    }
  }
}
