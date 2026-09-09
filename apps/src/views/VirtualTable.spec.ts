import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('VirtualTable', () => {
  it('virtualizes rows instead of rendering the full DataFrame', () => {
    const source = readFileSync(resolve(here, 'VirtualTable.vue'), 'utf8')
    expect(source).toContain('useVirtualizer')
    expect(source).toContain('getVirtualItems()')
    expect(source).not.toMatch(/v-for\s*=\s*["'][^"']*rowCount/)
    expect(source).not.toMatch(/v-for\s*=\s*["']n in \d{5,}/)
  })
})
