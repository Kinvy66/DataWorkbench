export const framelessWindowOptions = {
  frame: false,
  autoHideMenuBar: true,
  backgroundColor: '#ffffff'
} as const

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
