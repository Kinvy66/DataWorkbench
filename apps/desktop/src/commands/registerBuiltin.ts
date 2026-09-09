import { APP_VERSION } from '@dw/rpc-types'
import { commandBus } from './commandBus'
import { useLogStore } from '@/stores/log'
import { i18n } from '@/i18n'

export function registerBuiltinCommands(): void {
  commandBus.register('host.ping', async () => {
    const log = useLogStore()
    try {
      const result = (await window.dw.rpc.invoke('host.hello', {
        appVersion: APP_VERSION,
        workspaceRoot: ''
      })) as { pythonVersion?: string; pandasAvailable?: boolean }
      log.append(
        'info',
        String(
          i18n.global.t('log.pingOk', {
            version: result.pythonVersion ?? '?',
            pandas: result.pandasAvailable ? 'yes' : 'no'
          })
        )
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.append('error', String(i18n.global.t('log.pingFail', { error: message })))
    }
  })

  commandBus.register('file.exit', async () => {
    await window.dw.rpc.invoke('app.quit')
  })

  const notYet = () => false
  commandBus.register('file.new', async () => {}, notYet)
  commandBus.register('file.open', async () => {}, notYet)
  commandBus.register('file.save', async () => {}, notYet)
  commandBus.register('file.saveAs', async () => {}, notYet)
}
