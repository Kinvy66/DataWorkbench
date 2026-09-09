<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const maximized = ref(false)
let offState: (() => void) | undefined

onMounted(() => {
  const chrome = window.dw.window
  if (!chrome) {
    return
  }
  void chrome.isMaximized().then((value) => {
    maximized.value = value
  })
  offState = chrome.onMaximizedChange((value) => {
    maximized.value = value
  })
})

onUnmounted(() => {
  offState?.()
})

function minimize(): void {
  void window.dw.window?.minimize()
}

function toggleMaximize(): void {
  void window.dw.window?.toggleMaximize()
}

function closeWindow(): void {
  void window.dw.window?.close()
}
</script>

<template>
  <div class="dw-caption" role="group" :aria-label="t('window.controls')">
    <button type="button" class="dw-caption__btn" :title="t('window.minimize')" @click="minimize">
      <svg viewBox="0 0 10 10" aria-hidden="true">
        <path d="M1 5h8" />
      </svg>
    </button>
    <button
      type="button"
      class="dw-caption__btn"
      :title="maximized ? t('window.restore') : t('window.maximize')"
      @click="toggleMaximize"
    >
      <svg v-if="!maximized" viewBox="0 0 10 10" aria-hidden="true">
        <rect x="1.5" y="1.5" width="7" height="7" />
      </svg>
      <svg v-else viewBox="0 0 10 10" aria-hidden="true">
        <path d="M3 3.5h4.5V8H3z" />
        <path d="M2.5 2h4.5v1H3.5v3.5h-1z" />
      </svg>
    </button>
    <button type="button" class="dw-caption__btn dw-caption__btn--close" :title="t('window.close')" @click="closeWindow">
      <svg viewBox="0 0 10 10" aria-hidden="true">
        <path d="M2 2l6 6M8 2L2 8" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.dw-caption {
  display: flex;
  align-self: stretch;
  margin: 0 -4px 0 4px;
  -webkit-app-region: no-drag;
}
.dw-caption__btn {
  width: 46px;
  height: 32px;
  border: 0;
  padding: 0;
  background: transparent;
  color: #727272;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.dw-caption__btn svg {
  width: 10px;
  height: 10px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.2;
  stroke-linecap: square;
}
.dw-caption__btn:hover {
  background: #ebeef5;
  color: #303133;
}
.dw-caption__btn--close:hover {
  background: #ce6043;
  color: #fff;
}
</style>
