import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  APP_VERSION,
  DEFAULT_PROJECT_SPLITS,
  PROJECT_EXT,
  PROJECT_FORMAT,
  PROJECT_MAGIC,
  type ProjectChartsFile,
  type ProjectOpenResult,
  type ProjectSplits,
  type ProjectUiLayout,
  type ProjectUnpackLogicResult
} from '@dw/rpc-types'
import { ProjectFileError, atomicReplaceFile, unzipToDirectory, zipDirectory } from './project-zip'

export { ProjectFileError }

export { DEFAULT_PROJECT_SPLITS }

export function withProjectExtension(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === `.${PROJECT_EXT}`) {
    return filePath
  }
  if (!ext) {
    return `${filePath}.${PROJECT_EXT}`
  }
  return `${filePath.slice(0, -ext.length)}.${PROJECT_EXT}`
}

export function validateManifest(raw: unknown): void {
  if (!raw || typeof raw !== 'object') {
    throw new ProjectFileError('manifest.json is invalid', 'project.invalid')
  }
  const manifest = raw as { magic?: unknown; format?: unknown }
  if (manifest.magic !== PROJECT_MAGIC) {
    throw new ProjectFileError('This file is not a DataWorkbench project', 'project.invalid')
  }
  if (manifest.format !== PROJECT_FORMAT) {
    throw new ProjectFileError(
      'This project file needs a newer DataWorkbench',
      'project.unsupportedFormat'
    )
  }
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function normalizeUiLayout(raw: unknown): ProjectUiLayout {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const splitsRaw = src.splits && typeof src.splits === 'object' ? (src.splits as Record<string, unknown>) : {}
  const nodesRaw = src.nodes && typeof src.nodes === 'object' ? (src.nodes as Record<string, unknown>) : {}
  const nodes: ProjectUiLayout['nodes'] = {}
  for (const [id, pos] of Object.entries(nodesRaw)) {
    if (!pos || typeof pos !== 'object') {
      continue
    }
    const point = pos as { x?: unknown; y?: unknown }
    nodes[id] = { x: asNumber(point.x, 80), y: asNumber(point.y, 80) }
  }
  const centerTab = src.centerTab
  const leftTab = src.leftTab
  return {
    centerTab: centerTab === 'workflow' || centerTab === 'figure' ? centerTab : 'table',
    leftTab: leftTab === 'nodes' ? 'nodes' : 'datasets',
    currentDataId: typeof src.currentDataId === 'string' ? src.currentDataId : null,
    splits: {
      main: asNumber(splitsRaw.main, DEFAULT_PROJECT_SPLITS.main),
      left: asNumber(splitsRaw.left, DEFAULT_PROJECT_SPLITS.left),
      center: asNumber(splitsRaw.center, DEFAULT_PROJECT_SPLITS.center),
      properties: asNumber(splitsRaw.properties, DEFAULT_PROJECT_SPLITS.properties),
      log: asNumber(splitsRaw.log, DEFAULT_PROJECT_SPLITS.log)
    },
    nodes
  }
}

export function normalizeCharts(raw: unknown): ProjectChartsFile {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const charts = Array.isArray(src.charts) ? src.charts : []
  return {
    currentId: typeof src.currentId === 'string' ? src.currentId : null,
    charts: charts.filter((item) => item && typeof item === 'object') as ProjectChartsFile['charts']
  }
}

function readJson(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    throw new ProjectFileError(`Failed to parse ${path.basename(filePath)}`, 'project.invalid', 3001)
  }
}

export async function saveProjectArchive(options: {
  dest: string
  workflowLogic: unknown
  uiLayout: ProjectUiLayout
  charts: ProjectChartsFile
  packLogic: (dir: string) => Promise<void>
}): Promise<void> {
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-proj-save-'))
  try {
    fs.writeFileSync(
      path.join(staging, 'manifest.json'),
      JSON.stringify(
        { magic: PROJECT_MAGIC, format: PROJECT_FORMAT, appVersion: APP_VERSION },
        null,
        2
      ) + '\n'
    )
    fs.writeFileSync(path.join(staging, 'workflow-logic.json'), JSON.stringify(options.workflowLogic, null, 2) + '\n')
    fs.writeFileSync(path.join(staging, 'ui-layout.json'), JSON.stringify(options.uiLayout, null, 2) + '\n')
    fs.writeFileSync(path.join(staging, 'charts.json'), JSON.stringify(options.charts, null, 2) + '\n')
    await options.packLogic(staging)
    atomicReplaceFile(options.dest, zipDirectory(staging))
  } finally {
    fs.rmSync(staging, { recursive: true, force: true })
  }
}

export async function openProjectArchive(options: {
  src: string
  unpackLogic: (dir: string) => Promise<ProjectUnpackLogicResult>
}): Promise<Required<Pick<ProjectOpenResult, 'workflowId' | 'uiLayout' | 'charts'>> & ProjectUnpackLogicResult> {
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-proj-open-'))
  try {
    unzipToDirectory(new Uint8Array(fs.readFileSync(options.src)), staging)
    const manifestPath = path.join(staging, 'manifest.json')
    if (!fs.existsSync(manifestPath)) {
      throw new ProjectFileError('manifest.json is missing', 'project.invalid')
    }
    validateManifest(readJson(manifestPath))
    const uiPath = path.join(staging, 'ui-layout.json')
    const chartsPath = path.join(staging, 'charts.json')
    const logicPath = path.join(staging, 'workflow-logic.json')
    if (fs.existsSync(logicPath)) {
      readJson(logicPath)
    }
    const uiLayout = normalizeUiLayout(fs.existsSync(uiPath) ? readJson(uiPath) : {})
    const charts = normalizeCharts(fs.existsSync(chartsPath) ? readJson(chartsPath) : {})
    const unpacked = await options.unpackLogic(staging)
    return { ...unpacked, uiLayout, charts }
  } finally {
    fs.rmSync(staging, { recursive: true, force: true })
  }
}
