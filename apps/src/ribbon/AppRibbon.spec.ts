import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('AppRibbon caption chrome', () => {
  it('keeps ribbon header content in the titlebar-area so it does not sit under native controls', () => {
    const source = readFileSync(resolve(here, 'AppRibbon.vue'), 'utf8')
    expect(source).toContain('env(titlebar-area-width')
    expect(source).toContain('env(titlebar-area-x')
    expect(source).not.toContain('WindowCaptionButtons')
  })
})
