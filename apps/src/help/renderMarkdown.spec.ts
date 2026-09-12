import { describe, expect, it } from 'vitest'
import { renderHelpMarkdown } from './renderMarkdown'

describe('renderHelpMarkdown', () => {
  it('keeps help-protocol screenshots and wiki links', () => {
    const html = renderHelpMarkdown(
      'See [tutorial](./08-tutorial.md)\n\n![ready](dwhelp://bundle/assets/wiki/01-ready.png)'
    )
    expect(html).toContain('08-tutorial.md')
    expect(html).toContain('dwhelp://bundle/assets/wiki/01-ready.png')
  })
})
