import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('VirtualTable', () => {
  it('uses AG Grid infinite rows instead of rendering the full DataFrame', () => {
    const source = readFileSync(resolve(here, 'VirtualTable.vue'), 'utf8')
    expect(source).toContain('rowModelType="infinite"')
    expect(source).toContain('GRID_CACHE_BLOCK_SIZE')
    expect(source).toContain('GRID_MAX_BLOCKS_IN_CACHE')
    expect(source).toContain('createInfiniteDatasource')
    expect(source).toContain('fetchBlock')
    expect(source).not.toContain('useVirtualizer')
    expect(source).not.toContain('clientSide')
    expect(source).not.toContain('ag-grid-enterprise')
    expect(source).not.toMatch(/v-for\s*=\s*["'][^"']*rowCount/)
    expect(source).not.toMatch(/v-for\s*=\s*["']n in \d{5,}/)
  })
})
