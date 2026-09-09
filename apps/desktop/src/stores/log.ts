import { defineStore } from 'pinia'

export type LogLevel = 'info' | 'warning' | 'error'

export interface LogLine {
  id: number
  at: number
  level: LogLevel
  message: string
}

export const useLogStore = defineStore('log', {
  state: () => ({
    seq: 0,
    lines: [] as LogLine[]
  }),
  actions: {
    append(level: LogLevel, message: string): void {
      this.seq += 1
      this.lines.push({ id: this.seq, at: Date.now(), level, message })
      if (this.lines.length > 500) {
        this.lines.splice(0, this.lines.length - 500)
      }
    }
  }
})
