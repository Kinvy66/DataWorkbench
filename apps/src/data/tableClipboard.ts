/** Bound by VirtualTable; Ribbon commands call through here so they do not import Vue. */

export type TableClipboardHost = {
  hasRange: () => boolean
  copy: () => Promise<boolean>
  paste: () => Promise<number>
  cut: () => Promise<number>
  deleteCells: () => Promise<number>
  selectAll: () => void
}

let current: TableClipboardHost | null = null

export function bindTableClipboard(host: TableClipboardHost | null): void {
  current = host
}

export function tableClipboard(): TableClipboardHost | null {
  return current
}
