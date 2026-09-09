import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDesktopBridge } from './bridge'

describe('getDesktopBridge', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the preload bridge when present', () => {
    const dw = {
      rpc: { invoke: vi.fn(), on: vi.fn() },
      window: {
        minimize: vi.fn(),
        toggleMaximize: vi.fn(),
        close: vi.fn(),
        isMaximized: vi.fn(),
        onMaximizedChange: vi.fn()
      }
    }
    vi.stubGlobal('window', { dw })
    expect(getDesktopBridge()).toBe(dw)
  })

  it('throws a translated key when preload did not expose dw', () => {
    vi.stubGlobal('window', {})
    expect(() => getDesktopBridge()).toThrow(/rpc\.bridgeMissing/)
  })
})
