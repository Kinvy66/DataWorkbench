import { defineStore } from 'pinia'
import type {
  DataDropNaResult,
  DataFetchBlockResult,
  DataGetSchemaResult,
  DataImportResult,
  DataListResult,
  DataQueryResult,
  DataSortResult,
  DataFillNaResult,
  DataDescribeResult,
  DatasetListItem
} from '@dw/rpc-types'
import { BLOCK_SIZE } from '@/data/blockWindow'
import { isCancelled } from '@/rpc/rpcError'
import { getDesktopBridge } from '@/rpc/bridge'

export const useDataStore = defineStore('data', {
  state: () => ({
    datasets: [] as DatasetListItem[],
    currentId: null as string | null,
    schema: null as DataGetSchemaResult | null,
    dropNaDialogOpen: false,
    queryDialogOpen: false,
    sortDialogOpen: false,
    fillNaDialogOpen: false,
    describeDialogOpen: false
  }),
  getters: {
    current(state): DatasetListItem | null {
      return state.datasets.find((item) => item.id === state.currentId) ?? null
    },
    hasSelection(state): boolean {
      return state.currentId != null
    }
  },
  actions: {
    async refreshList(): Promise<void> {
      const result = (await getDesktopBridge().rpc.invoke('data.list', {})) as DataListResult
      this.datasets = result.datasets
      if (this.currentId && !this.datasets.some((item) => item.id === this.currentId)) {
        this.currentId = null
        this.schema = null
      }
    },
    async select(id: string | null): Promise<void> {
      this.currentId = id
      if (!id) {
        this.schema = null
        return
      }
      this.schema = (await getDesktopBridge().rpc.invoke('data.getSchema', { id })) as DataGetSchemaResult
    },
    async importInteractive(): Promise<DataImportResult | null> {
      const result = await getDesktopBridge().rpc.invoke('data.import', {})
      if (isCancelled(result)) {
        return null
      }
      const imported = result as DataImportResult
      await this.refreshList()
      await this.select(imported.id)
      return imported
    },
    async exportCurrent(): Promise<boolean> {
      if (!this.currentId || !this.current) {
        return false
      }
      const result = await getDesktopBridge().rpc.invoke('data.export', {
        id: this.currentId,
        suggestedName: this.current.name
      })
      return !isCancelled(result)
    },
    async removeCurrent(): Promise<void> {
      if (!this.currentId) {
        return
      }
      const id = this.currentId
      await getDesktopBridge().rpc.invoke('data.remove', { id })
      await this.refreshList()
      const next = this.datasets[0]?.id ?? null
      await this.select(next)
    },
    async rename(id: string, name: string): Promise<void> {
      await getDesktopBridge().rpc.invoke('data.rename', { id, name })
      await this.refreshList()
      if (this.currentId === id) {
        await this.select(id)
      }
    },
    async fetchBlock(startRow: number, rowCount = BLOCK_SIZE): Promise<DataFetchBlockResult> {
      if (!this.currentId) {
        return { startRow, rows: [] }
      }
      return (await getDesktopBridge().rpc.invoke('data.fetchBlock', {
        id: this.currentId,
        startRow,
        rowCount
      })) as DataFetchBlockResult
    },
    async patchCells(patches: Array<{ row: number; col: number; value: unknown }>): Promise<void> {
      if (!this.currentId || patches.length === 0) {
        return
      }
      await getDesktopBridge().rpc.invoke('data.patchCells', { id: this.currentId, patches })
    },
    async dropNa(options?: {
      how?: string
      subset?: string[]
      minNonNa?: number
    }): Promise<DataDropNaResult | null> {
      if (!this.currentId) {
        return null
      }
      const id = this.currentId
      const result = (await getDesktopBridge().rpc.invoke('data.dropNa', {
        id,
        how: options?.how ?? 'any',
        subset: options?.subset,
        minNonNa: options?.minNonNa ?? 0
      })) as DataDropNaResult
      await this.refreshList()
      await this.select(id)
      return result
    },
    async query(queryString: string): Promise<DataQueryResult | null> {
      if (!this.currentId) {
        return null
      }
      const id = this.currentId
      const result = (await getDesktopBridge().rpc.invoke('data.query', {
        id,
        queryString
      })) as DataQueryResult
      await this.refreshList()
      await this.select(id)
      return result
    },
    async sort(options: { columns: string[]; ascending?: boolean }): Promise<DataSortResult | null> {
      if (!this.currentId) {
        return null
      }
      const id = this.currentId
      const result = (await getDesktopBridge().rpc.invoke('data.sort', {
        id,
        columns: options.columns,
        ascending: options.ascending ?? true
      })) as DataSortResult
      await this.refreshList()
      await this.select(id)
      return result
    },
    async fillNa(options?: {
      method?: string
      subset?: string[]
      value?: string | number
    }): Promise<DataFillNaResult | null> {
      if (!this.currentId) {
        return null
      }
      const id = this.currentId
      const result = (await getDesktopBridge().rpc.invoke('data.fillNa', {
        id,
        method: options?.method ?? 'value',
        subset: options?.subset,
        value: options?.value ?? 0
      })) as DataFillNaResult
      await this.refreshList()
      await this.select(id)
      return result
    },
    async describe(options?: {
      percentiles?: number[] | string
      name?: string
    }): Promise<DataDescribeResult | null> {
      if (!this.currentId) {
        return null
      }
      const result = (await getDesktopBridge().rpc.invoke('data.describe', {
        id: this.currentId,
        percentiles: options?.percentiles ?? '0.25,0.5,0.75',
        name: options?.name
      })) as DataDescribeResult
      await this.refreshList()
      await this.select(result.id)
      return result
    }
  }
})
