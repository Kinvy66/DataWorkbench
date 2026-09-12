import { net, protocol } from 'electron'
import { pathToFileURL } from 'node:url'
import { HELP_PROTOCOL_SCHEME, resolveHelpAssetPath } from './help-docs'

let registered = false

export function registerHelpScheme(): void {
  if (registered) {
    return
  }
  protocol.registerSchemesAsPrivileged([
    {
      scheme: HELP_PROTOCOL_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true
      }
    }
  ])
  registered = true
}

export function installHelpProtocol(getDocsRoot: () => string): void {
  protocol.handle(HELP_PROTOCOL_SCHEME, (request) => {
    try {
      const file = resolveHelpAssetPath(getDocsRoot(), request.url)
      if (!file) {
        return new Response('Not found', { status: 404 })
      }
      return net.fetch(pathToFileURL(file).href)
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}
