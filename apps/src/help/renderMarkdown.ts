import { marked } from 'marked'
import DOMPurify from 'dompurify'

const HELP_URI_REGEXP =
  /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|dwhelp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i

export function renderHelpMarkdown(markdown: string): string {
  const raw = marked.parse(markdown, { async: false, gfm: true })
  const source = typeof raw === 'string' ? raw : String(raw)
  if (typeof globalThis.window === 'undefined') {
    return source
  }
  return DOMPurify.sanitize(source, { USE_PROFILES: { html: true }, ALLOWED_URI_REGEXP: HELP_URI_REGEXP })
}
