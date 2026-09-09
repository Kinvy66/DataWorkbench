import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FileMenuItemModel, RibbonTabModel } from '@mlightcad/ribbon'
import { Connection } from '@element-plus/icons-vue'

export function useRibbonSchema() {
  const { t } = useI18n()

  const tabs = computed<RibbonTabModel[]>(() => [
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
                  props: { icon: Connection }
                }
              ]
            }
          ]
        }
      ]
    }
  ])

  const fileMenuItems = computed<FileMenuItemModel[]>(() => [
    { id: 'file.new', label: t('ribbon.new'), disabled: true },
    { id: 'file.open', label: t('ribbon.open'), disabled: true },
    { id: 'file.save', label: t('ribbon.save'), disabled: true },
    { id: 'file.saveAs', label: t('ribbon.saveAs'), disabled: true },
    { id: 'file.exit', label: t('ribbon.exit'), divided: true }
  ])

  return { tabs, fileMenuItems }
}
