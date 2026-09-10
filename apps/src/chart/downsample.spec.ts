import { describe, expect, it } from 'vitest'
import { lttbIndices } from '@dw/chart-core'

describe('chart-core lttbIndices (test contrast only)', () => {
  it('keeps endpoints and respects the output cap', () => {
    const x = Array.from({ length: 200 }, (_, i) => i)
    const y = x.map((v) => Math.sin(v / 10))
    const idx = lttbIndices(x, y, 40)
    expect(idx[0]).toBe(0)
    expect(idx[idx.length - 1]).toBe(199)
    expect(idx).toHaveLength(40)
  })
})
