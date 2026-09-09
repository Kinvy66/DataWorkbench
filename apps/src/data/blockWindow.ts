import { FETCH_BLOCK_DEFAULT } from '@dw/rpc-types'

export const BLOCK_SIZE = FETCH_BLOCK_DEFAULT

export function blockOrigin(rowIndex: number, blockSize = BLOCK_SIZE): number {
  return Math.floor(Math.max(0, rowIndex) / blockSize) * blockSize
}

export function retainCachedBlocks<T>(
  cache: Record<number, T>,
  origins: number[]
): Record<number, T> {
  const next: Record<number, T> = {}
  for (const origin of origins) {
    if (cache[origin] !== undefined) {
      next[origin] = cache[origin]
    }
  }
  return next
}

/** Current block plus one neighbor on each side, clipped to [0, rowCount). */
export function blocksForWindow(
  visibleStart: number,
  visibleEnd: number,
  rowCount: number,
  blockSize = BLOCK_SIZE
): number[] {
  if (rowCount <= 0) {
    return []
  }
  const firstVisible = Math.min(Math.max(0, visibleStart), rowCount - 1)
  const lastVisible = Math.min(Math.max(0, visibleEnd), rowCount - 1)
  const first = blockOrigin(Math.max(0, firstVisible - blockSize), blockSize)
  const last = blockOrigin(Math.min(rowCount - 1, lastVisible + blockSize), blockSize)
  const out: number[] = []
  for (let start = first; start <= last; start += blockSize) {
    out.push(start)
  }
  return out
}
