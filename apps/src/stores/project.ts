import { defineStore } from 'pinia'
import { DEFAULT_PROJECT_SPLITS, type ProjectSplits } from '@dw/rpc-types'

export { DEFAULT_PROJECT_SPLITS }

export const useProjectStore = defineStore('project', {
  state: () => ({
    path: null as string | null,
    dirty: false,
    restoring: false,
    splits: { ...DEFAULT_PROJECT_SPLITS } as ProjectSplits
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
    reset(path: string | null = null): void {
      this.path = path
      this.dirty = false
      this.restoring = false
      this.splits = { ...DEFAULT_PROJECT_SPLITS }
    }
  }
})

export function touchProject(): void {
  useProjectStore().touch()
}
