import { tableFromIPC } from 'apache-arrow'

export function arrowValueToJson(value: unknown): unknown {
  if (value == null) {
    return null
  }
  if (typeof value === 'number' && Number.isNaN(value)) {
    return null
  }
  if (typeof value === 'bigint') {
    const asNumber = Number(value)
    if (Number.isSafeInteger(asNumber)) {
      return asNumber
    }
    return value.toString()
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString()
  }
  return value
}

export function arrowIpcToRows(payload: Buffer): unknown[][] {
  if (payload.length === 0) {
    return []
  }
  const table = tableFromIPC(payload)
  const cols = table.schema.fields.map((_, index) => table.getChildAt(index))
  const rows: unknown[][] = []
  for (let r = 0; r < table.numRows; r++) {
    const row: unknown[] = []
    for (const col of cols) {
      row.push(arrowValueToJson(col?.get(r)))
    }
    rows.push(row)
  }
  return rows
}
