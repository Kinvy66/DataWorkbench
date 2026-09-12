import { defineStore } from 'pinia'

export const useAppUiStore = defineStore('appUi', {
  state: () => ({
    settingsOpen: false,
    aboutOpen: false,
    helpOpen: false
  }),
  actions: {
    openSettings(): void {
      this.settingsOpen = true
    },
    openAbout(): void {
      this.aboutOpen = true
    },
    openHelp(): void {
      this.helpOpen = true
    }
  }
})
