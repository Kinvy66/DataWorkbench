import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AppFileLog, sanitizeLogLine } from './app-log'

describe('AppFileLog', () => {
  it('writes main and sidecar files under userData/logs', () => {
    const root = mkdtempSync(join(tmpdir(), 'dw-log-'))
    try {
      const log = new AppFileLog({
        userDataDir: root,
        now: () => new Date('2026-09-11T00:00:00.000Z')
      })
      log.write('main', 'spawn sidecar')
      log.write('sidecar', 'host.ready pid=1')
      expect(readFileSync(join(root, 'logs', 'main.log'), 'utf8')).toContain(
        '2026-09-11T00:00:00.000Z [main] spawn sidecar'
      )
      expect(readFileSync(join(root, 'logs', 'sidecar.log'), 'utf8')).toContain('[sidecar] host.ready pid=1')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rotates when the file exceeds maxBytes', () => {
    const root = mkdtempSync(join(tmpdir(), 'dw-log-rot-'))
    try {
      const log = new AppFileLog({ userDataDir: root, maxBytes: 40, now: () => new Date('2026-09-11T00:00:00.000Z') })
      const file = join(root, 'logs', 'main.log')
      mkdirSync(join(root, 'logs'), { recursive: true })
      writeFileSync(file, 'x'.repeat(80), 'utf8')
      log.write('main', 'after-rotate')
      expect(readFileSync(join(root, 'logs', 'main.log.1'), 'utf8').length).toBe(80)
      expect(readFileSync(file, 'utf8')).toContain('after-rotate')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('flattens newlines so one event stays one line', () => {
    expect(sanitizeLogLine('a\r\nb\nc')).toBe('a b c')
  })
})
