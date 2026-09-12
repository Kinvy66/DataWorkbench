import { defineStore } from 'pinia'

export type EngineStatus = 'starting' | 'ready' | 'restarting' | 'stopped' | 'failed'

export const useAppUiStore = defineStore('appUi', {
  state: () => ({
    settingsOpen: false,
    aboutOpen: false,
    helpOpen: false,
    engineStatus: 'starting' as EngineStatus
  }),
  getters: {
    engineReady: (state): boolean => state.engineStatus === 'ready'
  },
  actions: {
    openSettings(): void {
      this.settingsOpen = true
    },
    openAbout(): void {
      this.aboutOpen = true
    },
    openHelp(): void {
      this.helpOpen = true
    },
    setEngineStatus(status: EngineStatus): void {
      this.engineStatus = status
    }
  }
})
