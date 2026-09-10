import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('WorkflowNode diamond', () => {
  it('clips If/Else to a diamond without Python paint', () => {
    const source = readFileSync(resolve(here, 'WorkflowNode.vue'), 'utf8')
    expect(source).toContain("bodyShape === 'Diamond'")
    expect(source).toContain('clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)')
    expect(source).toContain('#e3f2fd')
    expect(source).toContain('#2196f3')
  })

  it('renders cached runtime text on the node body', () => {
    const source = readFileSync(resolve(here, 'WorkflowNode.vue'), 'utf8')
    expect(source).toContain('data.displayText')
    expect(source).toContain('class="preview"')
  })
})
