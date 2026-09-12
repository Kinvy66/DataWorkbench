import { describe, expect, it } from 'vitest'
import { isAllowedHelpUrl } from './open-url'

describe('isAllowedHelpUrl', () => {
  it('allows the project wiki and repository on GitHub', () => {
    expect(isAllowedHelpUrl('https://github.com/Kinvy66/DataWorkbench')).toBe(true)
    expect(
      isAllowedHelpUrl('https://github.com/Kinvy66/DataWorkbench/blob/master/docs/wiki/README.md')
    ).toBe(true)
  })

  it('rejects other hosts and schemes', () => {
    expect(isAllowedHelpUrl('http://github.com/Kinvy66/DataWorkbench')).toBe(false)
    expect(isAllowedHelpUrl('https://evil.example/Kinvy66/DataWorkbench')).toBe(false)
    expect(isAllowedHelpUrl('https://github.com/other/DataWorkbench')).toBe(false)
    expect(isAllowedHelpUrl('not a url')).toBe(false)
  })
})
