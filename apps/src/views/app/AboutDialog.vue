<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { APP_VERSION } from '@dw/rpc-types'
import { commandBus } from '@/commands/commandBus'
import DwIcon from '@/icons/DwIcon.vue'
import { APP_REPO_URL } from '@/help/urls'
import { useAppUiStore } from '@/stores/appUi'
import { qaLabEnabled } from '@/qa-lab'

const { t } = useI18n()
const ui = useAppUiStore()

const visible = computed({
  get: () => ui.aboutOpen,
  set: (open: boolean) => {
    ui.aboutOpen = open
  }
})

function openRepo(): void {
  void commandBus.dispatch('help.repo')
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="t('about.title')"
    width="480px"
    append-to-body
    destroy-on-close
  >
    <div class="about">
      <DwIcon name="app/icon" :size="56" />
      <h3>{{ t('app.title') }}</h3>
      <p class="version">{{ t('about.version', { version: APP_VERSION }) }}</p>
      <p v-if="qaLabEnabled()" class="muted">{{ t('about.training') }}</p>
      <p>{{ t('about.body') }}</p>
      <p class="muted">{{ t('about.copyright') }}</p>
      <p class="muted">{{ t('about.license') }}</p>
      <el-button type="primary" link @click="openRepo">{{ APP_REPO_URL }}</el-button>
    </div>
    <template #footer>
      <el-button type="primary" @click="visible = false">{{ t('about.close') }}</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.about {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
}
.about h3 {
  margin: 8px 0 0;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}
.version,
.muted {
  margin: 0;
  color: #909399;
  font-size: 13px;
  line-height: 1.5;
}
.about p {
  margin: 0;
  color: #606266;
  font-size: 13px;
  line-height: 1.6;
  max-width: 400px;
}
</style>
