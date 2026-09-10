import fs from 'node:fs'
import path from 'node:path'

export const APP_LOG_MAX_BYTES = 2 * 1024 * 1024

export type AppLogKind = 'main' | 'sidecar'

export class AppFileLog {
  readonly dir: string
  private readonly maxBytes: number
  private readonly now: () => Date

  constructor(options: { userDataDir: string; maxBytes?: number; now?: () => Date }) {
    this.dir = path.join(options.userDataDir, 'logs')
    this.maxBytes = options.maxBytes ?? APP_LOG_MAX_BYTES
    this.now = options.now ?? (() => new Date())
    fs.mkdirSync(this.dir, { recursive: true })
  }

  write(kind: AppLogKind, text: string): void {
    const file = path.join(this.dir, `${kind}.log`)
    this.rotateIfNeeded(file)
    const line = `${this.now().toISOString()} [${kind}] ${sanitizeLogLine(text)}\n`
    fs.appendFileSync(file, line, 'utf8')
  }

  private rotateIfNeeded(file: string): void {
    try {
      if (!fs.existsSync(file) || fs.statSync(file).size < this.maxBytes) {
        return
      }
    } catch {
      return
    }
    const bak = `${file}.1`
    try {
      if (fs.existsSync(bak)) {
        fs.unlinkSync(bak)
      }
      fs.renameSync(file, bak)
    } catch {
      // Keep appending if rotate fails (file locked, etc.).
    }
  }
}

export function sanitizeLogLine(text: string): string {
  return text.replace(/\r?\n/g, ' ')
}
