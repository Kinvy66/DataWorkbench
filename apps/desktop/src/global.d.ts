export {}

declare global {
  interface Window {
    dw: {
      rpc: {
        invoke(method: string, params?: unknown): Promise<unknown>
        on(method: string, cb: (params: unknown) => void): () => void
      }
    }
  }
}
