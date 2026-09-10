import { defineComponent, h } from 'vue'

import iconApp from '@/assets/icons/app/icon.svg?url'
import iconPlugin from '@/assets/icons/app/plugin.svg?url'
import iconAddData from '@/assets/icons/app/addData.svg?url'
import iconSave from '@/assets/icons/app/save.svg?url'
import iconRemoveData from '@/assets/icons/app/removeData.svg?url'
import iconDropNa from '@/assets/icons/app/dropNa.svg?url'
import iconQuery from '@/assets/icons/app/query.svg?url'
import iconSort from '@/assets/icons/app/sort.svg?url'
import iconRenameColumns from '@/assets/icons/app/renameColumns.svg?url'
import iconData from '@/assets/icons/gui/data.svg?url'
import iconDataTable from '@/assets/icons/gui/data-table.svg?url'
import iconWorkflow from '@/assets/icons/gui/workflow.svg?url'
import iconSetting from '@/assets/icons/gui/setting.svg?url'
import iconRun from '@/assets/icons/app/run.svg?url'
import iconStop from '@/assets/icons/app/stop.svg?url'
import iconUndo from '@/assets/icons/app/undo.svg?url'
import iconRedo from '@/assets/icons/app/redo.svg?url'
import iconZoomIn from '@/assets/icons/app/zoomIn.svg?url'
import iconZoomOut from '@/assets/icons/app/zoomOut.svg?url'
import iconViewAll from '@/assets/icons/app/viewAll.svg?url'

const urls: Record<string, string> = {
  'app/icon': iconApp,
  'app/plugin': iconPlugin,
  'app/addData': iconAddData,
  'app/save': iconSave,
  'app/removeData': iconRemoveData,
  'app/dropNa': iconDropNa,
  'app/query': iconQuery,
  'app/sort': iconSort,
  'app/renameColumns': iconRenameColumns,
  'app/run': iconRun,
  'app/stop': iconStop,
  'app/undo': iconUndo,
  'app/redo': iconRedo,
  'app/zoomIn': iconZoomIn,
  'app/zoomOut': iconZoomOut,
  'app/viewAll': iconViewAll,
  'gui/data': iconData,
  'gui/data-table': iconDataTable,
  'gui/workflow': iconWorkflow,
  'gui/setting': iconSetting
}

export function resolveIconUrl(name: string): string {
  const normalized = name.replace(/\\/g, '/').replace(/\.svg$/i, '')
  return urls[normalized] ?? ''
}

export function ribbonIcon(name: string) {
  const src = resolveIconUrl(name)
  return defineComponent({
    name: 'DwRibbonIcon',
    setup() {
      return () =>
        h('img', {
          class: 'dw-ribbon-icon',
          src,
          alt: '',
          draggable: false
        })
    }
  })
}
