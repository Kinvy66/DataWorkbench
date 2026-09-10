import { describe, expect, it } from 'vitest'
import { shouldRestartSidecar } from './sidecar-watchdog'

describe('shouldRestartSidecar', () => {
  it('does not restart after an intentional shutdown', () => {
    expect(
      shouldRestartSidecar({ shuttingDown: true, restartAttempts: 0, maxRestarts: 1 })
    ).toBe(false)
  })

  it('restarts once after an unexpected exit', () => {
    expect(
      shouldRestartSidecar({ shuttingDown: false, restartAttempts: 0, maxRestarts: 1 })
    ).toBe(true)
  })

  it('does not restart after the allowance is used', () => {
    expect(
      shouldRestartSidecar({ shuttingDown: false, restartAttempts: 1, maxRestarts: 1 })
    ).toBe(false)
  })
})
