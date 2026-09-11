import { describe, expect, it } from 'vitest'
import {
  BLOCK_SIZE,
  blockOrigin,
  blockOriginsInRange,
  blocksForWindow,
  retainCachedBlocks
} from './blockWindow'

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

  it('never prefetches more than three 512-row windows even on a 500k-row table', () => {
    expect(blocksForWindow(250_000, 250_040, 500_000)).toEqual([249344, 249856, 250368])
  })

  it('drops cached blocks that are outside the prefetch window', () => {
    const cache = { 0: [['a']], 512: [['b']], 1024: [['c']], 1536: [['d']] }
    expect(retainCachedBlocks(cache, [512, 1024])).toEqual({ 512: [['b']], 1024: [['c']] })
  })

  it('lists 512-row origins for a requested range without prefetch neighbors', () => {
    expect(blockOriginsInRange(0, 512, 2000)).toEqual([0])
    expect(blockOriginsInRange(500, 600, 1000)).toEqual([0, 512])
    expect(blockOriginsInRange(0, 512, 0)).toEqual([])
  })
})
