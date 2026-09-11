import { defineStore } from 'pinia'
import { DEFAULT_PROJECT_SPLITS, type ProjectSplits } from '@dw/rpc-types'

export { DEFAULT_PROJECT_SPLITS }

export const useProjectStore = defineStore('project', {
  state: () => ({
    path: null as string | null,
    dirty: false,
    restoring: false,
    splits: { ...DEFAULT_PROJECT_SPLITS } as ProjectSplits,
    docking: null as Record<string, unknown> | null,
    dockingEpoch: 0
  }),
  getters: {
    displayName(state): string {
      if (!state.path) {
        return ''
      }
      const parts = state.path.split(/[/\\]/)
      return parts[parts.length - 1] || state.path
    }
  },
  actions: {
    touch(): void {
      if (!this.restoring) {
        this.dirty = true
      }
    },
    markClean(path?: string | null): void {
      this.dirty = false
      if (path !== undefined) {
        this.path = path
      }
    },
    beginRestore(): void {
      this.restoring = true
    },
    endRestore(): void {
      this.restoring = false
    },
    setSplits(patch: Partial<ProjectSplits>): void {
      this.splits = { ...this.splits, ...patch }
      this.touch()
    },
    setDocking(config: Record<string, unknown> | null): void {
      this.docking = config
      this.touch()
    },
    loadDocking(config: Record<string, unknown> | null): void {
      this.docking = config
      this.dockingEpoch += 1
    },
    hydrateDocking(config: Record<string, unknown> | null): void {
      this.docking = config
    },
    resetDocking(): void {
      this.docking = null
      this.splits = { ...DEFAULT_PROJECT_SPLITS }
      this.dockingEpoch += 1
      this.touch()
    },
    reset(path: string | null = null): void {
      this.path = path
      this.dirty = false
      this.restoring = false
      this.splits = { ...DEFAULT_PROJECT_SPLITS }
      this.docking = null
      this.dockingEpoch += 1
    }
  }
})

export function touchProject(): void {
  useProjectStore().touch()
}
