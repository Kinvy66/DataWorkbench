import fs from 'node:fs'
import path from 'node:path'

export const QA_LAB_ENV = 'DW_QA_LAB'

export function qaLabFlagPathCandidates(): string[] {
  return [
    path.join(process.resourcesPath || '', 'qa-lab.flag'),
    path.join(process.cwd(), 'resources', 'qa-lab.flag'),
    path.join(process.cwd(), 'apps', 'resources', 'qa-lab.flag'),
    path.join(__dirname, '../../resources/qa-lab.flag')
  ]
}

export function qaLabFlagExists(exists: (p: string) => boolean = fs.existsSync): boolean {
  return qaLabFlagPathCandidates().some((candidate) => Boolean(candidate) && exists(candidate))
}

export function applyQaLabEnv(options?: { skip?: boolean }): boolean {
  if (options?.skip) {
    return false
  }
  if (process.env.DW_WIKI_CAPTURE?.trim()) {
    return false
  }
  if (!qaLabFlagExists()) {
    return false
  }
  process.env[QA_LAB_ENV] = '1'
  return true
}

export function qaLabEnabled(): boolean {
  return process.env[QA_LAB_ENV] === '1'
}
