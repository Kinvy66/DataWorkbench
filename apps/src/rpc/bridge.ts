export function getDesktopBridge(): NonNullable<Window['dw']> {
  const dw = window.dw
  if (dw == null || dw.rpc == null) {
    const err = new Error(
      'Desktop RPC bridge is missing; preload script did not load [@@rpc.bridgeMissing]'
    )
    ;(err as Error & { i18nKey: string }).i18nKey = 'rpc.bridgeMissing'
    throw err
  }
  return dw
}
