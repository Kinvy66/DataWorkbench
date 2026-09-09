import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { resolveIconUrl } from './resolveIcon'

const here = dirname(fileURLToPath(import.meta.url))

describe('resolveIconUrl', () => {
  it('resolves the app logo copied from upstream', () => {
    expect(resolveIconUrl('app/icon')).toMatch(/icon\.svg/)
  })

  it('resolves a ribbon action icon', () => {
    expect(resolveIconUrl('app/plugin')).toMatch(/plugin\.svg/)
    expect(resolveIconUrl('app/addData')).toMatch(/addData\.svg/)
    expect(resolveIconUrl('app/renameColumns')).toMatch(/renameColumns\.svg/)
    expect(resolveIconUrl('app/run')).toMatch(/run\.svg/)
    expect(resolveIconUrl('app/stop')).toMatch(/stop\.svg/)
  })

  it('returns empty string for a missing name', () => {
    expect(resolveIconUrl('app/does-not-exist')).toBe('')
  })

  it('crops plugin.svg off the letter-page canvas so the glyph fills the ribbon slot', () => {
    const svg = readFileSync(resolve(here, '../assets/icons/app/plugin.svg'), 'utf8')
    expect(svg).not.toContain('viewBox="0 0 612 792"')
    expect(svg).toMatch(/viewBox="0 151\.2 612 550\.8"/)
  })
})
