export type RendererEvent = { method: string; params: unknown }

/** Queue IPC notifications until the Vue renderer has subscribed. */
export class RendererEventGate {
  private canReceive = false
  private pending: RendererEvent[] = []

  constructor(private readonly maxQueue = 200) {}

  get ready(): boolean {
    return this.canReceive
  }

  get queued(): number {
    return this.pending.length
  }

  forward(method: string, params: unknown, send: (method: string, params: unknown) => void): void {
    if (!this.canReceive) {
      this.pending.push({ method, params })
      if (this.pending.length > this.maxQueue) {
        this.pending.shift()
      }
      return
    }
    send(method, params)
  }

  flush(send: (method: string, params: unknown) => void): void {
    this.canReceive = true
    const queued = this.pending.splice(0)
    for (const item of queued) {
      send(item.method, item.params)
    }
  }
}
