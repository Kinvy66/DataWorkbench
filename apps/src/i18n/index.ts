import { createI18n } from 'vue-i18n'
import en from './en'
import zhCN from './zh-CN'
import { readStoredLocale } from './locale'

export const DEFAULT_LOCALE = 'zh-CN'
export const FALLBACK_LOCALE = 'en'

export const i18n = createI18n({
  legacy: false,
  locale: readStoredLocale(),
  fallbackLocale: FALLBACK_LOCALE,
  messages: {
    en,
    'zh-CN': zhCN
  }
})
