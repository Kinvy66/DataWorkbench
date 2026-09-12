import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { WIKI_SHOT_FILES } from './wiki-shots'

const here = dirname(fileURLToPath(import.meta.url))
const wikiDir = resolve(here, '../../docs/wiki')

describe('wiki screenshots', () => {
  it('starts the ribbon on Home', () => {
    const source = readFileSync(resolve(here, 'ribbon/activeTab.ts'), 'utf8')
    expect(source).toContain("ref('home')")
  })

  it('lists every PNG the capture pass writes', () => {
    expect(WIKI_SHOT_FILES).toContain('01-ready.png')
    expect(WIKI_SHOT_FILES).not.toContain('01-ping.png')
  })

  it('does not send users to the retired Ping screenshot', () => {
    const pages = [
      'README.md',
      '01-install.md',
      '02-interface.md',
      '03-data.md',
      '04-operate.md',
      '05-workflow.md',
      '06-chart.md',
      '07-project.md',
      '08-tutorial.md',
      '09-test.md',
      '10-faq.md',
      '11-how-to-test.md',
      '12-bug-report.md'
    ]
    const joined = pages.map((page) => readFileSync(resolve(wikiDir, page), 'utf8')).join('\n')
    expect(joined).not.toContain('01-ping.png')
    expect(joined).toContain('01-ready.png')
    expect(joined).toContain('06-chart.png')
  })
})
