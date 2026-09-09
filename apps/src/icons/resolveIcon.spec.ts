import { describe, expect, it } from 'vitest'
import { resolveIconUrl } from './resolveIcon'

describe('resolveIconUrl', () => {
  it('resolves the app logo copied from upstream', () => {
    expect(resolveIconUrl('app/icon')).toMatch(/icon\.svg/)
  })

  it('resolves a ribbon action icon', () => {
    expect(resolveIconUrl('app/plugin')).toMatch(/plugin\.svg/)
  })

  it('returns empty string for a missing name', () => {
    expect(resolveIconUrl('app/does-not-exist')).toBe('')
  })
})
