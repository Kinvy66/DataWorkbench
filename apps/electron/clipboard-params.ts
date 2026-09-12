import { RpcError } from './rpc-error'

export type AppClipboardWriteParams = {
  text?: string
  pngDataUrl?: string
}

export function parseClipboardWriteParams(params: unknown): AppClipboardWriteParams {
  const raw = (params ?? {}) as { text?: unknown; pngDataUrl?: unknown }
  const text = typeof raw.text === 'string' ? raw.text : undefined
  const pngDataUrl = typeof raw.pngDataUrl === 'string' ? raw.pngDataUrl : undefined
  if (!text && !pngDataUrl) {
    throw new RpcError(-32602, 'Clipboard write needs text or pngDataUrl', 'edit.clipboardEmpty')
  }
  return { text, pngDataUrl }
}
