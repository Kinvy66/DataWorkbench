import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('WorkbenchLayout dock tabs', () => {
  it('paints the active workspace tab white and accented, not the same gray as siblings', () => {
    const source = readFileSync(resolve(here, 'WorkbenchLayout.vue'), 'utf8')
    expect(source).toContain('.lm_tab.lm_active')
    expect(source).toContain('font-weight: 600')
    expect(source).toContain('inset 0 2px 0 var(--dw-accent, #5280c1)')
    expect(source).toContain('.lm_tab:hover')
    expect(source).toContain("color-mix(in srgb, var(--dw-accent, #5280c1) 10%, transparent)")
    expect(source).not.toMatch(/\.lm_tab:hover,\s*\n?\s*\.lm_tab\.lm_active/)
  })
})
