import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { resolveHelpLink } from '../src/help/wiki-paths'
import {
  findDocsRoot,
  listWikiPages,
  normalizeWikiPageId,
  posixResolve,
  readWikiPage,
  resolveHelpAssetPath,
  rewriteMarkdownAssets,
  titleFromMarkdown,
  WIKI_PAGE_IDS
} from './help-docs'

const here = dirname(fileURLToPath(import.meta.url))
const repoDocs = resolve(here, '../../docs')

describe('help docs', () => {
  it('normalizes bundled wiki page ids and rejects traversal', () => {
    expect(normalizeWikiPageId('README.md')).toBe('README.md')
    expect(normalizeWikiPageId('./08-tutorial.md')).toBe('08-tutorial.md')
    expect(normalizeWikiPageId('10-faq')).toBe('10-faq.md')
    expect(normalizeWikiPageId('../dev_plan/README.md')).toBeNull()
    expect(normalizeWikiPageId('..\\..\\etc\\passwd')).toBeNull()
    expect(normalizeWikiPageId('samples/wiki-demo.csv')).toBeNull()
  })

  it('resolves in-wiki markdown links and screenshot assets', () => {
    expect(resolveHelpLink('README.md', './08-tutorial.md')).toEqual({
      kind: 'page',
      page: '08-tutorial.md'
    })
    expect(resolveHelpLink('01-install.md', '../assets/wiki/01-ready.png')).toEqual({
      kind: 'asset',
      url: 'dwhelp://bundle/assets/wiki/01-ready.png'
    })
    expect(resolveHelpLink('README.md', '../dev_plan/README.md')).toEqual({ kind: 'blocked' })
    expect(resolveHelpLink('README.md', 'https://example.com')).toEqual({
      kind: 'external',
      url: 'https://example.com'
    })
  })

  it('does not let posix resolve climb above the docs root', () => {
    expect(posixResolve('wiki', '../../secret')).toBeNull()
    expect(posixResolve('wiki', '../assets/wiki/01-ready.png')).toBe('assets/wiki/01-ready.png')
  })

  it('rewrites screenshot markdown onto the help protocol', () => {
    const rewritten = rewriteMarkdownAssets(
      '![ready](../assets/wiki/01-ready.png)',
      '01-install.md'
    )
    expect(rewritten).toContain('dwhelp://bundle/assets/wiki/01-ready.png')
  })

  it('reads titles from the bundled wiki and maps screenshots', () => {
    const docsRoot = findDocsRoot({ startDir: here, cwd: repoDocs })
    expect(docsRoot).toBe(repoDocs)
    const pages = listWikiPages(docsRoot)
    expect(pages.map((page) => page.id)).toEqual([...WIKI_PAGE_IDS])
    expect(pages[0]?.title).toContain('DataWorkbench')
    const install = readWikiPage(docsRoot, '01-install.md')
    expect(install.markdown).toContain('dwhelp://bundle/assets/wiki/01-ready.png')
    expect(titleFromMarkdown('# Hello', 'x')).toBe('Hello')
    const asset = resolveHelpAssetPath(docsRoot, 'dwhelp://bundle/assets/wiki/01-ready.png')
    expect(asset?.replace(/\\/g, '/')).toMatch(/assets\/wiki\/01-ready\.png$/)
    expect(resolveHelpAssetPath(docsRoot, 'dwhelp://bundle/wiki/README.md')).toBeNull()
    expect(resolveHelpAssetPath(docsRoot, 'dwhelp://bundle/../wiki/README.md')).toBeNull()
  })
})
