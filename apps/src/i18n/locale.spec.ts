import { afterEach, describe, expect, it } from 'vitest'
import { LOCALE_STORAGE_KEY, parseAppLocale, readStoredLocale, writeStoredLocale } from './locale'

const memory = new Map<string, string>()
const fakeStorage = {
  getItem(key: string): string | null {
    return memory.get(key) ?? null
  },
  setItem(key: string, value: string): void {
    memory.set(key, value)
  },
  removeItem(key: string): void {
    memory.delete(key)
  }
}

describe('app locale persistence', () => {
  afterEach(() => {
    memory.clear()
  })

  it('treats anything except en as Simplified Chinese', () => {
    expect(parseAppLocale('en')).toBe('en')
    expect(parseAppLocale('zh-CN')).toBe('zh-CN')
    expect(parseAppLocale('fr')).toBe('zh-CN')
  })

  it('round-trips through localStorage', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: fakeStorage,
      configurable: true
    })
    writeStoredLocale('en')
    expect(memory.get(LOCALE_STORAGE_KEY)).toBe('en')
    expect(readStoredLocale()).toBe('en')
    writeStoredLocale('zh-CN')
    expect(readStoredLocale()).toBe('zh-CN')
  })
})
