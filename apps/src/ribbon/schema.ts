import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FileMenuItemModel, RibbonTabModel } from '@mlightcad/ribbon'
import { ribbonIcon } from '@/icons/resolveIcon'
import { useDataStore } from '@/stores/data'
import { useWorkflowStore } from '@/stores/workflow'

export function useRibbonSchema() {
  const { t } = useI18n()
  const data = useDataStore()
  const workflow = useWorkflowStore()

  const tabs = computed<RibbonTabModel[]>(() => {
    const hasDataset = Boolean(data.currentId)
    return [
      {
        id: 'home',
        title: t('ribbon.home'),
        groups: [
          {
            id: 'clipboard',
            title: t('ribbon.clipboard'),
            collections: [
              {
                id: 'clipboard-actions',
                items: [
                  {
                    id: 'edit.undo',
                    type: 'button',
                    label: t('ribbon.undo'),
                    tooltip: t('ribbon.undoTip'),
                    size: 'large',
                    disabled: !workflow.canUndo,
                    icon: ribbonIcon('app/undo')
                  },
                  {
                    id: 'edit.redo',
                    type: 'button',
                    label: t('ribbon.redo'),
                    tooltip: t('ribbon.redoTip'),
                    size: 'large',
                    disabled: !workflow.canRedo,
                    icon: ribbonIcon('app/redo')
                  }
                ]
              }
            ]
          },
          {
            id: 'sidecar',
            title: t('ribbon.sidecar'),
            collections: [
              {
                id: 'sidecar-actions',
                items: [
                  {
                    id: 'host.ping',
                    type: 'button',
                    label: t('ribbon.ping'),
                    tooltip: t('ribbon.pingTip'),
                    size: 'large',
                    icon: ribbonIcon('app/plugin')
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        id: 'data',
        title: t('ribbon.data'),
        groups: [
          {
            id: 'data-operate',
            title: t('ribbon.dataOperate'),
            collections: [
              {
                id: 'data-operate-actions',
                items: [
                  {
                    id: 'data.import',
                    type: 'button',
                    label: t('ribbon.dataImport'),
                    tooltip: t('ribbon.dataImportTip'),
                    size: 'large',
                    icon: ribbonIcon('app/addData')
                  },
                  {
                    id: 'data.remove',
                    type: 'button',
                    label: t('ribbon.dataRemove'),
                    tooltip: t('ribbon.dataRemoveTip'),
                    size: 'large',
                    disabled: !hasDataset,
                    icon: ribbonIcon('app/removeData')
                  },
                  {
                    id: 'data.rename',
                    type: 'button',
                    label: t('ribbon.dataRename'),
                    tooltip: t('ribbon.dataRenameTip'),
                    size: 'large',
                    disabled: !hasDataset,
                    icon: ribbonIcon('app/renameColumns')
                  }
                ]
              }
            ]
          },
          {
            id: 'data-export',
            title: t('ribbon.dataExportGroup'),
            collections: [
              {
                id: 'data-export-actions',
                items: [
                  {
                    id: 'data.export',
                    type: 'button',
                    label: t('ribbon.dataExport'),
                    tooltip: t('ribbon.dataExportTip'),
                    size: 'large',
                    disabled: !hasDataset,
                    icon: ribbonIcon('app/save')
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        id: 'operate',
        title: t('ribbon.operate'),
        groups: [
          {
            id: 'operate-clean',
            title: t('ribbon.dataClean'),
            collections: [
              {
                id: 'operate-clean-actions',
                items: [
                  {
                    id: 'data.dropNa',
                    type: 'button',
                    label: t('ribbon.dataDropNa'),
                    tooltip: t('ribbon.dataDropNaTip'),
                    size: 'large',
                    disabled: !hasDataset,
                    icon: ribbonIcon('app/dropNa')
                  },
                  {
                    id: 'data.dropDuplicates',
                    type: 'button',
                    label: t('ribbon.dataDropDuplicates'),
                    tooltip: t('ribbon.dataDropDuplicatesTip'),
                    size: 'large',
                    disabled: !hasDataset,
                    icon: ribbonIcon('app/dropDuplicates')
                  },
                  {
                    id: 'data.fillNa',
                    type: 'button',
                    label: t('ribbon.dataFillNa'),
                    tooltip: t('ribbon.dataFillNaTip'),
                    size: 'large',
                    disabled: !hasDataset,
                    icon: ribbonIcon('app/fillNa')
                  }
                ]
              }
            ]
          },
          {
            id: 'operate-filter',
            title: t('ribbon.dataFilter'),
            collections: [
              {
                id: 'operate-filter-actions',
                items: [
                  {
                    id: 'data.eval',
                    type: 'button',
                    label: t('ribbon.dataEval'),
                    tooltip: t('ribbon.dataEvalTip'),
                    size: 'large',
                    disabled: !hasDataset,
                    icon: ribbonIcon('app/eval')
                  },
                  {
                    id: 'data.query',
                    type: 'button',
                    label: t('ribbon.dataQuery'),
                    tooltip: t('ribbon.dataQueryTip'),
                    size: 'large',
                    disabled: !hasDataset,
                    icon: ribbonIcon('app/query')
                  },
                  {
                    id: 'data.search',
                    type: 'button',
                    label: t('ribbon.dataSearch'),
                    tooltip: t('ribbon.dataSearchTip'),
                    size: 'medium',
                    disabled: !hasDataset,
                    icon: ribbonIcon('app/search')
                  },
                  {
                    id: 'data.filterByColumn',
                    type: 'button',
                    label: t('ribbon.dataFilterByColumn'),
                    tooltip: t('ribbon.dataFilterByColumnTip'),
                    size: 'medium',
                    disabled: !hasDataset,
                    icon: ribbonIcon('app/filterByColumn')
                  },
                  {
                    id: 'data.sort',
                    type: 'button',
                    label: t('ribbon.dataSort'),
                    tooltip: t('ribbon.dataSortTip'),
                    size: 'large',
                    disabled: !hasDataset,
                    icon: ribbonIcon('app/sort')
                  }
                ]
              }
            ]
          },
          {
            id: 'operate-stats',
            title: t('ribbon.dataStatistic'),
            collections: [
              {
                id: 'operate-stats-actions',
                items: [
                  {
                    id: 'data.describe',
                    type: 'button',
                    label: t('ribbon.dataDescribe'),
                    tooltip: t('ribbon.dataDescribeTip'),
                    size: 'large',
                    disabled: !hasDataset,
                    icon: ribbonIcon('app/describe')
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        id: 'workflow',
        title: t('ribbon.workflow'),
        groups: [
          {
            id: 'workflow-run',
            title: t('ribbon.workflowRunGroup'),
            collections: [
              {
                id: 'workflow-run-actions',
                items: [
                  {
                    id: 'workflow.run',
                    type: 'button',
                    label: t('ribbon.workflowRun'),
                    tooltip: t('ribbon.workflowRunTip'),
                    size: 'large',
                    disabled: !workflow.canRun,
                    icon: ribbonIcon('app/run')
                  },
                  {
                    id: 'workflow.stop',
                    type: 'button',
                    label: t('ribbon.workflowStop'),
                    tooltip: t('ribbon.workflowStopTip'),
                    size: 'large',
                    disabled: !workflow.canStop,
                    icon: ribbonIcon('app/stop')
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  })

  const fileMenuItems = computed<FileMenuItemModel[]>(() => [
    { id: 'file.new', label: t('ribbon.new'), disabled: true },
    { id: 'file.open', label: t('ribbon.open'), disabled: true },
    { id: 'file.save', label: t('ribbon.save'), disabled: true },
    { id: 'file.saveAs', label: t('ribbon.saveAs'), disabled: true },
    { id: 'file.exit', label: t('ribbon.exit'), divided: true }
  ])

  return { tabs, fileMenuItems }
}
