import { defineComponent, h } from 'vue'

import iconApp from '@/assets/icons/app/icon.svg?url'
import iconPlugin from '@/assets/icons/app/plugin.svg?url'
import iconAddData from '@/assets/icons/app/addData.svg?url'
import iconSave from '@/assets/icons/app/save.svg?url'
import iconRemoveData from '@/assets/icons/app/removeData.svg?url'
import iconData from '@/assets/icons/gui/data.svg?url'
import iconDataTable from '@/assets/icons/gui/data-table.svg?url'
import iconWorkflow from '@/assets/icons/gui/workflow.svg?url'
import iconSetting from '@/assets/icons/gui/setting.svg?url'

const urls: Record<string, string> = {
  'app/icon': iconApp,
  'app/plugin': iconPlugin,
  'app/addData': iconAddData,
  'app/save': iconSave,
  'app/removeData': iconRemoveData,
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
