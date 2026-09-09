import { ElMessage, ElMessageBox } from 'element-plus'
import { APP_VERSION } from '@dw/rpc-types'
import { commandBus } from './commandBus'
import { useLogStore } from '@/stores/log'
import { useDataStore } from '@/stores/data'
import { i18n } from '@/i18n'
import { translateRpcError } from '@/rpc/rpcError'

function t(key: string, values?: Record<string, unknown>): string {
  return String(i18n.global.t(key, values as Record<string, string>))
}

function te(key: string): boolean {
  return i18n.global.te(key)
}

function reportError(err: unknown): void {
  const message = translateRpcError(err, t, te)
  ElMessage.error(message)
  useLogStore().append('error', message)
}

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
        t('log.pingOk', {
          version: result.pythonVersion ?? '?',
          pandas: result.pandasAvailable ? 'yes' : 'no'
        })
      )
    } catch (err) {
      reportError(err)
    }
  })

  commandBus.register('data.import', async () => {
    const data = useDataStore()
    const log = useLogStore()
    try {
      const imported = await data.importInteractive()
      if (!imported) {
        return
      }
      const line = t('log.importOk', {
        name: imported.name,
        rows: imported.rows,
        cols: imported.cols
      })
      log.append('info', line)
      ElMessage.success(line)
    } catch (err) {
      reportError(err)
    }
  })

  commandBus.register(
    'data.export',
    async () => {
      const data = useDataStore()
      const log = useLogStore()
      try {
        const ok = await data.exportCurrent()
        if (!ok) {
          return
        }
        log.append('info', t('log.exportOk'))
        ElMessage.success(t('log.exportOk'))
      } catch (err) {
        reportError(err)
      }
    },
    () => useDataStore().hasSelection
  )

  commandBus.register(
    'data.remove',
    async () => {
      const data = useDataStore()
      if (!data.current) {
        return
      }
      try {
        await ElMessageBox.confirm(
          t('data.removeConfirm', { name: data.current.name }),
          t('data.remove'),
          { type: 'warning' }
        )
        await data.removeCurrent()
        ElMessage.success(t('log.removeOk'))
      } catch (err) {
        if (err === 'cancel' || err === 'close') {
          return
        }
        reportError(err)
      }
    },
    () => useDataStore().hasSelection
  )

  commandBus.register('file.exit', async () => {
    await window.dw.rpc.invoke('app.quit')
  })

  const notYet = () => false
  commandBus.register('file.new', async () => {}, notYet)
  commandBus.register('file.open', async () => {}, notYet)
  commandBus.register('file.save', async () => {}, notYet)
  commandBus.register('file.saveAs', async () => {}, notYet)
}
