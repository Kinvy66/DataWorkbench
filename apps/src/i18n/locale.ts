export const LOCALE_STORAGE_KEY = 'dw.locale'

export type AppLocale = 'zh-CN' | 'en'

export function parseAppLocale(value: unknown): AppLocale {
  return value === 'en' ? 'en' : 'zh-CN'
}

export function readStoredLocale(): AppLocale {
  try {
    return parseAppLocale(globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY))
  } catch {
    return 'zh-CN'
  }
}

export function writeStoredLocale(locale: AppLocale): void {
  try {
    globalThis.localStorage?.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // Quota or private mode must not block the UI.
  }
}
