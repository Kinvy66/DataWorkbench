<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { useDataStore } from '@/stores/data'
import { useLogStore } from '@/stores/log'
import { translateRpcError } from '@/rpc/rpcError'

const { t, te } = useI18n()
const store = useDataStore()
const log = useLogStore()
const applying = ref(false)
const expression = ref('')

const visible = computed({
  get: () => store.evalDialogOpen,
  set: (open: boolean) => {
    store.evalDialogOpen = open
  }
})

const columns = computed(() => store.schema?.columns.map((col) => col.name) ?? [])
const canApply = computed(() => Boolean(expression.value.trim()) && !applying.value)

function columnToken(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `\`${name.replace(/`/g, '')}\``
}

function insertColumn(name: string): void {
  const token = columnToken(name)
  const current = expression.value
  const needsSpace = Boolean(current.length) && !/\s$/.test(current)
  expression.value = `${current}${needsSpace ? ' ' : ''}${token}`
}

watch(
  () => store.currentId,
  (id) => {
    if (!id) {
      store.evalDialogOpen = false
    }
  }
)

watch(visible, (open) => {
  if (open) {
    expression.value = ''
  }
})

function report(err: unknown): void {
  const message = translateRpcError(err, t, te)
  ElMessage.error(message)
  log.append('error', message)
}

async function confirm(): Promise<void> {
  const expr = expression.value.trim()
  if (!store.currentId || !expr || applying.value) {
    return
  }
  applying.value = true
  try {
    const result = await store.evaluate(expr)
    store.evalDialogOpen = false
    if (!result) {
      return
    }
    const line = t('log.evalOk', {
      name: result.name,
      rows: result.rows,
      cols: result.cols
    })
    log.append('info', line)
    ElMessage.success(line)
  } catch (err) {
    report(err)
  } finally {
    applying.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="t('ribbon.dataEval')"
    width="520px"
    destroy-on-close
    append-to-body
    :close-on-click-modal="!applying"
  >
    <el-form label-position="top" size="small" @submit.prevent="confirm">
      <el-form-item :label="t('data.evalExpression')">
        <el-input
          v-model="expression"
          type="textarea"
          :rows="4"
          :placeholder="t('data.evalPlaceholder')"
        />
      </el-form-item>
      <p class="hint">{{ t('data.evalHint') }}</p>
      <div v-if="columns.length" class="cols">
        <span class="cols-label">{{ t('layout.column') }}</span>
        <el-button
          v-for="name in columns"
          :key="name"
          size="small"
          text
          @click="insertColumn(name)"
        >
          {{ name }}
        </el-button>
      </div>
    </el-form>
    <template #footer>
      <el-button :disabled="applying" @click="visible = false">{{ t('data.evalCancel') }}</el-button>
      <el-button type="primary" :loading="applying" :disabled="!canApply" @click="confirm">
        {{ t('data.evalConfirm') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.hint {
  margin: 0 0 8px;
  color: #909399;
  font-size: 12px;
  line-height: 1.5;
}
.cols {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
.cols-label {
  color: #909399;
  font-size: 12px;
  margin-right: 4px;
}
</style>
