export type ParsedRpcLine =
  | { kind: 'response'; id: string | number; result?: unknown; error?: { code: number; message: string; data?: unknown } }
  | { kind: 'notification'; method: string; params?: unknown }
  | { kind: 'pollution'; raw: string }

/**
 * Parse one stdout line from the Python sidecar.
 * Caller must strip trailing \\r (Windows) before calling, or this function will strip it.
 */
export function parseRpcLine(line: string): ParsedRpcLine {
  const trimmed = line.endsWith('\r') ? line.slice(0, -1) : line
  if (trimmed.length === 0) {
    return { kind: 'pollution', raw: line }
  }
  let value: unknown
  try {
    value = JSON.parse(trimmed)
  } catch {
    return { kind: 'pollution', raw: trimmed }
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { kind: 'pollution', raw: trimmed }
  }
  const obj = value as Record<string, unknown>
  if (obj.jsonrpc !== '2.0') {
    return { kind: 'pollution', raw: trimmed }
  }
  if (typeof obj.method === 'string' && obj.id === undefined) {
    return { kind: 'notification', method: obj.method, params: obj.params }
  }
  if (obj.id !== undefined && obj.id !== null && (typeof obj.result !== 'undefined' || typeof obj.error !== 'undefined')) {
    const err = obj.error as { code?: number; message?: string; data?: unknown } | undefined
    return {
      kind: 'response',
      id: obj.id as string | number,
      result: obj.result,
      error: err
        ? { code: Number(err.code), message: String(err.message ?? 'error'), data: err.data }
        : undefined
    }
  }
  if (typeof obj.method === 'string' && obj.id !== undefined) {
    // Unexpected server-originated request; treat as notification-like ignore via pollution log
    return { kind: 'pollution', raw: trimmed }
  }
  return { kind: 'pollution', raw: trimmed }
}
