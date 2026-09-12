import { describe, expect, it } from 'vitest'
import { qaLabEnabled } from './qa-lab'

describe('qaLabEnabled', () => {
  it('is off in unit tests that do not set window.dw.qaLab', () => {
    expect(qaLabEnabled()).toBe(false)
  })
})
