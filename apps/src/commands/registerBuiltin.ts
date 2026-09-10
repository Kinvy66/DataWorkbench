import { ElMessage, ElMessageBox } from 'element-plus'
import { APP_VERSION } from '@dw/rpc-types'
import { commandBus } from './commandBus'
import { useLogStore } from '@/stores/log'
import { useDataStore } from '@/stores/data'
import { useWorkflowStore } from '@/stores/workflow'
import { i18n } from '@/i18n'
import { translateRpcError } from '@/rpc/rpcError'
import { getDesktopBridge } from '@/rpc/bridge'

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
      const result = (await getDesktopBridge().rpc.invoke('host.hello', {
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
    'data.rename',
    async () => {
      const data = useDataStore()
      if (!data.current || !data.currentId) {
        return
      }
      try {
        const { value } = await ElMessageBox.prompt(
          t('data.renamePrompt'),
          t('ribbon.dataRename'),
          {
            inputValue: data.current.name,
            inputValidator: (input) => Boolean(input?.trim()) || t('data.invalidValue')
          }
        )
        const name = value.trim()
        await data.rename(data.currentId, name)
        const line = t('log.renameOk', { name })
        useLogStore().append('info', line)
        ElMessage.success(line)
      } catch (err) {
        if (err === 'cancel' || err === 'close') {
          return
        }
        reportError(err)
      }
    },
    () => useDataStore().hasSelection
  )

  commandBus.register(
    'data.dropNa',
    async () => {
      const data = useDataStore()
      if (!data.currentId) {
        return
      }
      try {
        if (!data.schema) {
          await data.select(data.currentId)
        }
        data.dropNaDialogOpen = true
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

  commandBus.register(
    'edit.undo',
    async () => {
      try {
        await useWorkflowStore().undo()
      } catch (err) {
        reportError(err)
      }
    },
    () => useWorkflowStore().canUndo
  )

  commandBus.register(
    'edit.redo',
    async () => {
      try {
        await useWorkflowStore().redo()
      } catch (err) {
        reportError(err)
      }
    },
    () => useWorkflowStore().canRedo
  )

  commandBus.register(
    'workflow.run',
    async () => {
      try {
        await useWorkflowStore().run()
      } catch (err) {
        reportError(err)
      }
    },
    () => useWorkflowStore().canRun
  )

  commandBus.register(
    'workflow.stop',
    async () => {
      try {
        await useWorkflowStore().stop()
      } catch (err) {
        reportError(err)
      }
    },
    () => useWorkflowStore().canStop
  )

  commandBus.register('file.exit', async () => {
    await getDesktopBridge().rpc.invoke('app.quit')
  })

  const notYet = () => false
  commandBus.register('file.new', async () => {}, notYet)
  commandBus.register('file.open', async () => {}, notYet)
  commandBus.register('file.save', async () => {}, notYet)
  commandBus.register('file.saveAs', async () => {}, notYet)
}
