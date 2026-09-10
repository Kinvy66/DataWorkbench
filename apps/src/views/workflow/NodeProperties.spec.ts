import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('NodeProperties font fallback', () => {
  it('edits font parameters as family/size/color instead of String(dict)', () => {
    const source = readFileSync(resolve(here, 'NodeProperties.vue'), 'utf8')
    expect(source).toContain("param.type === 'font'")
    expect(source).toContain('class="font-edit"')
    expect(source).toContain('commitFont')
  })
})
