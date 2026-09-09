import { describe, expect, it } from 'vitest'
import { CommandBus } from './commandBus'

describe('CommandBus', () => {
  it('dispatches a registered command', async () => {
    const bus = new CommandBus()
    let seen = 0
    bus.register('host.ping', async () => {
      seen += 1
    })
    await bus.dispatch('host.ping')
    expect(seen).toBe(1)
  })

  it('skips dispatch when can() is false', async () => {
    const bus = new CommandBus()
    let seen = 0
    bus.register(
      'file.new',
      async () => {
        seen += 1
      },
      () => false
    )
    await bus.dispatch('file.new')
    expect(seen).toBe(0)
    expect(bus.can('file.new')).toBe(false)
  })

  it('throws on unknown command', async () => {
    const bus = new CommandBus()
    await expect(bus.dispatch('missing')).rejects.toThrow(/Unknown command/)
  })
})
