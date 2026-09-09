export const WINDOW_CAPTION_HEIGHT = 36

const nativeCaptionOverlay = {
  color: '#ffffff',
  symbolColor: '#727272',
  height: WINDOW_CAPTION_HEIGHT
} as const

export function usesNativeCaptionOverlay(platform: NodeJS.Platform): boolean {
  return platform === 'win32' || platform === 'linux'
}

export function framelessWindowOptions(platform: NodeJS.Platform = process.platform) {
  return {
    autoHideMenuBar: true,
    backgroundColor: '#ffffff' as const,
    titleBarStyle: 'hidden' as const,
    ...(usesNativeCaptionOverlay(platform) ? { titleBarOverlay: { ...nativeCaptionOverlay } } : {})
  }
}

export type WindowChromeHost = {
  minimize(): void
  maximize(): void
  unmaximize(): void
  close(): void
  isMaximized(): boolean
}

export type WindowChromeAction = 'minimize' | 'toggleMaximize' | 'close' | 'isMaximized'

const windowChromeActions: readonly WindowChromeAction[] = [
  'minimize',
  'toggleMaximize',
  'close',
  'isMaximized'
]

export function isWindowChromeAction(value: unknown): value is WindowChromeAction {
  return typeof value === 'string' && windowChromeActions.includes(value as WindowChromeAction)
}

export function wantsNativeApplicationMenu(platform: NodeJS.Platform): boolean {
  return platform === 'darwin'
}

export function applyWindowChromeAction(
  host: WindowChromeHost,
  action: WindowChromeAction
): boolean | undefined {
  switch (action) {
    case 'minimize':
      host.minimize()
      return undefined
    case 'toggleMaximize':
      if (host.isMaximized()) {
        host.unmaximize()
      } else {
        host.maximize()
      }
      return undefined
    case 'close':
      host.close()
      return undefined
    case 'isMaximized':
      return host.isMaximized()
  }
}
