import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('StatusBar', () => {
  it('shows engine status, project name, and app version', () => {
    const source = readFileSync(resolve(here, 'StatusBar.vue'), 'utf8')
    expect(source).toContain('status.${ui.engineStatus}')
    expect(source).toContain('project.displayName')
    expect(source).toContain('APP_VERSION')
  })
})
