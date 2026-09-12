import { describe, expect, it } from 'vitest'
import { parseClipboardWriteParams } from './clipboard-params'

describe('parseClipboardWriteParams', () => {
  it('accepts text or a png data URL', () => {
    expect(parseClipboardWriteParams({ text: 'a\tb\n' })).toEqual({ text: 'a\tb\n', pngDataUrl: undefined })
    expect(parseClipboardWriteParams({ pngDataUrl: 'data:image/png;base64,xx' }).pngDataUrl).toContain(
      'image/png'
    )
  })

  it('rejects an empty payload', () => {
    expect(() => parseClipboardWriteParams({})).toThrow(/Clipboard write/)
  })
})
