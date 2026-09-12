export function isAllowedHelpUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') {
      return false
    }
    if (parsed.username || parsed.password) {
      return false
    }
    if (parsed.hostname !== 'github.com') {
      return false
    }
    return parsed.pathname === '/Kinvy66/DataWorkbench' || parsed.pathname.startsWith('/Kinvy66/DataWorkbench/')
  } catch {
    return false
  }
}
