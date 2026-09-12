import { describe, expect, it } from 'vitest'
import { applyQaLabEnv, QA_LAB_ENV, qaLabFlagExists } from './qa-lab'

describe('QA lab flag', () => {
  it('detects a present flag file', () => {
    expect(qaLabFlagExists((p) => p.replace(/\\/g, '/').endsWith('resources/qa-lab.flag'))).toBe(true)
  })

  it('does not enable during wiki screenshot capture', () => {
    const previous = process.env[QA_LAB_ENV]
    const capture = process.env.DW_WIKI_CAPTURE
    delete process.env[QA_LAB_ENV]
    process.env.DW_WIKI_CAPTURE = 'C:/tmp/shots'
    try {
      expect(applyQaLabEnv()).toBe(false)
      expect(process.env[QA_LAB_ENV]).toBeUndefined()
    } finally {
      if (previous == null) {
        delete process.env[QA_LAB_ENV]
      } else {
        process.env[QA_LAB_ENV] = previous
      }
      if (capture == null) {
        delete process.env.DW_WIKI_CAPTURE
      } else {
        process.env.DW_WIKI_CAPTURE = capture
      }
    }
  })
})
