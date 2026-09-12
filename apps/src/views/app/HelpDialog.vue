<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { commandBus } from '@/commands/commandBus'
import { useAppUiStore } from '@/stores/appUi'

const { t } = useI18n()
const ui = useAppUiStore()

const visible = computed({
  get: () => ui.helpOpen,
  set: (open: boolean) => {
    ui.helpOpen = open
  }
})

function run(id: string): void {
  ui.helpOpen = false
  void commandBus.dispatch(id)
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="t('help.title')"
    width="420px"
    append-to-body
    destroy-on-close
  >
    <div class="menu">
      <button type="button" class="item" @click="run('help.guide')">
        <span class="label">{{ t('help.guide') }}</span>
        <span class="hint">{{ t('help.guideHint') }}</span>
      </button>
      <button type="button" class="item" @click="run('help.tutorial')">
        <span class="label">{{ t('help.tutorial') }}</span>
        <span class="hint">{{ t('help.tutorialHint') }}</span>
      </button>
      <button type="button" class="item" @click="run('help.faq')">
        <span class="label">{{ t('help.faq') }}</span>
        <span class="hint">{{ t('help.faqHint') }}</span>
      </button>
      <button type="button" class="item" @click="run('help.howToTest')">
        <span class="label">{{ t('help.howToTest') }}</span>
        <span class="hint">{{ t('help.howToTestHint') }}</span>
      </button>
      <button type="button" class="item" @click="run('help.bugReport')">
        <span class="label">{{ t('help.bugReport') }}</span>
        <span class="hint">{{ t('help.bugReportHint') }}</span>
      </button>
    </div>
    <p class="keys">{{ t('help.shortcuts') }}</p>
    <template #footer>
      <el-button @click="visible = false">{{ t('help.close') }}</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.menu {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  text-align: left;
}
.item:hover {
  border-color: #5280c1;
  background: #f5f8fd;
}
.label {
  font-size: 14px;
  color: #303133;
}
.hint {
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
}
.keys {
  margin: 12px 0 0;
  color: #909399;
  font-size: 12px;
  line-height: 1.5;
}
</style>
