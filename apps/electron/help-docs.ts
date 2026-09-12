import fs from 'node:fs'
import path from 'node:path'
import {
  HELP_PROTOCOL_HOST,
  HELP_PROTOCOL_SCHEME,
  WIKI_PAGE_IDS,
  normalizeWikiPageId,
  posixResolve,
  rewriteMarkdownAssets,
  titleFromMarkdown,
  type WikiPageId
} from '../src/help/wiki-paths'

export {
  HELP_PROTOCOL_HOST,
  HELP_PROTOCOL_SCHEME,
  WIKI_PAGE_IDS,
  normalizeWikiPageId,
  posixResolve,
  rewriteMarkdownAssets,
  titleFromMarkdown
}
export type { WikiPageId } from '../src/help/wiki-paths'

export type HelpPageSummary = {
  id: WikiPageId
  title: string
}

export type HelpPageContent = {
  id: WikiPageId
  title: string
  markdown: string
}

export type PathExists = (candidate: string) => boolean

const defaultExists: PathExists = (candidate) => fs.existsSync(candidate)

export type FindDocsRootInput = {
  startDir: string
  cwd?: string
  resourcesPath?: string
  exists?: PathExists
}

export function isDocsRoot(dir: string, exists: PathExists): boolean {
  return exists(path.join(dir, 'wiki', 'README.md'))
}

export function findDocsRoot(input: FindDocsRootInput): string {
  const exists = input.exists ?? defaultExists
  if (input.resourcesPath) {
    const packed = path.join(input.resourcesPath, 'docs')
    if (isDocsRoot(packed, exists)) {
      return packed
    }
  }
  const starts = [input.startDir, input.cwd ?? process.cwd()]
  for (const start of starts) {
    let dir = start
    for (let i = 0; i < 12; i++) {
      const nested = path.join(dir, 'docs')
      if (isDocsRoot(nested, exists)) {
        return nested
      }
      if (isDocsRoot(dir, exists)) {
        return dir
      }
      const parent = path.dirname(dir)
      if (parent === dir) {
        break
      }
      dir = parent
    }
  }
  throw new Error('Cannot find bundled help docs (docs/wiki/README.md missing).')
}

function assertInside(root: string, candidate: string): string | null {
  const resolved = path.resolve(candidate)
  const rootResolved = path.resolve(root)
  const prefix = rootResolved.endsWith(path.sep) ? rootResolved : rootResolved + path.sep
  if (resolved === rootResolved || resolved.startsWith(prefix)) {
    return resolved
  }
  return null
}

export function resolveHelpAssetPath(docsRoot: string, requestUrl: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(requestUrl)
  } catch {
    return null
  }
  if (parsed.protocol !== `${HELP_PROTOCOL_SCHEME}:`) {
    return null
  }
  if (parsed.hostname !== HELP_PROTOCOL_HOST) {
    return null
  }
  const rel = decodeURIComponent(parsed.pathname).replace(/^\/+/, '')
  if (!rel || rel.includes('\0')) {
    return null
  }
  const posix = posixResolve('', rel)
  if (!posix || (posix.startsWith('wiki/') && posix.toLowerCase().endsWith('.md'))) {
    return null
  }
  if (!/\.(png|jpe?g|gif|svg|webp)$/i.test(posix)) {
    return null
  }
  const abs = assertInside(docsRoot, path.join(docsRoot, ...posix.split('/')))
  if (!abs || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    return null
  }
  return abs
}

export function readWikiPage(docsRoot: string, pageId: WikiPageId): HelpPageContent {
  const abs = assertInside(docsRoot, path.join(docsRoot, 'wiki', pageId))
  if (!abs || !fs.existsSync(abs)) {
    throw new Error(`Help page not found: ${pageId}`)
  }
  const markdown = fs.readFileSync(abs, 'utf8')
  return {
    id: pageId,
    title: titleFromMarkdown(markdown, pageId),
    markdown: rewriteMarkdownAssets(markdown, pageId)
  }
}

export function listWikiPages(docsRoot: string): HelpPageSummary[] {
  return WIKI_PAGE_IDS.map((id) => {
    try {
      const page = readWikiPage(docsRoot, id)
      return { id, title: page.title }
    } catch {
      return { id, title: id }
    }
  })
}
