import { defineStore } from 'pinia'
import type {
  DataDropNaResult,
  DataDropDuplicatesResult,
  DataFetchBlockResult,
  DataGetSchemaResult,
  DataImportResult,
  DataListResult,
  DataQueryResult,
  DataEvalResult,
  DataSearchResult,
  DataSortResult,
  DataFillNaResult,
  DataInterpolateResult,
  DataRemoveOutliersIqrResult,
  DataRemoveOutliersZscoreResult,
  DataTransformSkewedResult,
  DataReplaceValuesResult,
  DataThresholdFilterResult,
  DataFilterByColumnResult,
  DataDescribeResult,
  DataPivotTableResult,
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
    dropDuplicatesDialogOpen: false,
    queryDialogOpen: false,
    evalDialogOpen: false,
    searchDialogOpen: false,
    sortDialogOpen: false,
    fillNaDialogOpen: false,
    interpolateDialogOpen: false,
    iqrDialogOpen: false,
    zscoreDialogOpen: false,
    transformSkewedDialogOpen: false,
    replaceValuesDialogOpen: false,
    thresholdFilterDialogOpen: false,
    filterByColumnDialogOpen: false,
    describeDialogOpen: false,
    pivotTableDialogOpen: false
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
    async dropDuplicates(options?: {
      keep?: string
      subset?: string[]
    }): Promise<DataDropDuplicatesResult | null> {
      if (!this.currentId) {
        return null
      }
      const id = this.currentId
      const result = (await getDesktopBridge().rpc.invoke('data.dropDuplicates', {
        id,
        keep: options?.keep ?? 'first',
        subset: options?.subset
      })) as DataDropDuplicatesResult
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
    async evaluate(expression: string): Promise<DataEvalResult | null> {
      if (!this.currentId) {
        return null
      }
      const id = this.currentId
      const result = (await getDesktopBridge().rpc.invoke('data.eval', {
        id,
        expression
      })) as DataEvalResult
      await this.refreshList()
      await this.select(id)
      return result
    },
    async search(options: {
      column: string
      pattern: string
      caseSensitive?: boolean
    }): Promise<DataSearchResult | null> {
      if (!this.currentId) {
        return null
      }
      const id = this.currentId
      const result = (await getDesktopBridge().rpc.invoke('data.search', {
        id,
        column: options.column,
        pattern: options.pattern,
        caseSensitive: options.caseSensitive ?? false
      })) as DataSearchResult
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
    async interpolate(options?: {
      method?: string
      subset?: string[]
      limit?: number | null
      order?: number
    }): Promise<DataInterpolateResult | null> {
      if (!this.currentId) {
        return null
      }
      const id = this.currentId
      const result = (await getDesktopBridge().rpc.invoke('data.interpolate', {
        id,
        method: options?.method ?? 'linear',
        subset: options?.subset,
        limit: options?.limit,
        order: options?.order ?? 3
      })) as DataInterpolateResult
      await this.refreshList()
      await this.select(id)
      return result
    },
    async removeOutliersIqr(options?: {
      multiplier?: number
      action?: string
      customValue?: number
      reindex?: boolean
      subset?: string[]
    }): Promise<DataRemoveOutliersIqrResult | null> {
      if (!this.currentId) {
        return null
      }
      const id = this.currentId
      const result = (await getDesktopBridge().rpc.invoke('data.removeOutliersIqr', {
        id,
        multiplier: options?.multiplier ?? 1.5,
        action: options?.action ?? 'remove',
        customValue: options?.customValue ?? 0,
        reindex: options?.reindex ?? true,
        subset: options?.subset
      })) as DataRemoveOutliersIqrResult
      await this.refreshList()
      await this.select(id)
      return result
    },
    async removeOutliersZscore(options?: {
      threshold?: number
      robust?: boolean
      action?: string
      customValue?: number
      reindex?: boolean
      subset?: string[]
    }): Promise<DataRemoveOutliersZscoreResult | null> {
      if (!this.currentId) {
        return null
      }
      const id = this.currentId
      const result = (await getDesktopBridge().rpc.invoke('data.removeOutliersZscore', {
        id,
        threshold: options?.threshold ?? 3,
        robust: options?.robust ?? false,
        action: options?.action ?? 'remove',
        customValue: options?.customValue ?? 0,
        reindex: options?.reindex ?? true,
        subset: options?.subset
      })) as DataRemoveOutliersZscoreResult
      await this.refreshList()
      await this.select(id)
      return result
    },
    async transformSkewed(options?: {
      method?: string
      lambdaValue?: number
      addOne?: boolean
      subset?: string[]
    }): Promise<DataTransformSkewedResult | null> {
      if (!this.currentId) {
        return null
      }
      const id = this.currentId
      const result = (await getDesktopBridge().rpc.invoke('data.transformSkewed', {
        id,
        method: options?.method ?? 'log',
        lambdaValue: options?.lambdaValue ?? 0.5,
        addOne: options?.addOne ?? true,
        subset: options?.subset
      })) as DataTransformSkewedResult
      await this.refreshList()
      await this.select(id)
      return result
    },
    async replaceValues(options: {
      oldValues: string[] | string
      newValue?: string | number
      subset?: string[]
      caseSensitive?: boolean
    }): Promise<DataReplaceValuesResult | null> {
      if (!this.currentId) {
        return null
      }
      const id = this.currentId
      const result = (await getDesktopBridge().rpc.invoke('data.replaceValues', {
        id,
        oldValues: options.oldValues,
        newValue: options.newValue ?? '',
        subset: options.subset,
        caseSensitive: options.caseSensitive ?? true
      })) as DataReplaceValuesResult
      await this.refreshList()
      await this.select(id)
      return result
    },
    async thresholdFilter(options?: {
      filterType?: string
      lower?: number
      upper?: number
      subset?: string[]
      rowLogic?: 'any' | 'all' | string
      treatNan?: boolean
    }): Promise<DataThresholdFilterResult | null> {
      if (!this.currentId) {
        return null
      }
      const id = this.currentId
      const result = (await getDesktopBridge().rpc.invoke('data.thresholdFilter', {
        id,
        filterType: options?.filterType ?? 'greater_than',
        lower: options?.lower ?? 0,
        upper: options?.upper ?? 100,
        subset: options?.subset,
        rowLogic: options?.rowLogic ?? 'any',
        treatNan: options?.treatNan ?? false
      })) as DataThresholdFilterResult
      await this.refreshList()
      await this.select(id)
      return result
    },
    async filterByColumn(options: {
      column: string
      min?: number | null
      max?: number | null
    }): Promise<DataFilterByColumnResult | null> {
      if (!this.currentId) {
        return null
      }
      const id = this.currentId
      const result = (await getDesktopBridge().rpc.invoke('data.filterByColumn', {
        id,
        column: options.column,
        min: options.min ?? null,
        max: options.max ?? null
      })) as DataFilterByColumnResult
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
    },
    async pivotTable(options: {
      index: string[]
      columns?: string[]
      values?: string[]
      aggfunc?: string
      margins?: boolean
      marginsName?: string
      sort?: boolean
      name?: string
    }): Promise<DataPivotTableResult | null> {
      if (!this.currentId) {
        return null
      }
      const result = (await getDesktopBridge().rpc.invoke('data.pivotTable', {
        id: this.currentId,
        index: options.index,
        columns: options.columns,
        values: options.values,
        aggfunc: options.aggfunc ?? 'mean',
        margins: options.margins ?? false,
        marginsName: options.marginsName ?? 'All',
        sort: options.sort ?? false,
        name: options.name
      })) as DataPivotTableResult
      await this.refreshList()
      await this.select(result.id)
      return result
    }
  }
})
