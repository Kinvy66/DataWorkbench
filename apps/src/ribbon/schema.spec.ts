import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('ribbon schema', () => {
  it('registers Data import/export/remove on the command bus ids', () => {
    const source = readFileSync(resolve(here, 'schema.ts'), 'utf8')
    expect(source).toContain("id: 'data.import'")
    expect(source).toContain("id: 'data.export'")
    expect(source).toContain("id: 'data.rename'")
    expect(source).toContain("id: 'data.remove'")
    expect(source).toContain("id: 'data.dropNa'")
    expect(source).toContain("id: 'data-clean'")
    expect(source).toContain("id: 'workflow.run'")
    expect(source).toContain("id: 'workflow.stop'")
    expect(source).toContain("id: 'edit.undo'")
    expect(source).toContain("id: 'edit.redo'")
    expect(source).toContain("id: 'data-import'")
    expect(source).toContain("id: 'data-export'")
    expect(source).toContain("id: 'data'")
  })
})
