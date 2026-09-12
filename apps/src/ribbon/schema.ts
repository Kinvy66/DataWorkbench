import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FileMenuItemModel, RibbonTabModel } from '@mlightcad/ribbon'
import { ribbonIcon } from '@/icons/resolveIcon'
import { useChartStore } from '@/stores/chart'
import { useDataStore } from '@/stores/data'
import { useWorkflowStore } from '@/stores/workflow'

export type RibbonCenterTab = 'table' | 'workflow' | 'figure'

/** Accent colors for mlRibbon contextual blocks (icon-ui semantic palette). */
export const RIBBON_CONTEXT_COLOR = {
  dataframe: '#5280C1',
  workflow: '#669E8B',
  chart: '#CE6043'
} as const

export const RIBBON_CONTEXT_TAB: Record<RibbonCenterTab, string> = {
  table: 'operate',
  workflow: 'workflow',
  figure: 'chartOperate'
}

export function ribbonContextTabId(centerTab: RibbonCenterTab): string {
  return RIBBON_CONTEXT_TAB[centerTab]
}

export function useRibbonSchema() {
  const { t } = useI18n()
  const data = useDataStore()
  const workflow = useWorkflowStore()
  const chart = useChartStore()

  const tabs = computed<RibbonTabModel[]>(() => {
    const hasDataset = Boolean(data.currentId)
    const hasChart = Boolean(chart.currentId)
    const hasFigure = chart.hasExportableFigure
    const tableFocus = workflow.centerTab === 'table' && hasDataset
    const tableHasRange = tableFocus && Boolean(data.cellRange)
    const workflowFocus = workflow.centerTab === 'workflow'
    const figureFocus = workflow.centerTab === 'figure'
    const canCopy =
      tableHasRange || (workflowFocus && workflow.canCopyGraph) || (figureFocus && hasFigure)
    const canCut = tableHasRange || (workflowFocus && workflow.canCopyGraph)
    const canPaste = tableHasRange || (workflowFocus && workflow.canPasteGraph)
    const canDelete = canCut
    const canSelectAll = tableFocus || (workflowFocus && workflow.canSelectAllGraph)
    return [
      {
        id: 'home',
        title: t('ribbon.home'),
        groups: [
          {
            id: 'home-file',
            title: t('ribbon.file'),
            collections: [
              {
                id: 'home-file-actions',
                items: [
                  {
                    id: 'file.open',
                    type: 'button',
                    label: t('ribbon.open'),
                    tooltip: t('ribbon.open'),
                    size: 'large',
                    icon: ribbonIcon('app/file')
                  },
                  {
                    id: 'file.save',
                    type: 'button',
                    label: t('ribbon.save'),
                    tooltip: t('ribbon.save'),
                    size: 'medium',
                    icon: ribbonIcon('app/save')
                  },
                  {
                    id: 'file.saveAs',
                    type: 'button',
                    label: t('ribbon.saveAs'),
                    tooltip: t('ribbon.saveAs'),
                    size: 'medium',
                    icon: ribbonIcon('app/save-as')
                  }
                ]
              }
            ]
          },
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
                  },
                  {
                    id: 'edit.cut',
                    type: 'button',
                    label: t('ribbon.cut'),
                    tooltip: t('ribbon.cutTip'),
                    size: 'small',
                    disabled: !canCut,
                    icon: ribbonIcon('gui/cut')
                  },
                  {
                    id: 'edit.copy',
                    type: 'button',
                    label: t('ribbon.copy'),
                    tooltip: t('ribbon.copyTip'),
                    size: 'small',
                    disabled: !canCopy,
                    icon: ribbonIcon('gui/copy')
                  },
                  {
                    id: 'edit.paste',
                    type: 'button',
                    label: t('ribbon.paste'),
                    tooltip: t('ribbon.pasteTip'),
                    size: 'small',
                    disabled: !canPaste,
                    icon: ribbonIcon('gui/paste')
                  },
                  {
                    id: 'edit.delete',
                    type: 'button',
                    label: t('ribbon.delete'),
                    tooltip: t('ribbon.deleteTip'),
                    size: 'small',
                    disabled: !canDelete,
                    icon: ribbonIcon('gui/delete')
                  },
                  {
                    id: 'edit.selectAll',
                    type: 'button',
                    label: t('ribbon.selectAll'),
                    tooltip: t('ribbon.selectAllTip'),
                    size: 'small',
                    disabled: !canSelectAll,
                    icon: ribbonIcon('gui/select-all')
                  }
                ]
              }
            ]
          },
          {
            id: 'create',
            title: t('ribbon.create'),
            collections: [
              {
                id: 'create-actions',
                items: [
                  {
                    id: 'data.import',
                    type: 'button',
                    label: t('ribbon.dataImport'),
                    tooltip: t('ribbon.dataImportTip'),
                    size: 'large',
                    icon: ribbonIcon('app/addData')
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
          },
          {
            id: 'home-config',
            title: t('ribbon.config'),
            collections: [
              {
                id: 'home-config-actions',
                items: [
                  {
                    id: 'app.settings',
                    type: 'button',
                    label: t('ribbon.settings'),
                    tooltip: t('ribbon.settingsTip'),
                    size: 'large',
                    icon: ribbonIcon('app/setting')
                  },
                  {
                    id: 'app.about',
                    type: 'button',
                    label: t('ribbon.about'),
                    tooltip: t('ribbon.aboutTip'),
                    size: 'large',
                    icon: ribbonIcon('app/about')
                  }
                ]
              }
            ]
          },
          {
            id: 'home-help',
            title: t('ribbon.help'),
            collections: [
              {
                id: 'home-help-actions',
                items: [
                  {
                    id: 'app.help',
                    type: 'button',
                    label: t('ribbon.helpMenu'),
                    tooltip: t('ribbon.helpTip'),
                    size: 'large',
                    icon: ribbonIcon('app/showInfomation')
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
        id: 'view',
        title: t('ribbon.view'),
        groups: [
          {
            id: 'view-display',
            title: t('ribbon.viewDisplay'),
            collections: [
              {
                id: 'view-display-actions',
                items: [
                  {
                    id: 'view.showWorkflow',
                    type: 'button',
                    label: t('ribbon.showWorkflow'),
                    tooltip: t('ribbon.showWorkflowTip'),
                    size: 'large',
                    icon: ribbonIcon('gui/workflow')
                  },
                  {
                    id: 'view.showNodes',
                    type: 'button',
                    label: t('ribbon.showNodes'),
                    tooltip: t('ribbon.showNodesTip'),
                    size: 'medium',
                    icon: ribbonIcon('app/plugin')
                  },
                  {
                    id: 'view.showFigure',
                    type: 'button',
                    label: t('ribbon.showFigure'),
                    tooltip: t('ribbon.showFigureTip'),
                    size: 'large',
                    icon: ribbonIcon('gui/chart')
                  },
                  {
                    id: 'view.showTable',
                    type: 'button',
                    label: t('ribbon.showTable'),
                    tooltip: t('ribbon.showTableTip'),
                    size: 'large',
                    icon: ribbonIcon('gui/data-table')
                  },
                  {
                    id: 'view.showDatasets',
                    type: 'button',
                    label: t('ribbon.showDatasets'),
                    tooltip: t('ribbon.showDatasetsTip'),
                    size: 'medium',
                    icon: ribbonIcon('gui/data')
                  },
                  {
                    id: 'view.showProperties',
                    type: 'button',
                    label: t('ribbon.showProperties'),
                    tooltip: t('ribbon.showPropertiesTip'),
                    size: 'medium',
                    icon: ribbonIcon('gui/setting')
                  },
                  {
                    id: 'view.showLog',
                    type: 'button',
                    label: t('ribbon.showLog'),
                    tooltip: t('ribbon.showLogTip'),
                    size: 'medium',
                    icon: ribbonIcon('app/describe')
                  }
                ]
              }
            ]
          },
          {
            id: 'layout',
            title: t('ribbon.layout'),
            collections: [
              {
                id: 'layout-actions',
                items: [
                  {
                    id: 'view.resetLayout',
                    type: 'button',
                    label: t('ribbon.resetLayout'),
                    tooltip: t('ribbon.resetLayoutTip'),
                    size: 'large',
                    icon: ribbonIcon('app/viewAll')
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        id: 'figure',
        title: t('ribbon.figure'),
        groups: [
          {
            id: 'chart-new',
            title: t('ribbon.chartNew'),
            collections: [
              {
                id: 'chart-new-actions',
                items: [
                  {
                    id: 'chart.newLine',
                    type: 'button',
                    label: t('ribbon.chartLine'),
                    tooltip: t('ribbon.chartLineTip'),
                    size: 'large',
                    disabled: !hasDataset,
                    icon: ribbonIcon('app/chart-type/chart-curve')
                  },
                  {
                    id: 'chart.newScatter',
                    type: 'button',
                    label: t('ribbon.chartScatter'),
                    tooltip: t('ribbon.chartScatterTip'),
                    size: 'large',
                    disabled: !hasDataset,
                    icon: ribbonIcon('app/chart-type/chart-scatter')
                  },
                  {
                    id: 'chart.newBar',
                    type: 'button',
                    label: t('ribbon.chartBar'),
                    tooltip: t('ribbon.chartBarTip'),
                    size: 'large',
                    disabled: !hasDataset,
                    icon: ribbonIcon('app/chart-type/chart-bar')
                  },
                  {
                    id: 'chart.newHist',
                    type: 'button',
                    label: t('ribbon.chartHist'),
                    tooltip: t('ribbon.chartHistTip'),
                    size: 'large',
                    disabled: !hasDataset,
                    icon: ribbonIcon('app/chart-type/chart-histogram')
                  },
                  {
                    id: 'chart.newBox',
                    type: 'button',
                    label: t('ribbon.chartBox'),
                    tooltip: t('ribbon.chartBoxTip'),
                    size: 'large',
                    disabled: !hasDataset,
                    icon: ribbonIcon('app/chart-type/stats-boxplot')
                  },
                  {
                    id: 'chart.newSubplots',
                    type: 'button',
                    label: t('ribbon.chartSubplots'),
                    tooltip: t('ribbon.chartSubplotsTip'),
                    size: 'large',
                    icon: ribbonIcon('app/showChart')
                  }
                ]
              }
            ]
          }
        ]
      },
      ...(workflow.centerTab === 'table'
        ? [
            {
              id: 'operate',
              title: t('ribbon.operate'),
              contextual: true,
              contextualMode: 'selection',
              contextualColor: RIBBON_CONTEXT_COLOR.dataframe,
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
                        },
                        {
                          id: 'data.interpolate',
                          type: 'button',
                          label: t('ribbon.dataInterpolate'),
                          tooltip: t('ribbon.dataInterpolateTip'),
                          size: 'large',
                          disabled: !hasDataset,
                          icon: ribbonIcon('app/interpolate')
                        },
                        {
                          id: 'data.removeOutliersIqr',
                          type: 'button',
                          label: t('ribbon.dataIqr'),
                          tooltip: t('ribbon.dataIqrTip'),
                          size: 'large',
                          disabled: !hasDataset,
                          icon: ribbonIcon('app/outlierIqr')
                        },
                        {
                          id: 'data.removeOutliersZscore',
                          type: 'button',
                          label: t('ribbon.dataZscore'),
                          tooltip: t('ribbon.dataZscoreTip'),
                          size: 'large',
                          disabled: !hasDataset,
                          icon: ribbonIcon('app/outlierZscore')
                        },
                        {
                          id: 'data.transformSkewed',
                          type: 'button',
                          label: t('ribbon.dataTransformSkewed'),
                          tooltip: t('ribbon.dataTransformSkewedTip'),
                          size: 'large',
                          disabled: !hasDataset,
                          icon: ribbonIcon('app/transformSkewed')
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
                        },
                        {
                          id: 'data.pivotTable',
                          type: 'button',
                          label: t('ribbon.dataPivotTable'),
                          tooltip: t('ribbon.dataPivotTableTip'),
                          size: 'large',
                          disabled: !hasDataset,
                          icon: ribbonIcon('app/pivotTable')
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        : []),
      ...(workflow.centerTab === 'workflow'
        ? [
            {
              id: 'workflowView',
              title: t('ribbon.workflowView'),
              contextual: true,
              contextualMode: 'selection',
              contextualColor: RIBBON_CONTEXT_COLOR.workflow,
              groups: [
                {
                  id: 'workflow-view-panel',
                  title: t('ribbon.workflowViewPanel'),
                  collections: [
                    {
                      id: 'workflow-view-actions',
                      items: [
                        {
                          id: 'workflow.fitView',
                          type: 'button',
                          label: t('layout.fitView'),
                          tooltip: t('layout.fitView'),
                          size: 'large',
                          icon: ribbonIcon('app/viewAll')
                        },
                        {
                          id: 'workflow.zoomIn',
                          type: 'button',
                          label: t('layout.zoomIn'),
                          tooltip: t('layout.zoomIn'),
                          size: 'large',
                          icon: ribbonIcon('app/zoomIn')
                        },
                        {
                          id: 'workflow.zoomOut',
                          type: 'button',
                          label: t('layout.zoomOut'),
                          tooltip: t('layout.zoomOut'),
                          size: 'large',
                          icon: ribbonIcon('app/zoomOut')
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
              contextual: true,
              contextualMode: 'selection',
              contextualColor: RIBBON_CONTEXT_COLOR.workflow,
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
        : []),
      ...(workflow.centerTab === 'figure'
        ? [
            {
              id: 'chartOperate',
              title: t('ribbon.chart'),
              contextual: true,
              contextualMode: 'selection',
              contextualColor: RIBBON_CONTEXT_COLOR.chart,
              groups: [
                {
                  id: 'chart-annotate',
                  title: t('ribbon.chartAnnotate'),
                  collections: [
                    {
                      id: 'chart-annotate-actions',
                      items: [
                        {
                          id: 'chart.annotateText',
                          type: 'button',
                          label: t('ribbon.chartAnnotateText'),
                          tooltip: t('ribbon.chartAnnotateTextTip'),
                          size: 'large',
                          disabled: !hasChart,
                          icon: ribbonIcon('app/chart-text-marker')
                        },
                        {
                          id: 'chart.annotatePoint',
                          type: 'button',
                          label: t('ribbon.chartAnnotatePoint'),
                          tooltip: t('ribbon.chartAnnotatePointTip'),
                          size: 'large',
                          disabled: !hasChart,
                          icon: ribbonIcon('app/chart-corss-marker')
                        },
                        {
                          id: 'chart.annotateArrow',
                          type: 'button',
                          label: t('ribbon.chartAnnotateArrow'),
                          tooltip: t('ribbon.chartAnnotateArrowTip'),
                          size: 'large',
                          disabled: !hasChart,
                          icon: ribbonIcon('app/chart-picker-xy')
                        },
                        {
                          id: 'chart.annotateRegion',
                          type: 'button',
                          label: t('ribbon.chartAnnotateRegion'),
                          tooltip: t('ribbon.chartAnnotateRegionTip'),
                          size: 'large',
                          disabled: !hasChart,
                          icon: ribbonIcon('app/chart-selector-rect')
                        }
                      ]
                    }
                  ]
                },
                {
                  id: 'chart-export',
                  title: t('ribbon.chartExport'),
                  collections: [
                    {
                      id: 'chart-export-actions',
                      items: [
                        {
                          id: 'chart.exportPng',
                          type: 'button',
                          label: t('ribbon.chartExportPng'),
                          tooltip: t('ribbon.chartExportPngTip'),
                          size: 'large',
                          disabled: !hasFigure,
                          icon: ribbonIcon('app/save')
                        },
                        {
                          id: 'chart.exportSvg',
                          type: 'button',
                          label: t('ribbon.chartExportSvg'),
                          tooltip: t('ribbon.chartExportSvgTip'),
                          size: 'large',
                          disabled: !hasFigure,
                          icon: ribbonIcon('app/save')
                        },
                        {
                          id: 'chart.exportPdf',
                          type: 'button',
                          label: t('ribbon.chartExportPdf'),
                          tooltip: t('ribbon.chartExportPdfTip'),
                          size: 'large',
                          disabled: !hasFigure,
                          icon: ribbonIcon('app/save')
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        : [])
    ]
  })

  // Order is locked: AppRibbon paints Qt icons via nth-child CSS url() (FileMenuItemModel has no icon).
  const fileMenuItems = computed<FileMenuItemModel[]>(() => [
    { id: 'file.new', label: t('ribbon.new') },
    { id: 'file.open', label: t('ribbon.open') },
    { id: 'file.save', label: t('ribbon.save') },
    { id: 'file.saveAs', label: t('ribbon.saveAs') },
    { id: 'file.exit', label: t('ribbon.exit'), divided: true }
  ])

  return { tabs, fileMenuItems }
}
