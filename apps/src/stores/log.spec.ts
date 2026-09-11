import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useLogStore } from './log'

describe('useLogStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('keeps the newest 500 lines', () => {
    const log = useLogStore()
    log.append('info', 'first')
    for (let i = 0; i < 500; i += 1) {
      log.append('info', `n${i}`)
    }
    expect(log.lines).toHaveLength(500)
    expect(log.lines[0]?.message).toBe('n0')
    expect(log.lines[499]?.message).toBe('n499')
  })
})
