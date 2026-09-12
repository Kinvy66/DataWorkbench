export const HELP_PROTOCOL_SCHEME = 'dwhelp'
export const HELP_PROTOCOL_HOST = 'bundle'

export const WIKI_PAGE_IDS = [
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
] as const

export type WikiPageId = (typeof WIKI_PAGE_IDS)[number]

export type HelpLinkTarget =
  | { kind: 'page'; page: WikiPageId }
  | { kind: 'asset'; url: string }
  | { kind: 'external'; url: string }
  | { kind: 'blocked' }

export function normalizeWikiPageId(value: unknown): WikiPageId | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim().replace(/\\/g, '/')
  if (trimmed.includes('..')) {
    return null
  }
  const base = trimmed.split('/').pop() ?? ''
  const withExt = base.toLowerCase().endsWith('.md') ? base : `${base}.md`
  const matched = WIKI_PAGE_IDS.find((id) => id.toLowerCase() === withExt.toLowerCase())
  return matched ?? null
}

export function posixResolve(fromDir: string, rel: string): string | null {
  const relative = rel.split('#')[0]?.split('?')[0]?.trim() ?? ''
  if (!relative || relative.startsWith('file:')) {
    return null
  }
  const parts = [...fromDir.split('/'), ...relative.split('/')]
  const out: string[] = []
  for (const part of parts) {
    if (!part || part === '.') {
      continue
    }
    if (part === '..') {
      if (out.length === 0) {
        return null
      }
      out.pop()
      continue
    }
    if (part.includes('\\') || part.includes('\0') || part.includes(':')) {
      return null
    }
    out.push(part)
  }
  return out.join('/')
}

function wikiDirOf(_pageId: WikiPageId): string {
  return 'wiki'
}

export function resolveHelpLink(fromPage: WikiPageId, href: string): HelpLinkTarget {
  const raw = href.trim()
  if (!raw || raw.startsWith('#') || raw.startsWith('mailto:')) {
    return { kind: 'blocked' }
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    if (/^https?:\/\//i.test(raw)) {
      return { kind: 'external', url: raw }
    }
    return { kind: 'blocked' }
  }
  const resolved = posixResolve(wikiDirOf(fromPage), raw)
  if (!resolved) {
    return { kind: 'blocked' }
  }
  if (resolved.startsWith('wiki/') && resolved.toLowerCase().endsWith('.md')) {
    const page = normalizeWikiPageId(resolved.slice('wiki/'.length))
    if (page) {
      return { kind: 'page', page }
    }
    return { kind: 'blocked' }
  }
  if (/\.(png|jpe?g|gif|svg|webp)$/i.test(resolved)) {
    return { kind: 'asset', url: `${HELP_PROTOCOL_SCHEME}://${HELP_PROTOCOL_HOST}/${resolved}` }
  }
  return { kind: 'blocked' }
}

export function rewriteMarkdownAssets(markdown: string, pageId: WikiPageId): string {
  return markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (full, alt: string, href: string) => {
    const target = resolveHelpLink(pageId, href.trim())
    if (target.kind !== 'asset') {
      return full
    }
    return `![${alt}](${target.url})`
  })
}

export function titleFromMarkdown(markdown: string, fallback: string): string {
  const match = markdown.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : fallback
}
