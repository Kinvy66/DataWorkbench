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
    expect(resolveIconUrl('app/undo')).toMatch(/undo\.svg/)
    expect(resolveIconUrl('app/redo')).toMatch(/redo\.svg/)
    expect(resolveIconUrl('app/zoomIn')).toMatch(/zoomIn\.svg/)
    expect(resolveIconUrl('app/zoomOut')).toMatch(/zoomOut\.svg/)
    expect(resolveIconUrl('app/viewAll')).toMatch(/viewAll\.svg/)
    expect(resolveIconUrl('app/dropNa')).toMatch(/dropNa\.svg/)
    expect(resolveIconUrl('app/dropDuplicates')).toMatch(/dropDuplicates\.svg/)
    expect(resolveIconUrl('app/fillNa')).toMatch(/fillNa\.svg/)
    expect(resolveIconUrl('app/interpolate')).toMatch(/interpolate\.svg/)
    expect(resolveIconUrl('app/outlierIqr')).toMatch(/outlierIqr\.svg/)
    expect(resolveIconUrl('app/outlierZscore')).toMatch(/outlierZscore\.svg/)
    expect(resolveIconUrl('app/replaceValues')).toMatch(/replaceValues\.svg/)
    expect(resolveIconUrl('app/thresholdFilter')).toMatch(/thresholdFilter\.svg/)
    expect(resolveIconUrl('app/filterByColumn')).toMatch(/filterByColumn\.svg/)
    expect(resolveIconUrl('app/eval')).toMatch(/eval\.svg/)
    expect(resolveIconUrl('app/search')).toMatch(/search\.svg/)
    expect(resolveIconUrl('app/query')).toMatch(/query\.svg/)
    expect(resolveIconUrl('app/sort')).toMatch(/sort\.svg/)
    expect(resolveIconUrl('app/describe')).toMatch(/describe\.svg/)
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
