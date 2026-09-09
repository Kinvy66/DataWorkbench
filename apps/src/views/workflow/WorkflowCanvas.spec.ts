import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('WorkflowCanvas toolbar', () => {
  it('uses spaced 32px buttons instead of the default Vue Flow control stack', () => {
    const source = readFileSync(resolve(here, 'WorkflowCanvas.vue'), 'utf8')
    expect(source).toContain('class="flow-toolbar"')
    expect(source).toContain('gap: 8px')
    expect(source).toContain('width: 32px')
    expect(source).toContain('height: 32px')
    expect(source).not.toContain('<Controls')
    expect(source).toContain('app/zoomIn')
    expect(source).toContain('app/zoomOut')
    expect(source).toContain('app/viewAll')
  })
})
