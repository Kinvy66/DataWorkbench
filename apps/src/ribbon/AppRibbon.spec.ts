import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('AppRibbon caption chrome', () => {
  it('shrinks the drag header with margin-right so caption clicks are not native-drag', () => {
    const source = readFileSync(resolve(here, 'AppRibbon.vue'), 'utf8')
    expect(source).toMatch(/margin-right:\s*var\(--dw-caption-width\)/)
    expect(source).not.toMatch(/padding-right:\s*var\(--dw-caption-width\)/)
  })
})
