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
      wiki?: {
        onRun(cb: (opts: { csvPath: string }) => void): void
        shot(name: string): Promise<unknown>
        done(): Promise<unknown>
        fail(message: string): Promise<unknown>
      }
    }
  }
}
