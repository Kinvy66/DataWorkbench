import { ElMessage, ElMessageBox } from 'element-plus'
import { APP_VERSION } from '@dw/rpc-types'
import { commandBus } from './commandBus'
import { useLogStore } from '@/stores/log'
import { useDataStore } from '@/stores/data'
import { useWorkflowStore } from '@/stores/workflow'
import { useChartStore } from '@/stores/chart'
import { useProjectStore } from '@/stores/project'
import { i18n } from '@/i18n'
import { translateRpcError } from '@/rpc/rpcError'
import { getDesktopBridge } from '@/rpc/bridge'
import { confirmAndQuit, newProject, openProject, saveProject } from '@/project/session'
import { useAppUiStore } from '@/stores/appUi'
import { tableClipboard } from '@/data/tableClipboard'
import {
  APP_HELP_FAQ_URL,
  APP_HELP_GUIDE_URL,
  APP_HELP_TUTORIAL_URL,
  APP_REPO_URL
} from '@/help/urls'
import type { DockPanelId } from '@/layout/docking'
import { workflowCanvasView } from '@/workflow/canvasView'

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
    'data.dropDuplicates',
    async () => {
      const data = useDataStore()
      if (!data.currentId) {
        return
      }
      try {
        if (!data.schema) {
          await data.select(data.currentId)
        }
        data.dropDuplicatesDialogOpen = true
      } catch (err) {
        reportError(err)
      }
    },
    () => useDataStore().hasSelection
  )

  commandBus.register(
    'data.fillNa',
    async () => {
      const data = useDataStore()
      if (!data.currentId) {
        return
      }
      try {
        if (!data.schema) {
          await data.select(data.currentId)
        }
        data.fillNaDialogOpen = true
      } catch (err) {
        reportError(err)
      }
    },
    () => useDataStore().hasSelection
  )

  commandBus.register(
    'data.interpolate',
    async () => {
      const data = useDataStore()
      if (!data.currentId) {
        return
      }
      try {
        if (!data.schema) {
          await data.select(data.currentId)
        }
        data.interpolateDialogOpen = true
      } catch (err) {
        reportError(err)
      }
    },
    () => useDataStore().hasSelection
  )

  commandBus.register(
    'data.removeOutliersIqr',
    async () => {
      const data = useDataStore()
      if (!data.currentId) {
        return
      }
      try {
        if (!data.schema) {
          await data.select(data.currentId)
        }
        data.iqrDialogOpen = true
      } catch (err) {
        reportError(err)
      }
    },
    () => useDataStore().hasSelection
  )

  commandBus.register(
    'data.removeOutliersZscore',
    async () => {
      const data = useDataStore()
      if (!data.currentId) {
        return
      }
      try {
        if (!data.schema) {
          await data.select(data.currentId)
        }
        data.zscoreDialogOpen = true
      } catch (err) {
        reportError(err)
      }
    },
    () => useDataStore().hasSelection
  )

  commandBus.register(
    'data.transformSkewed',
    async () => {
      const data = useDataStore()
      if (!data.currentId) {
        return
      }
      try {
        if (!data.schema) {
          await data.select(data.currentId)
        }
        data.transformSkewedDialogOpen = true
      } catch (err) {
        reportError(err)
      }
    },
    () => useDataStore().hasSelection
  )

  commandBus.register(
    'data.replaceValues',
    async () => {
      const data = useDataStore()
      if (!data.currentId) {
        return
      }
      try {
        if (!data.schema) {
          await data.select(data.currentId)
        }
        data.replaceValuesDialogOpen = true
      } catch (err) {
        reportError(err)
      }
    },
    () => useDataStore().hasSelection
  )

  commandBus.register(
    'data.thresholdFilter',
    async () => {
      const data = useDataStore()
      if (!data.currentId) {
        return
      }
      try {
        if (!data.schema) {
          await data.select(data.currentId)
        }
        data.thresholdFilterDialogOpen = true
      } catch (err) {
        reportError(err)
      }
    },
    () => useDataStore().hasSelection
  )

  commandBus.register(
    'data.filterByColumn',
    async () => {
      const data = useDataStore()
      if (!data.currentId) {
        return
      }
      try {
        if (!data.schema) {
          await data.select(data.currentId)
        }
        data.filterByColumnDialogOpen = true
      } catch (err) {
        reportError(err)
      }
    },
    () => useDataStore().hasSelection
  )

  commandBus.register(
    'data.eval',
    async () => {
      const data = useDataStore()
      if (!data.currentId) {
        return
      }
      try {
        if (!data.schema) {
          await data.select(data.currentId)
        }
        data.evalDialogOpen = true
      } catch (err) {
        reportError(err)
      }
    },
    () => useDataStore().hasSelection
  )

  commandBus.register(
    'data.search',
    async () => {
      const data = useDataStore()
      if (!data.currentId) {
        return
      }
      try {
        if (!data.schema) {
          await data.select(data.currentId)
        }
        data.searchDialogOpen = true
      } catch (err) {
        reportError(err)
      }
    },
    () => useDataStore().hasSelection
  )

  commandBus.register(
    'data.query',
    async () => {
      const data = useDataStore()
      if (!data.currentId) {
        return
      }
      try {
        if (!data.schema) {
          await data.select(data.currentId)
        }
        data.queryDialogOpen = true
      } catch (err) {
        reportError(err)
      }
    },
    () => useDataStore().hasSelection
  )

  commandBus.register(
    'data.sort',
    async () => {
      const data = useDataStore()
      if (!data.currentId) {
        return
      }
      try {
        if (!data.schema) {
          await data.select(data.currentId)
        }
        data.sortDialogOpen = true
      } catch (err) {
        reportError(err)
      }
    },
    () => useDataStore().hasSelection
  )

  commandBus.register(
    'data.describe',
    async () => {
      const data = useDataStore()
      if (!data.currentId) {
        return
      }
      try {
        if (!data.schema) {
          await data.select(data.currentId)
        }
        data.describeDialogOpen = true
      } catch (err) {
        reportError(err)
      }
    },
    () => useDataStore().hasSelection
  )

  commandBus.register(
    'data.pivotTable',
    async () => {
      const data = useDataStore()
      if (!data.currentId) {
        return
      }
      try {
        if (!data.schema) {
          await data.select(data.currentId)
        }
        data.pivotTableDialogOpen = true
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

  function editFocus(): 'table' | 'workflow' | 'figure' {
    return useWorkflowStore().centerTab
  }

  commandBus.register('edit.copy', async () => {
    try {
      const tab = editFocus()
      if (tab === 'table') {
        const host = tableClipboard()
        if (!host?.hasRange()) {
          ElMessage.warning(t('edit.noCells'))
          return
        }
        const ok = await host.copy()
        if (!ok) {
          ElMessage.warning(t('edit.noCells'))
        }
        return
      }
      if (tab === 'workflow') {
        if (!useWorkflowStore().copySelection()) {
          ElMessage.warning(t('edit.noSelection'))
        }
        return
      }
      const png = await useChartStore().capturePngDataUrl()
      if (!png) {
        ElMessage.warning(t('chart.exportMissing'))
        return
      }
      await getDesktopBridge().rpc.invoke('app.clipboardWrite', { pngDataUrl: png })
      ElMessage.success(t('edit.chartCopied'))
    } catch (err) {
      reportError(err)
    }
  })

  commandBus.register('edit.cut', async () => {
    try {
      const tab = editFocus()
      if (tab === 'table') {
        const host = tableClipboard()
        if (!host?.hasRange()) {
          ElMessage.warning(t('edit.noCells'))
          return
        }
        const n = await host.cut()
        if (!n) {
          ElMessage.warning(t('edit.noCells'))
        }
        return
      }
      if (tab === 'workflow') {
        const workflow = useWorkflowStore()
        if (!workflow.copySelection()) {
          ElMessage.warning(t('edit.noSelection'))
          return
        }
        await workflow.deleteSelection()
        return
      }
      ElMessage.info(t('edit.notOnFigure'))
    } catch (err) {
      reportError(err)
    }
  })

  commandBus.register('edit.paste', async () => {
    try {
      const tab = editFocus()
      if (tab === 'table') {
        const host = tableClipboard()
        if (!host?.hasRange()) {
          ElMessage.warning(t('edit.noCells'))
          return
        }
        const n = await host.paste()
        if (n > 0) {
          ElMessage.success(t('edit.pasted', { count: n }))
        }
        return
      }
      if (tab === 'workflow') {
        const n = await useWorkflowStore().pasteClip()
        if (!n) {
          ElMessage.warning(t('edit.clipboardEmpty'))
        }
        return
      }
      ElMessage.info(t('edit.notOnFigure'))
    } catch (err) {
      reportError(err)
    }
  })

  commandBus.register('edit.delete', async () => {
    try {
      const tab = editFocus()
      if (tab === 'table') {
        const host = tableClipboard()
        if (!host?.hasRange()) {
          ElMessage.warning(t('edit.noCells'))
          return
        }
        await host.deleteCells()
        return
      }
      if (tab === 'workflow') {
        const n = await useWorkflowStore().deleteSelection()
        if (!n) {
          ElMessage.warning(t('edit.noSelection'))
        }
        return
      }
      ElMessage.info(t('edit.notOnFigure'))
    } catch (err) {
      reportError(err)
    }
  })

  commandBus.register('edit.selectAll', async () => {
    const tab = editFocus()
    if (tab === 'table') {
      tableClipboard()?.selectAll()
      return
    }
    if (tab === 'workflow') {
      useWorkflowStore().selectAllNodes()
    }
  })

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
    await confirmAndQuit()
  })

  commandBus.register('file.new', async () => {
    await newProject()
  })
  commandBus.register('file.open', async () => {
    await openProject()
  })
  commandBus.register('file.save', async () => {
    await saveProject(false)
  })
  commandBus.register('file.saveAs', async () => {
    await saveProject(true)
  })

  commandBus.register('app.settings', () => {
    useAppUiStore().openSettings()
  })
  commandBus.register('app.about', () => {
    useAppUiStore().openAbout()
  })
  commandBus.register('app.help', () => {
    useAppUiStore().openHelp()
  })

  async function openHelpUrl(url: string): Promise<void> {
    try {
      await getDesktopBridge().rpc.invoke('app.openUrl', { url })
    } catch (err) {
      reportError(err)
    }
  }

  commandBus.register('help.guide', async () => {
    await openHelpUrl(APP_HELP_GUIDE_URL)
  })
  commandBus.register('help.tutorial', async () => {
    await openHelpUrl(APP_HELP_TUTORIAL_URL)
  })
  commandBus.register('help.faq', async () => {
    await openHelpUrl(APP_HELP_FAQ_URL)
  })
  commandBus.register('help.repo', async () => {
    await openHelpUrl(APP_REPO_URL)
  })

  commandBus.register('view.resetLayout', () => {
    useProjectStore().resetDocking()
    useLogStore().append('info', t('log.layoutReset'))
  })

  const showDocks: Array<[string, DockPanelId]> = [
    ['view.showTable', 'table'],
    ['view.showWorkflow', 'workflow'],
    ['view.showFigure', 'figure'],
    ['view.showDatasets', 'datasets'],
    ['view.showNodes', 'nodes'],
    ['view.showProperties', 'properties'],
    ['view.showLog', 'log']
  ]
  for (const [id, dock] of showDocks) {
    commandBus.register(id, () => {
      useWorkflowStore().showDock(dock)
    })
  }

  commandBus.register('workflow.zoomIn', () => {
    workflowCanvasView()?.zoomIn()
  })
  commandBus.register('workflow.zoomOut', () => {
    workflowCanvasView()?.zoomOut()
  })
  commandBus.register('workflow.fitView', () => {
    workflowCanvasView()?.fitView()
  })

  commandBus.register(
    'chart.newLine',
    async () => {
      useChartStore().openBindDialog('line')
    },
    () => useDataStore().hasSelection
  )
  commandBus.register(
    'chart.newScatter',
    async () => {
      useChartStore().openBindDialog('scatter')
    },
    () => useDataStore().hasSelection
  )
  commandBus.register(
    'chart.newBar',
    async () => {
      useChartStore().openBindDialog('bar')
    },
    () => useDataStore().hasSelection
  )
  commandBus.register(
    'chart.newHist',
    async () => {
      useChartStore().openBindDialog('hist')
    },
    () => useDataStore().hasSelection
  )
  commandBus.register(
    'chart.newBox',
    async () => {
      useChartStore().openBindDialog('box')
    },
    () => useDataStore().hasSelection
  )
  commandBus.register('chart.newSubplots', () => {
    useChartStore().openSubplotDialog()
  })

  const hasChart = () => Boolean(useChartStore().currentId)
  const hasFigure = () => useChartStore().hasExportableFigure

  async function exportChart(format: 'png' | 'svg' | 'pdf'): Promise<void> {
    const log = useLogStore()
    try {
      const ok = await useChartStore().saveExport(format)
      if (!ok) {
        return
      }
      const line = t('log.chartExportOk', {
        format: format === 'png' ? 'PNG' : format === 'svg' ? 'SVG' : 'PDF'
      })
      log.append('info', line)
      ElMessage.success(line)
    } catch (err) {
      reportError(err)
    }
  }

  commandBus.register('chart.exportPng', () => exportChart('png'), hasFigure)
  commandBus.register('chart.exportSvg', () => exportChart('svg'), hasFigure)
  commandBus.register('chart.exportPdf', () => exportChart('pdf'), hasFigure)
  commandBus.register('chart.annotateText', () => useChartStore().togglePlace('text'), hasChart)
  commandBus.register('chart.annotatePoint', () => useChartStore().togglePlace('point'), hasChart)
  commandBus.register('chart.annotateArrow', () => useChartStore().togglePlace('arrow'), hasChart)
  commandBus.register('chart.annotateRegion', () => useChartStore().togglePlace('region'), hasChart)
}
