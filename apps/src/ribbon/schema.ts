import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FileMenuItemModel, RibbonTabModel } from '@mlightcad/ribbon'
import { ribbonIcon } from '@/icons/resolveIcon'
import { useDataStore } from '@/stores/data'

export function useRibbonSchema() {
  const { t } = useI18n()
  const data = useDataStore()

  const tabs = computed<RibbonTabModel[]>(() => {
    const hasDataset = Boolean(data.currentId)
    return [
      {
        id: 'home',
        title: t('ribbon.home'),
        groups: [
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
            id: 'data-import',
            title: t('ribbon.dataIo'),
            collections: [
              {
                id: 'data-import-actions',
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
            id: 'data-manage',
            title: t('ribbon.dataManage'),
            collections: [
              {
                id: 'data-manage-actions',
                items: [
                  {
                    id: 'data.export',
                    type: 'button',
                    label: t('ribbon.dataExport'),
                    tooltip: t('ribbon.dataExportTip'),
                    disabled: !hasDataset,
                    icon: ribbonIcon('app/save')
                  },
                  {
                    id: 'data.remove',
                    type: 'button',
                    label: t('ribbon.dataRemove'),
                    tooltip: t('ribbon.dataRemoveTip'),
                    disabled: !hasDataset,
                    icon: ribbonIcon('app/removeData')
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
