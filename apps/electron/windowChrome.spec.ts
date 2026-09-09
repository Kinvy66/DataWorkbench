import { describe, expect, it, vi } from 'vitest'
import {
  applyWindowChromeAction,
  framelessWindowOptions,
  isWindowChromeAction,
  wantsNativeApplicationMenu
} from './windowChrome'

function fakeHost(maximized = false) {
  return {
    maximized,
    minimize: vi.fn(),
    maximize: vi.fn(),
    unmaximize: vi.fn(),
    close: vi.fn(),
    isMaximized() {
      return this.maximized
    }
  }
}

describe('window chrome', () => {
  it('hides the OS title bar and restores native caption buttons on Windows', () => {
    const opts = framelessWindowOptions('win32')
    expect(opts.titleBarStyle).toBe('hidden')
    expect(opts.autoHideMenuBar).toBe(true)
    expect(opts.titleBarOverlay).toEqual({
      color: '#ffffff',
      symbolColor: '#727272',
      height: 36
    })
  })

  it('enables native caption overlay on Linux as well', () => {
    expect(framelessWindowOptions('linux').titleBarOverlay).toEqual(
      framelessWindowOptions('win32').titleBarOverlay
    )
  })

  it('does not enable Windows Control Overlay on macOS (traffic lights stay native)', () => {
    expect(framelessWindowOptions('darwin').titleBarOverlay).toBeUndefined()
    expect(framelessWindowOptions('darwin').titleBarStyle).toBe('hidden')
  })

  it('drops the native application menu on Windows', () => {
    expect(wantsNativeApplicationMenu('win32')).toBe(false)
    expect(wantsNativeApplicationMenu('linux')).toBe(false)
    expect(wantsNativeApplicationMenu('darwin')).toBe(true)
  })

  it('toggles maximize from the caption button', () => {
    const host = fakeHost(false)
    applyWindowChromeAction(host, 'toggleMaximize')
    expect(host.maximize).toHaveBeenCalledOnce()
    host.maximized = true
    applyWindowChromeAction(host, 'toggleMaximize')
    expect(host.unmaximize).toHaveBeenCalledOnce()
  })

  it('rejects unknown caption actions', () => {
    expect(isWindowChromeAction('minimize')).toBe(true)
    expect(isWindowChromeAction('explode')).toBe(false)
  })

  it('minimizes and closes through the host', () => {
    const host = fakeHost()
    applyWindowChromeAction(host, 'minimize')
    applyWindowChromeAction(host, 'close')
    expect(host.minimize).toHaveBeenCalledOnce()
    expect(host.close).toHaveBeenCalledOnce()
    expect(applyWindowChromeAction(host, 'isMaximized')).toBe(false)
  })
})
