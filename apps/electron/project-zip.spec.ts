import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { projectOpenDialogOptions, projectSaveDialogOptions } from './dialogs'
import {
  atomicReplaceFile,
  ProjectFileError,
  replaceWithTemp,
  unzipToDirectory,
  writeFileTemp,
  zipDirectory
} from './project-zip'

describe('project zip helpers', () => {
  it('round-trips a directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dw-zip-'))
    try {
      writeFileSync(join(dir, 'manifest.json'), '{"magic":"DataWorkbenchProject"}')
      const zipped = zipDirectory(dir)
      const out = mkdtempSync(join(tmpdir(), 'dw-unzip-'))
      try {
        unzipToDirectory(zipped, out)
        expect(readFileSync(join(out, 'manifest.json'), 'utf8')).toContain('DataWorkbenchProject')
      } finally {
        rmSync(out, { recursive: true, force: true })
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('rejects zip-slip paths', () => {
    const dest = mkdtempSync(join(tmpdir(), 'dw-slip-'))
    try {
      const evil = zipSync({ '../evil.txt': strToU8('nope') })
      expect(() => unzipToDirectory(evil, dest)).toThrow(ProjectFileError)
    } finally {
      rmSync(dest, { recursive: true, force: true })
    }
  })

  it('keeps the original file until rename when only the temp is written', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dw-atomic-'))
    try {
      const dest = join(dir, 'project.dwproj')
      writeFileSync(dest, 'original')
      const tmp = writeFileTemp(dest, Buffer.from('next'))
      expect(readFileSync(dest, 'utf8')).toBe('original')
      expect(readFileSync(tmp, 'utf8')).toBe('next')
      replaceWithTemp(dest, tmp)
      expect(readFileSync(dest, 'utf8')).toBe('next')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('atomic replace overwrites the destination', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dw-atomic2-'))
    try {
      const dest = join(dir, 'project.dwproj')
      writeFileSync(dest, 'old')
      atomicReplaceFile(dest, Buffer.from('new'))
      expect(readFileSync(dest, 'utf8')).toBe('new')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('offers dwproj dialog filters', () => {
    expect(projectOpenDialogOptions().filters?.[0].extensions).toEqual(['dwproj'])
    expect(projectSaveDialogOptions('Untitled.dwproj').defaultPath).toBe('Untitled.dwproj')
  })
})
