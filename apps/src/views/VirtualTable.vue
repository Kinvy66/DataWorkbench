<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { useDataStore } from '@/stores/data'
import { BLOCK_SIZE, blockOrigin, blocksForWindow } from '@/data/blockWindow'
import {
  DEFAULT_COL_WIDTH,
  INDEX_COL_WIDTH,
  gridTemplate,
  nextColumnWidth,
  tableMinWidth as minTableWidth
} from '@/data/columnLayout'
import { translateRpcError } from '@/rpc/rpcError'
import DwIcon from '@/icons/DwIcon.vue'

const { t, te } = useI18n()
const store = useDataStore()
const parentRef = ref<HTMLElement | null>(null)
const editorRef = ref<HTMLInputElement | null>(null)
const blocks = ref<Record<number, unknown[][]>>({})
const inflight = new Set<number>()
let fetchGen = 0
const editing = ref<{ row: number; col: number; text: string } | null>(null)
const widthByName = ref<Record<string, number>>({})
let pendingPatches: Array<{ row: number; col: number; value: unknown }> = []
let patchTimer: ReturnType<typeof setTimeout> | null = null

const rowCount = computed(() => store.schema?.rowCount ?? 0)
const columns = computed(() => store.schema?.columns ?? [])
const columnWidths = computed(() =>
  columns.value.map((col) => widthByName.value[col.name] ?? DEFAULT_COL_WIDTH)
)
const tableMinWidth = computed(() => minTableWidth(INDEX_COL_WIDTH, columnWidths.value))

const virtualizer = useVirtualizer(
  computed(() => {
    const scrollElement = parentRef.value
    return {
      count: rowCount.value,
      getScrollElement: () => scrollElement,
      estimateSize: () => 28,
      overscan: 12
    }
  })
)

function formatCell(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  return String(value)
}

function cellAt(row: number, col: number): unknown {
  const origin = blockOrigin(row)
  const block = blocks.value[origin]
  if (!block) {
    return undefined
  }
  const local = row - origin
  if (local < 0 || local >= block.length) {
    return null
  }
  return block[local]?.[col] ?? null
}

function isLoading(row: number): boolean {
  return blocks.value[blockOrigin(row)] === undefined
}

async function ensureBlocks(visibleStart: number, visibleEnd: number): Promise<void> {
  const token = fetchGen
  const needed = blocksForWindow(visibleStart, visibleEnd, rowCount.value)
  const next: Record<number, unknown[][]> = {}
  for (const origin of needed) {
    if (blocks.value[origin]) {
      next[origin] = blocks.value[origin]
    }
  }
  blocks.value = next
  for (const origin of needed) {
    if (blocks.value[origin] || inflight.has(origin)) {
      continue
    }
    inflight.add(origin)
    try {
      const block = await store.fetchBlock(origin, BLOCK_SIZE)
      if (token !== fetchGen) {
        return
      }
      blocks.value = { ...blocks.value, [origin]: block.rows }
    } catch (err) {
      if (token !== fetchGen) {
        return
      }
      ElMessage.error(translateRpcError(err, (k) => String(t(k)), (k) => te(k)))
    } finally {
      inflight.delete(origin)
    }
  }
}

function requestVisibleBlocks(): void {
  if (!store.currentId || rowCount.value <= 0) {
    return
  }
  const items = virtualizer.value.getVirtualItems()
  if (items.length === 0) {
    void ensureBlocks(0, Math.min(BLOCK_SIZE - 1, rowCount.value - 1))
    return
  }
  void ensureBlocks(items[0].index, items[items.length - 1].index)
}

watch(
  () => store.currentId,
  () => {
    fetchGen += 1
    blocks.value = {}
    inflight.clear()
    editing.value = null
    widthByName.value = {}
    pendingPatches = []
    if (patchTimer) {
      clearTimeout(patchTimer)
      patchTimer = null
    }
  }
)

watch(
  () => `${store.currentId ?? ''}:${rowCount.value}`,
  () => {
    requestVisibleBlocks()
  },
  { immediate: true }
)

watch(editing, async (current) => {
  if (!current) {
    return
  }
  await nextTick()
  editorRef.value?.focus()
  editorRef.value?.select()
})

function beginEdit(row: number, col: number): void {
  if (isLoading(row)) {
    return
  }
  editing.value = { row, col, text: formatCell(cellAt(row, col)) }
}

function writeCache(row: number, col: number, value: unknown): void {
  const origin = blockOrigin(row)
  const block = blocks.value[origin]
  if (!block) {
    return
  }
  const local = row - origin
  if (!block[local]) {
    return
  }
  const nextRow = [...block[local]]
  nextRow[col] = value
  const nextBlock = [...block]
  nextBlock[local] = nextRow
  blocks.value = { ...blocks.value, [origin]: nextBlock }
}

function queuePatch(row: number, col: number, value: string): void {
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
    for (const patch of batch) {
      writeCache(patch.row, patch.col, patch.value === '' ? null : patch.value)
    }
  } catch (err) {
    ElMessage.error(translateRpcError(err, (k) => String(t(k)), (k) => te(k)))
  }
}

function commitEdit(): void {
  const current = editing.value
  editing.value = null
  if (!current) {
    return
  }
  const previous = formatCell(cellAt(current.row, current.col))
  if (current.text === previous) {
    return
  }
  queuePatch(current.row, current.col, current.text)
}

function cancelEdit(): void {
  editing.value = null
}

function onResizeStart(index: number, ev: PointerEvent): void {
  const name = columns.value[index]?.name
  if (!name) {
    return
  }
  const startWidth = columnWidths.value[index] ?? DEFAULT_COL_WIDTH
  const startX = ev.clientX
  const target = ev.currentTarget as HTMLElement
  target.setPointerCapture(ev.pointerId)
  const onMove = (move: PointerEvent): void => {
    widthByName.value = {
      ...widthByName.value,
      [name]: nextColumnWidth(startWidth, move.clientX - startX)
    }
  }
  const onUp = (): void => {
    target.removeEventListener('pointermove', onMove)
    target.removeEventListener('pointerup', onUp)
    target.removeEventListener('pointercancel', onUp)
    if (target.hasPointerCapture(ev.pointerId)) {
      target.releasePointerCapture(ev.pointerId)
    }
  }
  target.addEventListener('pointermove', onMove)
  target.addEventListener('pointerup', onUp)
  target.addEventListener('pointercancel', onUp)
}

const gridStyle = computed(() => ({
  gridTemplateColumns: gridTemplate(INDEX_COL_WIDTH, columnWidths.value),
  minWidth: `${tableMinWidth.value}px`
}))
</script>

<template>
  <div v-if="!store.currentId" class="empty">
    <DwIcon name="gui/data-table" :size="48" />
    <p class="muted">{{ t('layout.tableEmpty') }}</p>
  </div>
  <div v-else class="table-shell">
    <div ref="parentRef" class="table-scroll" @scroll="requestVisibleBlocks">
      <div class="row header" :style="gridStyle">
        <div class="cell index">#</div>
        <div v-for="(col, i) in columns" :key="i" class="cell header-cell" :title="col.dtype">
          <span class="header-label">{{ col.name }}</span>
          <span class="col-resizer" @pointerdown.stop.prevent="onResizeStart(i, $event)" />
        </div>
      </div>
      <div
        class="virtual-space"
        :style="{ height: `${virtualizer.getTotalSize()}px`, minWidth: `${tableMinWidth}px` }"
      >
        <div
          v-for="row in virtualizer.getVirtualItems()"
          :key="row.key"
          class="row body-row"
          :style="{
            ...gridStyle,
            height: `${row.size}px`,
            transform: `translateY(${row.start}px)`
          }"
        >
          <div class="cell index">{{ row.index }}</div>
          <div
            v-for="(col, colIndex) in columns"
            :key="col.name + colIndex"
            class="cell"
            :class="{ loading: isLoading(row.index) }"
            @dblclick="beginEdit(row.index, colIndex)"
          >
            <input
              v-if="editing && editing.row === row.index && editing.col === colIndex"
              ref="editorRef"
              v-model="editing.text"
              class="editor"
              @blur="commitEdit"
              @keydown.enter.prevent="commitEdit"
              @keydown.esc.prevent="cancelEdit"
            />
            <span v-else>{{ isLoading(row.index) ? '…' : formatCell(cellAt(row.index, colIndex)) }}</span>
          </div>
        </div>
      </div>
    </div>
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
  display: flex;
  flex-direction: column;
}
.table-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  position: relative;
  font-size: 12px;
}
.header {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #f5f7fa;
  font-weight: 600;
  color: #606266;
  border-bottom: 1px solid #dcdfe6;
}
.virtual-space {
  position: relative;
  width: 100%;
}
.row {
  display: grid;
  box-sizing: border-box;
}
.body-row {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  border-bottom: 1px solid #ebeef5;
}
.body-row:hover {
  background: #f5f7fa;
}
.cell {
  padding: 4px 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-right: 1px solid #ebeef5;
  min-width: 0;
}
.cell.index {
  color: #909399;
  background: #fafafa;
}
.cell.loading {
  color: #c0c4cc;
}
.header-cell {
  position: relative;
  display: flex;
  align-items: center;
}
.header-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.col-resizer {
  position: absolute;
  top: 0;
  right: 0;
  width: 8px;
  height: 100%;
  cursor: col-resize;
  z-index: 3;
}
.col-resizer:hover {
  background: rgba(82, 128, 193, 0.35);
}
.editor {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--dw-accent, #5280c1);
  font: inherit;
  padding: 0 4px;
}
</style>
