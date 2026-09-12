import { nextTick } from 'vue'
import { i18n } from '@/i18n'
import { wikiPrefill } from '@/wiki-prefill'
import { type WikiShotFile } from '@/wiki-shots'
import { ribbonActiveTab } from '@/ribbon/activeTab'
import { useAppUiStore } from '@/stores/appUi'
import { useChartStore } from '@/stores/chart'
import { useDataStore } from '@/stores/data'
import { useLogStore } from '@/stores/log'
import { useWorkflowStore } from '@/stores/workflow'
import { workflowCanvasView } from '@/workflow/canvasView'

type WikiRunOpts = { csvPath: string }

type Callout = {
  n: number
  label: string
  color: string
  rect: DOMRect
  kind?: 'box' | 'pill'
  pill?: 'tl' | 'tr' | 'bl' | 'br'
}

const BLUE = '#2563eb'
const GREEN = '#16a34a'
const RED = '#dc2626'
const GOLD = '#d97706'

function wikiApi(): NonNullable<Window['dw']>['wiki'] {
  const wiki = window.dw?.wiki
  if (!wiki) {
    throw new Error('wiki capture API missing')
  }
  return wiki
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

async function waitFor(pred: () => boolean, timeoutMs: number, label: string): Promise<void> {
  const start = Date.now()
  while (!pred()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`timed out waiting for ${label}`)
    }
    await sleep(50)
  }
}

function dismissToasts(): void {
  document.querySelectorAll('.el-message, .el-notification').forEach((node) => node.remove())
}

function textOf(el: Element): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function findEl(selector: string, text?: string): HTMLElement | null {
  const nodes = [...document.querySelectorAll(selector)]
  if (!text) {
    return (nodes[0] as HTMLElement | undefined) ?? null
  }
  return (nodes.find((node) => textOf(node).includes(text)) as HTMLElement | undefined) ?? null
}

function mustRect(el: HTMLElement | null, label: string): DOMRect {
  if (!el) {
    console.warn(`[wiki-capture] missing element for ${label}`)
    return new DOMRect(0, 0, 0, 0)
  }
  return el.getBoundingClientRect()
}

function ribbonTab(label: string): HTMLElement | null {
  const tabs = [...document.querySelectorAll('.ml-ribbon-tab')] as HTMLElement[]
  return tabs.find((el) => textOf(el) === label) ?? findEl('.ml-ribbon-tab', label)
}

function ribbonButton(label: string): HTMLElement | null {
  const labels = [...document.querySelectorAll('.ml-ribbon-button__label, .ml-ribbon-item-host__label')] as HTMLElement[]
  const hit = labels.find((el) => textOf(el) === label)
  return (hit?.closest('.ml-ribbon-button, .ml-ribbon-item-host, button') as HTMLElement | null) ?? null
}

function unionRect(els: Array<HTMLElement | null>): DOMRect {
  const boxes = els.map((el) => el?.getBoundingClientRect()).filter((r): r is DOMRect => Boolean(r && r.width > 2))
  if (!boxes.length) {
    return new DOMRect(0, 0, 0, 0)
  }
  const left = Math.min(...boxes.map((r) => r.left))
  const top = Math.min(...boxes.map((r) => r.top))
  const right = Math.max(...boxes.map((r) => r.right))
  const bottom = Math.max(...boxes.map((r) => r.bottom))
  return new DOMRect(left, top, right - left, bottom - top)
}

function dockTab(label: string): HTMLElement | null {
  return findEl('.lm_tab', label)
}

function classifyStacks(): {
  left: HTMLElement
  center: HTMLElement
  right: HTMLElement
  bottom: HTMLElement
} {
  const stacks = [...document.querySelectorAll('.lm_stack')] as HTMLElement[]
  if (stacks.length < 4) {
    throw new Error(`expected 4 dock stacks, got ${stacks.length}`)
  }
  const boxes = stacks.map((el) => ({ el, r: el.getBoundingClientRect() }))
  const left = boxes.reduce((best, item) => (item.r.left < best.r.left ? item : best))
  const right = boxes.reduce((best, item) => (item.r.left > best.r.left ? item : best))
  const bottom = boxes.reduce((best, item) => (item.r.top > best.r.top ? item : best))
  const center =
    boxes.find((item) => item.el !== left.el && item.el !== right.el && item.el !== bottom.el) ?? boxes[1]
  return { left: left.el, center: center.el, right: right.el, bottom: bottom.el }
}

function overlayRoot(): HTMLElement {
  let root = document.getElementById('wiki-shot-overlay')
  if (!root) {
    root = document.createElement('div')
    root.id = 'wiki-shot-overlay'
    root.setAttribute('aria-hidden', 'true')
    document.body.appendChild(root)
  }
  Object.assign(root.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '40000',
    pointerEvents: 'none',
    overflow: 'visible'
  })
  return root
}

function clearOverlay(): void {
  const root = document.getElementById('wiki-shot-overlay')
  if (root) {
    root.innerHTML = ''
  }
}

function paintCallouts(items: Callout[]): void {
  const root = overlayRoot()
  root.innerHTML = ''
  for (const item of items) {
    const r = item.rect
    if (r.width < 2 || r.height < 2) {
      continue
    }
    const pad = item.kind === 'pill' ? 4 : 2
    const box = document.createElement('div')
    Object.assign(box.style, {
      position: 'absolute',
      left: `${Math.max(0, r.left - pad)}px`,
      top: `${Math.max(0, r.top - pad)}px`,
      width: `${r.width + pad * 2}px`,
      height: `${r.height + pad * 2}px`,
      border: `2px solid ${item.color}`,
      borderRadius: item.kind === 'pill' ? '8px' : '6px',
      background: item.kind === 'box' ? `${item.color}18` : 'transparent',
      boxSizing: 'border-box'
    })
    const badge = document.createElement('div')
    const place = item.pill ?? (item.kind === 'box' ? 'tl' : 'tr')
    Object.assign(badge.style, {
      position: 'absolute',
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      maxWidth: '220px',
      background: item.color,
      color: '#fff',
      font: '600 11px/1.2 Segoe UI, Microsoft YaHei, sans-serif',
      padding: '3px 8px 3px 4px',
      borderRadius: '10px',
      whiteSpace: 'nowrap',
      boxShadow: '0 1px 4px rgba(0,0,0,.25)'
    })
    if (place === 'tl') {
      badge.style.left = '4px'
      badge.style.top = '4px'
    } else if (place === 'tr') {
      badge.style.right = '4px'
      badge.style.top = '-14px'
    } else if (place === 'bl') {
      badge.style.left = '4px'
      badge.style.bottom = '4px'
    } else {
      badge.style.right = '4px'
      badge.style.bottom = '-14px'
    }
    const num = document.createElement('span')
    Object.assign(num.style, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '16px',
      height: '16px',
      borderRadius: '50%',
      background: 'rgba(255,255,255,.22)',
      fontSize: '10px'
    })
    num.textContent = String(item.n)
    const lab = document.createElement('span')
    lab.textContent = item.label
    badge.append(num, lab)
    box.append(badge)
    root.append(box)
  }
}

async function shot(name: WikiShotFile, callouts?: Callout[]): Promise<void> {
  dismissToasts()
  if (callouts?.length) {
    paintCallouts(callouts)
    await sleep(80)
  } else {
    clearOverlay()
  }
  await wikiApi().shot(name)
  clearOverlay()
}

function t(key: string): string {
  return String(i18n.global.t(key))
}

function qn(name: string): string {
  const spec = useWorkflowStore().types.find((item) => item.name === name)
  if (!spec) {
    throw new Error(`node type not listed: ${name}`)
  }
  return spec.qualifiedName
}

function clickFileMenu(): void {
  const el = document.querySelector('.ml-ribbon-tab--file') as HTMLElement | null
  if (!el) {
    console.warn('[wiki-capture] file menu trigger not found')
    return
  }
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
}

async function runSequence(opts: WikiRunOpts): Promise<void> {
  const ui = useAppUiStore()
  const data = useDataStore()
  const workflow = useWorkflowStore()
  const chart = useChartStore()
  const log = useLogStore()

  await waitFor(() => ui.engineReady, 20000, 'engine ready')
  await waitFor(() => workflow.types.length > 0, 10000, 'node types')
  await sleep(400)
  dismissToasts()
  ribbonActiveTab.value = 'home'
  workflow.centerTab = 'table'
  workflow.leftTab = 'datasets'
  await nextTick()
  await sleep(200)

  await shot('interface-raw.png')

  const docks = classifyStacks()
  await shot('interface-overview.png', [
    { n: 1, label: '功能区', color: BLUE, rect: mustRect(findEl('.ml-ribbon'), 'ribbon'), kind: 'box', pill: 'tl' },
    { n: 2, label: '数据集 / 节点', color: GREEN, rect: docks.left.getBoundingClientRect(), kind: 'box', pill: 'bl' },
    { n: 3, label: '工作区', color: RED, rect: docks.center.getBoundingClientRect(), kind: 'box', pill: 'bl' },
    { n: 4, label: '属性', color: GOLD, rect: docks.right.getBoundingClientRect(), kind: 'box', pill: 'tr' },
    { n: 5, label: '日志', color: '#334155', rect: docks.bottom.getBoundingClientRect(), kind: 'box', pill: 'tl' }
  ])

  await shot('01-ready.png', [
    {
      n: 1,
      label: '主页标签',
      color: BLUE,
      rect: mustRect(ribbonTab(t('ribbon.home')), 'home tab'),
      kind: 'pill',
      pill: 'br'
    },
    {
      n: 2,
      label: '状态栏：就绪',
      color: GREEN,
      rect: mustRect(findEl('.status-bar'), 'status'),
      kind: 'box',
      pill: 'tl'
    },
    {
      n: 3,
      label: '日志：计算引擎已就绪',
      color: GOLD,
      rect: docks.bottom.getBoundingClientRect(),
      kind: 'box',
      pill: 'tl'
    }
  ])

  ribbonActiveTab.value = 'data'
  await nextTick()
  await sleep(200)
  await shot('03-data-tab.png', [
    {
      n: 1,
      label: '数据标签',
      color: BLUE,
      rect: mustRect(ribbonTab(t('ribbon.data')), 'data tab'),
      kind: 'pill',
      pill: 'br'
    },
    {
      n: 2,
      label: '添加数据',
      color: RED,
      rect: mustRect(ribbonButton(t('ribbon.dataImport')), 'import'),
      kind: 'pill',
      pill: 'tr'
    },
    {
      n: 3,
      label: '移除 / 重命名 / 导出',
      color: GOLD,
      rect: unionRect([
        ribbonButton(t('ribbon.dataRemove')),
        ribbonButton(t('ribbon.dataRename')),
        ribbonButton(t('ribbon.dataExport'))
      ]),
      kind: 'box',
      pill: 'tr'
    }
  ])

  const imported = await data.importFromPath(opts.csvPath)
  log.append(
    'info',
    String(
      i18n.global.t('log.importOk', {
        name: imported.name,
        rows: imported.rows,
        cols: imported.cols
      })
    )
  )
  workflow.showDock('table')
  ribbonActiveTab.value = 'data'
  await nextTick()
  await sleep(500)
  dismissToasts()
  await shot('03-table.png', [
    {
      n: 1,
      label: '数据集列表',
      color: GREEN,
      rect: classifyStacks().left.getBoundingClientRect(),
      kind: 'box',
      pill: 'tl'
    },
    {
      n: 2,
      label: '表格',
      color: RED,
      rect: mustRect(dockTab(t('layout.table')), 'table tab'),
      kind: 'pill',
      pill: 'br'
    },
    {
      n: 3,
      label: '属性：行列与类型',
      color: GOLD,
      rect: classifyStacks().right.getBoundingClientRect(),
      kind: 'box',
      pill: 'tr'
    }
  ])

  workflow.showDock('table')
  ribbonActiveTab.value = 'operate'
  await nextTick()
  await sleep(250)
  await shot('04-operate-tab.png', [
    {
      n: 1,
      label: '操作标签',
      color: BLUE,
      rect: mustRect(ribbonTab(t('ribbon.operate')), 'operate'),
      kind: 'pill',
      pill: 'br'
    },
    {
      n: 2,
      label: '清洗',
      color: GREEN,
      rect: unionRect([
        ribbonButton(t('ribbon.dataDropNa')),
        ribbonButton(t('ribbon.dataTransformSkewed'))
      ]),
      kind: 'box',
      pill: 'tl'
    },
    {
      n: 3,
      label: '过滤',
      color: RED,
      rect: unionRect([
        ribbonButton(t('ribbon.dataEval')),
        ribbonButton(t('ribbon.dataSort'))
      ]),
      kind: 'box',
      pill: 'tr'
    },
    {
      n: 4,
      label: '统计',
      color: GOLD,
      rect: unionRect([
        ribbonButton(t('ribbon.dataDescribe')),
        ribbonButton(t('ribbon.dataPivotTable'))
      ]),
      kind: 'box',
      pill: 'tr'
    }
  ])

  data.dropNaDialogOpen = true
  await waitFor(() => Boolean(document.querySelector('.el-dialog')), 3000, 'dropna dialog')
  await sleep(200)
  const dropDialog = findEl('.el-dialog', t('ribbon.dataDropNa')) ?? findEl('.el-dialog')
  const applyBtn = findEl('.el-dialog .el-button--primary')
  await shot('04-dropna-dialog.png', [
    {
      n: 1,
      label: '删除缺失值对话框',
      color: RED,
      rect: mustRect(dropDialog, 'dropna dialog'),
      kind: 'box',
      pill: 'tl'
    },
    {
      n: 2,
      label: '点应用才会改表',
      color: BLUE,
      rect: mustRect(applyBtn, 'apply'),
      kind: 'pill',
      pill: 'br'
    }
  ])
  data.dropNaDialogOpen = false
  await sleep(200)

  wikiPrefill.queryExpression = "city == 'Beijing'"
  data.queryDialogOpen = true
  await waitFor(() => Boolean(document.querySelector('.el-dialog textarea')), 3000, 'query dialog')
  await sleep(200)
  const queryDialog = findEl('.el-dialog', t('ribbon.dataQuery')) ?? findEl('.el-dialog')
  await shot('04-query-dialog.png', [
    {
      n: 1,
      label: "写入 city == 'Beijing' 后点应用",
      color: RED,
      rect: mustRect(queryDialog, 'query dialog'),
      kind: 'box',
      pill: 'tl'
    }
  ])
  data.queryDialogOpen = false
  await sleep(200)

  workflow.leftTab = 'nodes'
  workflow.showDock('workflow')
  ribbonActiveTab.value = 'workflow'
  await nextTick()
  await sleep(400)
  await shot('05-nodes.png', [
    {
      n: 1,
      label: '切到「节点」',
      color: GREEN,
      rect: mustRect(dockTab(t('layout.nodes')), 'nodes tab'),
      kind: 'pill',
      pill: 'tr'
    },
    {
      n: 2,
      label: '切到「工作流」',
      color: RED,
      rect: mustRect(dockTab(t('layout.workflow')), 'workflow tab'),
      kind: 'pill',
      pill: 'br'
    },
    {
      n: 3,
      label: '点名称即可放入画布',
      color: BLUE,
      rect: mustRect(findEl('.node-btn', 'Data Source') ?? findEl('.toolbox'), 'toolbox'),
      kind: 'pill',
      pill: 'tr'
    }
  ])

  const sourceId = await workflow.addNode(qn('Data Source'), { x: 40, y: 120 })
  const queryId = await workflow.addNode(qn('Query'), { x: 260, y: 120 })
  const sinkId = await workflow.addNode(qn('Output to DataManager'), { x: 480, y: 120 })
  await workflow.connectPorts({
    source: sourceId,
    target: queryId,
    sourceHandle: null,
    targetHandle: null
  })
  await workflow.connectPorts({
    source: queryId,
    target: sinkId,
    sourceHandle: null,
    targetHandle: null
  })
  await workflow.setParam(sourceId, 'dataset_name', imported.name)
  await workflow.setParam(queryId, 'query_string', 'age > 25')
  await workflow.setParam(sinkId, 'data_name', 'adults')
  workflow.selectedNodeId = sourceId
  workflow.nodes = workflow.nodes.map((node) => ({ ...node, selected: node.id === sourceId }))
  workflow.leftTab = 'nodes'
  workflow.showDock('workflow')
  ribbonActiveTab.value = 'workflow'
  await nextTick()
  await sleep(200)
  workflowCanvasView()?.fitView()
  await sleep(400)
  await shot('05-workflow.png', [
    {
      n: 1,
      label: '节点列表',
      color: GREEN,
      rect: mustRect(dockTab(t('layout.nodes')), 'nodes'),
      kind: 'pill',
      pill: 'tr'
    },
    {
      n: 2,
      label: '工作流画布',
      color: RED,
      rect: mustRect(dockTab(t('layout.workflow')), 'canvas tab'),
      kind: 'pill',
      pill: 'br'
    }
  ])

  workflow.leftTab = 'datasets'
  workflow.showDock('table')
  await nextTick()
  ribbonActiveTab.value = 'figure'
  await nextTick()
  await sleep(200)
  chart.openBindDialog('line')
  await waitFor(() => Boolean(document.querySelector('.el-dialog')), 3000, 'bind dialog')
  await sleep(250)
  const bindDialog = findEl('.el-dialog')
  await shot('06-bind-dialog.png', [
    {
      n: 1,
      label: '选 X / Y 列后点绘图',
      color: RED,
      rect: mustRect(bindDialog, 'bind'),
      kind: 'box',
      pill: 'tl'
    }
  ])
  chart.bindDialogOpen = false
  await sleep(200)

  await chart.createFromBind({
    type: 'line',
    dataId: imported.id,
    x: 'age',
    y: ['score'],
    title: '分数随年龄'
  })
  if (chart.currentId) {
    chart.updateStyle(chart.currentId, { title: '分数随年龄' })
  }
  workflow.leftTab = 'datasets'
  workflow.showDock('figure')
  ribbonActiveTab.value = 'figure'
  await nextTick()
  await sleep(900)
  dismissToasts()
  await shot('06-chart-tab.png', [
    {
      n: 1,
      label: '绘图标签',
      color: BLUE,
      rect: mustRect(ribbonTab(t('ribbon.figure')), 'figure tab'),
      kind: 'pill',
      pill: 'br'
    },
    {
      n: 2,
      label: '折线 / 散点 / 柱状 / 直方 / 箱线 / 子图',
      color: RED,
      rect: unionRect([
        ribbonButton(t('ribbon.chartLine')),
        ribbonButton(t('ribbon.chartScatter')),
        ribbonButton(t('ribbon.chartBar')),
        ribbonButton(t('ribbon.chartHist')),
        ribbonButton(t('ribbon.chartBox')),
        ribbonButton(t('ribbon.chartSubplots'))
      ]),
      kind: 'box',
      pill: 'bl'
    },
    {
      n: 3,
      label: '图表：标注 / 导出',
      color: GOLD,
      rect: mustRect(ribbonTab(t('ribbon.chart')), 'chart operate'),
      kind: 'pill',
      pill: 'br'
    }
  ])

  ribbonActiveTab.value = 'chartOperate'
  await nextTick()
  await sleep(250)
  await shot('06-chart.png', [
    {
      n: 1,
      label: '绘图页',
      color: RED,
      rect: mustRect(dockTab(t('layout.figure')), 'figure dock'),
      kind: 'pill',
      pill: 'br'
    },
    {
      n: 2,
      label: '改标题 / 颜色',
      color: GOLD,
      rect: classifyStacks().right.getBoundingClientRect(),
      kind: 'box',
      pill: 'tr'
    }
  ])

  ribbonActiveTab.value = 'home'
  await nextTick()
  await sleep(150)
  clickFileMenu()
  try {
    await waitFor(
      () => Boolean(document.querySelector('.ml-ribbon-file-menu-dropdown, .el-dropdown-menu')),
      3000,
      'file menu'
    )
  } catch {
    console.warn('[wiki-capture] file menu did not open')
  }
  await sleep(200)
  const fileTrigger = document.querySelector('.ml-ribbon-tab--file') as HTMLElement | null
  const menu = findEl('.ml-ribbon-file-menu-dropdown') ?? findEl('.el-dropdown-menu')
  await shot('07-file-menu.png', [
    {
      n: 1,
      label: '文件菜单',
      color: BLUE,
      rect: mustRect(fileTrigger, 'file'),
      kind: 'pill',
      pill: 'br'
    },
    {
      n: 2,
      label: '新建 / 打开 / 保存 / 另存为',
      color: GREEN,
      rect: mustRect(menu, 'dropdown'),
      kind: 'box',
      pill: 'br'
    }
  ])
}

export function listenForWikiCapture(): void {
  const wiki = window.dw?.wiki
  if (!wiki) {
    return
  }
  wiki.onRun((opts) => {
    void runSequence(opts)
      .then(() => wiki.done())
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.stack ?? err.message : String(err)
        console.error('[wiki-capture]', message)
        return wiki.fail(message)
      })
  })
}
