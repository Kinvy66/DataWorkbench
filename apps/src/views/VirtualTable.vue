<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { AgGridVue } from 'ag-grid-vue3'
import type {
  CellClickedEvent,
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
  loadGridRecords,
  type GridRowRecord
} from '@/data/gridDatasource'
import { DEFAULT_COL_WIDTH, INDEX_COL_WIDTH, MIN_COL_WIDTH } from '@/data/columnLayout'
import { bindTableClipboard } from '@/data/tableClipboard'
import {
  CLIPBOARD_MAX_CELLS,
  assertRangeSize,
  clampRange,
  cellInRange,
  deletePatches,
  formatTsvCell,
  normalizeRange,
  parseTsv,
  pastePatches,
  serializeTsv,
  type CellRange
} from '@/data/tableTsv'
import { translateRpcError } from '@/rpc/rpcError'
import { getDesktopBridge } from '@/rpc/bridge'
import DwIcon from '@/icons/DwIcon.vue'
import { commandBus } from '@/commands/commandBus'

registerAppGridModules()

const { t, te } = useI18n()
const store = useDataStore()
const gridHost = ref<HTMLElement | null>(null)
const gridApi = ref<GridApi<GridRowRecord> | null>(null)
const range = ref<CellRange | null>(null)
const anchor = ref<{ row: number; col: number } | null>(null)
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

function isRangeCell(params: { node?: { rowIndex?: number | null } | null; colDef?: { colId?: string; field?: string } }): boolean {
  const current = range.value
  if (!current || params.colDef?.colId === '_index') {
    return false
  }
  const row = params.node?.rowIndex
  const col = columnIndexFromField(params.colDef?.field)
  return typeof row === 'number' && col != null && cellInRange(current, row, col)
}

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
  },
  cellClassRules: {
    'dw-cell-range': (params) => isRangeCell(params)
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
  return formatTsvCell(value)
}

function getRowId(params: GetRowIdParams<GridRowRecord>): string {
  const row = params.data?.__row
  if (typeof row === 'number') {
    return String(row)
  }
  return String(params.node?.rowIndex ?? '')
}

function setRange(next: CellRange | null): void {
  range.value = next
  store.cellRange = next
  gridApi.value?.refreshCells({ force: true })
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

function onCellClicked(event: CellClickedEvent<GridRowRecord>): void {
  const row = event.rowIndex
  if (typeof row !== 'number' || row < 0) {
    return
  }
  const lastCol = Math.max(0, columns.value.length - 1)
  let col = columnIndexFromField(event.colDef.field)
  if (event.colDef.colId === '_index') {
    col = 0
  }
  if (col == null) {
    return
  }
  const native = event.event as MouseEvent | undefined
  if (native?.shiftKey && anchor.value) {
    const next =
      event.colDef.colId === '_index'
        ? normalizeRange(anchor.value.row, 0, row, lastCol)
        : normalizeRange(anchor.value.row, anchor.value.col, row, col)
    setRange(clampRange(next, rowCount.value, columns.value.length))
    return
  }
  if (event.colDef.colId === '_index') {
    anchor.value = { row, col: 0 }
    setRange(clampRange(normalizeRange(row, 0, row, lastCol), rowCount.value, columns.value.length))
    return
  }
  anchor.value = { row, col }
  setRange(normalizeRange(row, col, row, col))
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

async function writeText(text: string): Promise<void> {
  await getDesktopBridge().rpc.invoke('app.clipboardWrite', { text })
}

async function readText(): Promise<string> {
  const result = (await getDesktopBridge().rpc.invoke('app.clipboardRead', {})) as { text?: string }
  return typeof result.text === 'string' ? result.text : ''
}

async function copyRange(): Promise<boolean> {
  const schema = store.schema
  const current = range.value
  if (!current || !schema || !store.currentId) {
    return false
  }
  const clipped = clampRange(current, schema.rowCount, schema.columns.length)
  if (!clipped) {
    return false
  }
  assertRangeSize(clipped)
  const records = await loadGridRecords({
    startRow: clipped.r0,
    endRow: clipped.r1 + 1,
    rowCount: schema.rowCount,
    colCount: schema.columns.length,
    fetchBlock: (startRow, count) => store.fetchBlock(startRow, count)
  })
  const rect: unknown[][] = []
  for (let row = clipped.r0; row <= clipped.r1; row++) {
    const rec = records[row - clipped.r0]
    const line: unknown[] = []
    for (let col = clipped.c0; col <= clipped.c1; col++) {
      line.push(rec?.[fieldForColumn(col)] ?? null)
    }
    rect.push(line)
  }
  await writeText(serializeTsv(rect))
  return true
}

async function pasteRange(): Promise<number> {
  const schema = store.schema
  const origin = range.value
  if (!schema || !store.currentId || !origin) {
    return 0
  }
  const text = await readText()
  const table = parseTsv(text)
  if (!table.length) {
    const err = new Error('Clipboard is empty [@@edit.clipboardEmpty]')
    ;(err as Error & { i18nKey: string }).i18nKey = 'edit.clipboardEmpty'
    throw err
  }
  const result = pastePatches(origin.r0, origin.c0, table, schema.rowCount, schema.columns.length)
  if (!result.patches.length) {
    const err = new Error('Nothing to paste [@@edit.pasteEmpty]')
    ;(err as Error & { i18nKey: string }).i18nKey = 'edit.pasteEmpty'
    throw err
  }
  if (result.patches.length > CLIPBOARD_MAX_CELLS) {
    const err = new Error(`Clipboard range is too large (${result.patches.length}) [@@edit.tooManyCells]`)
    ;(err as Error & { i18nKey: string }).i18nKey = 'edit.tooManyCells'
    throw err
  }
  await store.patchCells(result.patches)
  gridApi.value?.refreshInfiniteCache()
  return result.patches.length
}

async function deleteRange(): Promise<number> {
  const schema = store.schema
  const current = range.value
  if (!current || !schema || !store.currentId) {
    return 0
  }
  const clipped = clampRange(current, schema.rowCount, schema.columns.length)
  if (!clipped) {
    return 0
  }
  assertRangeSize(clipped)
  const patches = deletePatches(clipped)
  await store.patchCells(patches)
  gridApi.value?.refreshInfiniteCache()
  return patches.length
}

function selectAllRange(): void {
  const schema = store.schema
  if (!schema || schema.rowCount <= 0 || schema.columns.length <= 0) {
    return
  }
  const next = clampRange(
    normalizeRange(0, 0, schema.rowCount - 1, schema.columns.length - 1),
    schema.rowCount,
    schema.columns.length
  )
  setRange(next)
}

watch(
  () => store.currentId,
  () => {
    pendingPatches = []
    if (patchTimer) {
      clearTimeout(patchTimer)
      patchTimer = null
    }
    anchor.value = null
    setRange(null)
  }
)

onMounted(() => {
  window.addEventListener('resize', onWindowResize)
  bindTableClipboard({
    hasRange: () => Boolean(range.value),
    copy: copyRange,
    paste: pasteRange,
    cut: async () => {
      const copied = await copyRange()
      if (!copied) {
        return 0
      }
      return deleteRange()
    },
    deleteCells: deleteRange,
    selectAll: selectAllRange
  })
})

onUnmounted(() => {
  bindTableClipboard(null)
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
    <el-button type="primary" size="small" @click="commandBus.dispatch('data.import')">
      {{ t('ribbon.dataImport') }}
    </el-button>
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
      @cell-clicked="onCellClicked"
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
  margin: 8px 0 12px;
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
.table-shell :deep(.dw-cell-range) {
  background: #e8f0fb;
}
</style>
