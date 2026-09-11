<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { AgGridVue } from 'ag-grid-vue3'
import type {
  CellValueChangedEvent,
  ColDef,
  GetRowIdParams,
  GridApi,
  GridReadyEvent,
  IDatasource
} from 'ag-grid-community'
import { themeQuartz } from 'ag-grid-community'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { useDataStore } from '@/stores/data'
import { registerAppGridModules } from '@/data/agGridSetup'
import {
  GRID_CACHE_BLOCK_SIZE,
  GRID_MAX_BLOCKS_IN_CACHE,
  columnIndexFromField,
  createInfiniteDatasource,
  fieldForColumn,
  type GridRowRecord
} from '@/data/gridDatasource'
import { DEFAULT_COL_WIDTH, INDEX_COL_WIDTH, MIN_COL_WIDTH } from '@/data/columnLayout'
import { translateRpcError } from '@/rpc/rpcError'
import DwIcon from '@/icons/DwIcon.vue'

registerAppGridModules()

const { t, te } = useI18n()
const store = useDataStore()
const gridHost = ref<HTMLElement | null>(null)
const gridApi = ref<GridApi<GridRowRecord> | null>(null)
let pendingPatches: Array<{ row: number; col: number; value: unknown }> = []
let patchTimer: ReturnType<typeof setTimeout> | null = null

const rowCount = computed(() => store.schema?.rowCount ?? 0)
const columns = computed(() => store.schema?.columns ?? [])

const theme = themeQuartz.withParams({
  accentColor: '#5280C1',
  fontFamily: "'Segoe UI', system-ui, sans-serif",
  fontSize: 12,
  headerFontSize: 12,
  headerFontWeight: 600,
  headerBackgroundColor: '#f5f7fa',
  headerTextColor: '#606266',
  borderColor: '#ebeef5',
  rowHoverColor: '#f5f7fa',
  backgroundColor: '#ffffff',
  foregroundColor: '#303133',
  browserColorScheme: 'light',
  wrapperBorderRadius: 0,
  borderRadius: 0,
  columnBorder: true,
  spacing: 4
})

const defaultColDef: ColDef<GridRowRecord> = {
  resizable: true,
  minWidth: MIN_COL_WIDTH,
  sortable: false,
  filter: false,
  editable: true,
  suppressMovable: true,
  valueFormatter: (params) => formatCell(params.value),
  valueParser: (params) => {
    const value = params.newValue
    if (value === '' || value == null) {
      return null
    }
    return value
  }
}

const localeText = computed(() => ({
  loadingOoo: t('layout.tableLoading'),
  noRowsToShow: t('layout.tableEmpty')
}))

const columnDefs = computed<ColDef<GridRowRecord>[]>(() => {
  const indexCol: ColDef<GridRowRecord> = {
    colId: '_index',
    headerName: '#',
    width: INDEX_COL_WIDTH,
    minWidth: 40,
    maxWidth: 96,
    pinned: 'left',
    lockPinned: true,
    sortable: false,
    filter: false,
    editable: false,
    resizable: false,
    suppressMovable: true,
    cellClass: 'dw-row-index',
    valueGetter: (params) => params.node?.rowIndex ?? '',
    valueFormatter: undefined,
    valueParser: undefined
  }
  const dataCols = columns.value.map((col, index) => ({
    colId: fieldForColumn(index),
    field: fieldForColumn(index),
    headerName: col.name,
    headerTooltip: col.dtype,
    width: DEFAULT_COL_WIDTH,
    minWidth: MIN_COL_WIDTH
  }))
  return [indexCol, ...dataCols]
})

const datasource = computed<IDatasource | undefined>(() => {
  const schema = store.schema
  if (!store.currentId || !schema) {
    return undefined
  }
  return createInfiniteDatasource({
    rowCount: schema.rowCount,
    colCount: schema.columns.length,
    fetchBlock: (startRow, count) => store.fetchBlock(startRow, count),
    onError: (err) => {
      ElMessage.error(translateRpcError(err, (k) => String(t(k)), (k) => te(k)))
    }
  })
})

function formatCell(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  return String(value)
}

function getRowId(params: GetRowIdParams<GridRowRecord>): string {
  const row = params.data?.__row
  if (typeof row === 'number') {
    return String(row)
  }
  return String(params.node?.rowIndex ?? '')
}

function onGridReady(event: GridReadyEvent<GridRowRecord>): void {
  gridApi.value = event.api
  recoverHiddenLayout()
}

function recoverHiddenLayout(): void {
  const api = gridApi.value
  const el = gridHost.value
  if (!api || !el || el.clientHeight < 32) {
    return
  }
  if (api.getRenderedNodes().length === 0 && rowCount.value > 0) {
    api.refreshInfiniteCache()
  }
}

function onWindowResize(): void {
  recoverHiddenLayout()
}

function queuePatch(row: number, col: number, value: unknown): void {
  pendingPatches.push({ row, col, value })
  if (patchTimer) {
    clearTimeout(patchTimer)
  }
  patchTimer = setTimeout(() => {
    void flushPatches()
  }, 50)
}

async function flushPatches(): Promise<void> {
  const batch = pendingPatches
  pendingPatches = []
  patchTimer = null
  if (batch.length === 0) {
    return
  }
  try {
    await store.patchCells(batch)
  } catch (err) {
    ElMessage.error(translateRpcError(err, (k) => String(t(k)), (k) => te(k)))
    gridApi.value?.refreshInfiniteCache()
  }
}

function onCellValueChanged(event: CellValueChangedEvent<GridRowRecord>): void {
  const row = event.data?.__row
  const col = columnIndexFromField(event.colDef.field)
  if (typeof row !== 'number' || col == null) {
    return
  }
  if (formatCell(event.oldValue) === formatCell(event.newValue)) {
    return
  }
  const text = event.newValue == null ? '' : String(event.newValue)
  queuePatch(row, col, text)
}

watch(
  () => store.currentId,
  () => {
    pendingPatches = []
    if (patchTimer) {
      clearTimeout(patchTimer)
      patchTimer = null
    }
  }
)

onMounted(() => {
  window.addEventListener('resize', onWindowResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onWindowResize)
  if (patchTimer) {
    clearTimeout(patchTimer)
  }
})
</script>

<template>
  <div v-if="!store.currentId || !store.schema" class="empty">
    <DwIcon name="gui/data-table" :size="48" />
    <p class="muted">{{ t('layout.tableEmpty') }}</p>
  </div>
  <div v-else ref="gridHost" class="table-shell">
    <AgGridVue
      :key="store.currentId"
      class="dw-grid"
      :theme="theme"
      :columnDefs="columnDefs"
      :defaultColDef="defaultColDef"
      :datasource="datasource"
      rowModelType="infinite"
      :cacheBlockSize="GRID_CACHE_BLOCK_SIZE"
      :maxBlocksInCache="GRID_MAX_BLOCKS_IN_CACHE"
      :maxConcurrentDatasourceRequests="2"
      :blockLoadDebounceMillis="50"
      :rowBuffer="12"
      :headerHeight="28"
      :rowHeight="28"
      :animateRows="false"
      :getRowId="getRowId"
      :localeText="localeText"
      stopEditingWhenCellsLoseFocus
      @grid-ready="onGridReady"
      @cell-value-changed="onCellValueChanged"
    />
  </div>
</template>

<style scoped>
.empty {
  margin: 16px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  opacity: 0.85;
}
.muted {
  margin: 8px 0 0;
  color: #909399;
  font-size: 13px;
}
.table-shell {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.dw-grid {
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
}
.table-shell :deep(.dw-row-index) {
  color: #909399;
  background: #fafafa;
}
</style>
