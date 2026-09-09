const I18N_SUFFIX = /^(.*) \[@@([a-zA-Z0-9.]+)\]\s*$/s

export function decodeRpcError(raw: string): { message: string; i18nKey?: string } {
  const match = raw.match(I18N_SUFFIX)
  if (!match) {
    return { message: raw }
  }
  return { message: match[1], i18nKey: match[2] }
}

export function translateRpcError(
  err: unknown,
  t: (key: string) => string,
  te: (key: string) => boolean
): string {
  const raw = err instanceof Error ? err.message : String(err)
  const decoded = decodeRpcError(raw)
  const fromProp =
    err && typeof err === 'object' && 'i18nKey' in err
      ? String((err as { i18nKey?: string }).i18nKey ?? '')
      : ''
  const key = decoded.i18nKey || fromProp || ''
  if (key && te(key)) {
    return t(key)
  }
  return decoded.message
}

export function isCancelled(value: unknown): boolean {
  return typeof value === 'object' && value !== null && (value as { cancelled?: boolean }).cancelled === true
}
