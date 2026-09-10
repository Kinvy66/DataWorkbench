import { ElMessage, ElMessageBox } from 'element-plus'
import type {
  ProjectChartsFile,
  ProjectChartPersist,
  ProjectOpenResult,
  ProjectSaveResult,
  ProjectUiLayout
} from '@dw/rpc-types'
import { i18n } from '@/i18n'
import { isCancelled, translateRpcError } from '@/rpc/rpcError'
import { getDesktopBridge } from '@/rpc/bridge'
import { useChartStore, type ChartSpec } from '@/stores/chart'
import { useDataStore } from '@/stores/data'
import { useLogStore } from '@/stores/log'
import { useProjectStore } from '@/stores/project'
import { useWorkflowStore } from '@/stores/workflow'

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

function rpc() {
  return getDesktopBridge().rpc
}

function persistChart(chart: ChartSpec): ProjectChartPersist {
  return {
    id: chart.id,
    type: chart.type,
    dataId: chart.dataId,
    x: chart.x,
    y: [...chart.y],
    title: chart.title,
    xLabel: chart.xLabel,
    yLabel: chart.yLabel,
    grid: chart.grid,
    legend: chart.legend,
    series: chart.series.map((item) => ({ key: item.key, color: item.color, width: item.width }))
  }
}

export function captureUiLayout(): ProjectUiLayout {
  const project = useProjectStore()
  const data = useDataStore()
  const workflow = useWorkflowStore()
  return {
    centerTab: workflow.centerTab,
    leftTab: workflow.leftTab,
    currentDataId: data.currentId,
    splits: { ...project.splits },
    nodes: workflow.captureLayout()
  }
}

export function captureCharts(): ProjectChartsFile {
  const chart = useChartStore()
  return {
    currentId: chart.currentId,
    charts: chart.charts.map(persistChart)
  }
}

export async function syncDocumentTitle(): Promise<void> {
  const project = useProjectStore()
  try {
    await rpc().invoke('app.setDocument', {
      displayName: project.displayName || t('project.untitled'),
      dirty: project.dirty
    })
  } catch {
    // Title is best-effort when the bridge is not ready.
  }
}

export async function confirmIfDirty(): Promise<boolean> {
  const project = useProjectStore()
  if (!project.dirty) {
    return true
  }
  try {
    await ElMessageBox.confirm(t('project.unsaved'), t('project.unsavedTitle'), {
      type: 'warning',
      distinguishCancelAndClose: true,
      closeOnClickModal: false,
      confirmButtonText: t('project.save'),
      cancelButtonText: t('project.discard')
    })
    return await saveProject(false)
  } catch (action) {
    return action === 'cancel'
  }
}

export async function saveProject(saveAs: boolean): Promise<boolean> {
  const project = useProjectStore()
  const workflow = useWorkflowStore()
  try {
    const workflowId = await workflow.ensureWorkflow()
    const result = (await rpc().invoke('project.save', {
      path: saveAs ? undefined : project.path ?? undefined,
      workflowId,
      uiLayout: captureUiLayout(),
      charts: captureCharts()
    })) as ProjectSaveResult
    if (isCancelled(result) || !result.path) {
      return false
    }
    project.markClean(result.path)
    await syncDocumentTitle()
    const line = t('log.projectSaved')
    useLogStore().append('info', line)
    ElMessage.success(line)
    return true
  } catch (err) {
    reportError(err)
    return false
  }
}

export async function openProject(): Promise<boolean> {
  const project = useProjectStore()
  const workflow = useWorkflowStore()
  if (workflow.running) {
    reportError(new Error('Workflow is running [@@workflow.busy]'))
    return false
  }
  if (!(await confirmIfDirty())) {
    return false
  }
  try {
    const result = (await rpc().invoke('project.open', {})) as ProjectOpenResult
    if (isCancelled(result) || !result.path || !result.workflowId || !result.uiLayout || !result.charts) {
      return false
    }
    project.beginRestore()
    try {
      project.splits = { ...result.uiLayout.splits }
      await useDataStore().refreshList()
      const dataId =
        result.uiLayout.currentDataId &&
        useDataStore().datasets.some((item) => item.id === result.uiLayout!.currentDataId)
          ? result.uiLayout.currentDataId
          : (useDataStore().datasets[0]?.id ?? null)
      await useDataStore().select(dataId)
      await workflow.adoptWorkflow(result.workflowId, result.uiLayout.nodes)
      workflow.centerTab = result.uiLayout.centerTab
      workflow.leftTab = result.uiLayout.leftTab
      await useChartStore().restoreFromFile(result.charts)
      project.markClean(result.path)
    } finally {
      project.endRestore()
    }
    await syncDocumentTitle()
    const line = t('log.projectOpened')
    useLogStore().append('info', line)
    ElMessage.success(line)
    return true
  } catch (err) {
    useProjectStore().endRestore()
    reportError(err)
    return false
  }
}

export async function newProject(): Promise<boolean> {
  const workflow = useWorkflowStore()
  if (workflow.running) {
    reportError(new Error('Workflow is running [@@workflow.busy]'))
    return false
  }
  if (!(await confirmIfDirty())) {
    return false
  }
  const project = useProjectStore()
  project.beginRestore()
  try {
    await rpc().invoke('project.clearLogic', {})
    workflow.resetSession()
    useChartStore().clear()
    const data = useDataStore()
    data.datasets = []
    await data.select(null)
    await workflow.bootstrap()
    project.reset(null)
  } catch (err) {
    project.endRestore()
    reportError(err)
    return false
  }
  project.endRestore()
  await syncDocumentTitle()
  const line = t('log.projectNew')
  useLogStore().append('info', line)
  ElMessage.success(line)
  return true
}

export async function confirmAndQuit(): Promise<void> {
  if (!(await confirmIfDirty())) {
    return
  }
  await rpc().invoke('app.quit')
}
