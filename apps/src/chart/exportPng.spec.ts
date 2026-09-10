import { describe, expect, it } from 'vitest'
import { decodePngDataUrl } from '@dw/chart-core'

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

describe('decodePngDataUrl', () => {
  it('decodes a png data URL to PNG bytes', () => {
    const bytes = decodePngDataUrl(TINY_PNG)
    expect(Array.from(bytes.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  })

  it('rejects a non-png payload', () => {
    expect(() => decodePngDataUrl('data:image/svg+xml,abc')).toThrow(/png data URL/)
  })
})
