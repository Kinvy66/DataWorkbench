import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAppUiStore } from './appUi'

describe('app UI dialogs', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('opens settings, about, and help independently', () => {
    const ui = useAppUiStore()
    ui.openSettings()
    expect(ui.settingsOpen).toBe(true)
    ui.openAbout()
    expect(ui.aboutOpen).toBe(true)
    ui.openHelp()
    expect(ui.helpOpen).toBe(true)
  })
})
