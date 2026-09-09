import { describe, expect, it } from 'vitest'
import { BLOCK_SIZE, blockOrigin, blocksForWindow } from './blockWindow'

describe('blockWindow', () => {
  it('aligns rows to 512-row origins', () => {
    expect(blockOrigin(0)).toBe(0)
    expect(blockOrigin(511)).toBe(0)
    expect(blockOrigin(512)).toBe(512)
    expect(blockOrigin(999)).toBe(512)
    expect(BLOCK_SIZE).toBe(512)
  })

  it('keeps the current block and prefetch neighbors', () => {
    expect(blocksForWindow(100, 130, 1000)).toEqual([0, 512])
    expect(blocksForWindow(512, 520, 1000)).toEqual([0, 512])
    expect(blocksForWindow(0, 10, 100)).toEqual([0])
  })
})
