import fs from 'node:fs'
import path from 'node:path'
import { unzipSync, zipSync } from 'fflate'

export class ProjectFileError extends Error {
  readonly code: number
  readonly i18nKey: string

  constructor(message: string, i18nKey: string, code = 3001) {
    super(message)
    this.name = 'ProjectFileError'
    this.i18nKey = i18nKey
    this.code = code
  }
}

export function safeJoin(root: string, rel: string): string {
  const normalized = rel.replace(/\\/g, '/')
  if (
    !normalized ||
    normalized.startsWith('/') ||
    normalized.includes('..') ||
    /^[a-zA-Z]:/.test(normalized)
  ) {
    throw new ProjectFileError(`Invalid zip path: ${rel}`, 'project.invalid')
  }
  const resolved = path.resolve(root, normalized)
  const rootResolved = path.resolve(root)
  if (resolved !== rootResolved && !resolved.startsWith(rootResolved + path.sep)) {
    throw new ProjectFileError(`Invalid zip path: ${rel}`, 'project.invalid')
  }
  return resolved
}

function walkFiles(dir: string, prefix: string, out: Record<string, Uint8Array>): void {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const rel = prefix ? `${prefix}/${name}` : name
    const stat = fs.statSync(full)
    if (stat.isDirectory()) {
      walkFiles(full, rel, out)
    } else if (stat.isFile()) {
      out[rel.replace(/\\/g, '/')] = new Uint8Array(fs.readFileSync(full))
    }
  }
}

export function zipDirectory(dir: string): Uint8Array {
  const files: Record<string, Uint8Array> = {}
  walkFiles(dir, '', files)
  return zipSync(files, { level: 6 })
}

export function unzipToDirectory(data: Uint8Array, dest: string): void {
  fs.mkdirSync(dest, { recursive: true })
  const files = unzipSync(data)
  for (const [name, bytes] of Object.entries(files)) {
    if (name.endsWith('/')) {
      continue
    }
    const target = safeJoin(dest, name)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, bytes)
  }
}

export function writeFileTemp(dest: string, contents: Uint8Array | Buffer): string {
  const tmp = `${dest}.tmp`
  fs.writeFileSync(tmp, contents)
  return tmp
}

export function replaceWithTemp(dest: string, tmp: string): void {
  if (fs.existsSync(dest)) {
    fs.unlinkSync(dest)
  }
  fs.renameSync(tmp, dest)
}

export function atomicReplaceFile(dest: string, contents: Uint8Array | Buffer): void {
  const tmp = writeFileTemp(dest, contents)
  replaceWithTemp(dest, tmp)
}
