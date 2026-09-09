import { describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE, FALLBACK_LOCALE, i18n } from './index'

describe('i18n', () => {
  it('defaults the UI to Simplified Chinese', () => {
    expect(DEFAULT_LOCALE).toBe('zh-CN')
    expect(FALLBACK_LOCALE).toBe('en')
    expect(i18n.global.locale.value).toBe('zh-CN')
  })
})
