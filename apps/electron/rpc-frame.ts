import { ARROW_ENCODING, type DataFetchBlockArrowHeader } from '@dw/rpc-types'
import { parseRpcLine } from './rpc-parse'

export type StdoutFrame =
  | { kind: 'line'; line: string }
  | {
      kind: 'arrow'
      id: string | number
      startRow: number
      rowCount: number
      payload: Buffer
    }

export function isArrowFetchHeader(result: unknown): result is DataFetchBlockArrowHeader {
  if (typeof result !== 'object' || result === null) {
    return false
  }
  const obj = result as Record<string, unknown>
  if (obj.encoding !== ARROW_ENCODING || typeof obj.bytes !== 'number' || !Number.isFinite(obj.bytes) || obj.bytes < 0) {
    return false
  }
  const meta = obj.meta
  if (typeof meta !== 'object' || meta === null) {
    return false
  }
  const fields = meta as Record<string, unknown>
  return typeof fields.startRow === 'number' && typeof fields.rows === 'number'
}

export class StdoutFramer {
  private buf = Buffer.alloc(0)
  private pending: { id: string | number; startRow: number; rowCount: number; bytes: number } | null = null

  push(chunk: Buffer): StdoutFrame[] {
    this.buf = this.buf.length === 0 ? Buffer.from(chunk) : Buffer.concat([this.buf, chunk])
    const frames: StdoutFrame[] = []
    while (true) {
      if (this.pending) {
        if (this.buf.length < this.pending.bytes) {
          break
        }
        const payload = Buffer.from(this.buf.subarray(0, this.pending.bytes))
        this.buf = this.buf.subarray(this.pending.bytes)
        const { id, startRow, rowCount } = this.pending
        this.pending = null
        frames.push({ kind: 'arrow', id, startRow, rowCount, payload })
        continue
      }
      const nl = this.buf.indexOf(0x0a)
      if (nl < 0) {
        break
      }
      let lineBuf = this.buf.subarray(0, nl)
      this.buf = this.buf.subarray(nl + 1)
      if (lineBuf.length > 0 && lineBuf[lineBuf.length - 1] === 0x0d) {
        lineBuf = lineBuf.subarray(0, lineBuf.length - 1)
      }
      const line = lineBuf.toString('utf8')
      const parsed = parseRpcLine(line)
      if (parsed.kind === 'response' && isArrowFetchHeader(parsed.result)) {
        this.pending = {
          id: parsed.id,
          startRow: parsed.result.meta.startRow,
          rowCount: parsed.result.meta.rows,
          bytes: parsed.result.bytes
        }
        continue
      }
      frames.push({ kind: 'line', line })
    }
    return frames
  }
}
