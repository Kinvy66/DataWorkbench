<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const maximized = ref(false)
let offState: (() => void) | undefined

function chromeApi() {
  return window.dw?.window
}

onMounted(() => {
  const chrome = chromeApi()
  if (!chrome) {
    console.error('Window chrome API missing: preload did not expose dw.window')
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

function run(action: 'minimize' | 'toggleMaximize' | 'close'): void {
  const chrome = chromeApi()
  if (!chrome) {
    console.error('Window chrome API missing: preload did not expose dw.window')
    return
  }
  void chrome[action]()
}
</script>

<template>
  <div class="dw-caption" role="group" :aria-label="t('window.controls')">
    <button
      type="button"
      class="dw-caption__btn"
      :title="t('window.minimize')"
      @pointerdown.stop
      @click.stop="run('minimize')"
    >
      <svg viewBox="0 0 10 10" aria-hidden="true">
        <path d="M1 5h8" />
      </svg>
    </button>
    <button
      type="button"
      class="dw-caption__btn"
      :title="maximized ? t('window.restore') : t('window.maximize')"
      @pointerdown.stop
      @click.stop="run('toggleMaximize')"
    >
      <svg v-if="!maximized" viewBox="0 0 10 10" aria-hidden="true">
        <rect x="1.5" y="1.5" width="7" height="7" />
      </svg>
      <svg v-else viewBox="0 0 10 10" aria-hidden="true">
        <path d="M3 3.5h4.5V8H3z" />
        <path d="M2.5 2h4.5v1H3.5v3.5h-1z" />
      </svg>
    </button>
    <button
      type="button"
      class="dw-caption__btn dw-caption__btn--close"
      :title="t('window.close')"
      @pointerdown.stop
      @click.stop="run('close')"
    >
      <svg viewBox="0 0 10 10" aria-hidden="true">
        <path d="M2 2l6 6M8 2L2 8" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.dw-caption {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 40;
  display: flex;
  height: var(--dw-caption-height, 36px);
  margin: 0;
  -webkit-app-region: no-drag;
}
.dw-caption__btn {
  width: var(--dw-caption-btn-width, 46px);
  height: 100%;
  border: 0;
  border-radius: 0;
  padding: 0;
  background: transparent;
  color: #727272;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-app-region: no-drag;
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
