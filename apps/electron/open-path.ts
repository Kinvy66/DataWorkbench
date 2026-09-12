/** Pick a `.dwproj` from Electron argv (Windows file association / second instance). */
export function findProjectPathFromArgv(argv: readonly string[]): string | null {
  for (const arg of argv) {
    if (!arg || arg.startsWith('-')) {
      continue
    }
    const trimmed = arg.replace(/^"+|"+$/g, '')
    if (trimmed.toLowerCase().endsWith('.dwproj')) {
      return trimmed
    }
  }
  return null
}

/** Spawn banners stay in the file log; the UI log only gets failures. */
export function shouldShowSidecarLogToUi(stream: string, text: string): boolean {
  if (stream === 'protocol') {
    return true
  }
  if (/^Starting sidecar:/i.test(text)) {
    return false
  }
  return /error|exception|traceback|failed|critical/i.test(text)
}
