export type CommandHandler = (ctx: { payload?: unknown }) => Promise<void>

export class CommandBus {
  private readonly handlers = new Map<string, CommandHandler>()
  private readonly canFns = new Map<string, () => boolean>()

  register(id: string, handler: CommandHandler, can?: () => boolean): void {
    this.handlers.set(id, handler)
    if (can) {
      this.canFns.set(id, can)
    }
  }

  can(id: string): boolean {
    const fn = this.canFns.get(id)
    if (fn) {
      return fn()
    }
    return this.handlers.has(id)
  }

  async dispatch(id: string, payload?: unknown): Promise<void> {
    const handler = this.handlers.get(id)
    if (!handler) {
      throw new Error(`Unknown command: ${id}`)
    }
    if (!this.can(id)) {
      return
    }
    await handler({ payload })
  }
}

export const commandBus = new CommandBus()
