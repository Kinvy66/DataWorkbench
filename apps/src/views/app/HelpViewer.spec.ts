import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('HelpViewer', () => {
  it('renders bundled markdown over help.read instead of opening GitHub', () => {
    const source = readFileSync(resolve(here, 'HelpViewer.vue'), 'utf8')
    expect(source).toContain("invoke('help.read'")
    expect(source).toContain("invoke('help.list'")
    expect(source).toContain('v-html')
    expect(source).not.toContain('github.com')
  })
})
