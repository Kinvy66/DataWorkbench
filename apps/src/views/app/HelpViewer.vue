<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getDesktopBridge } from '@/rpc/bridge'
import { translateRpcError } from '@/rpc/rpcError'
import type { HelpPageSummary, HelpReadResult } from '@dw/rpc-types'
import { renderHelpMarkdown } from '@/help/renderMarkdown'
import { normalizeWikiPageId, resolveHelpLink, type WikiPageId } from '@/help/wiki-paths'

const { t, te } = useI18n()
const pages = ref<HelpPageSummary[]>([])
const currentId = ref<WikiPageId>('README.md')
const title = ref('')
const html = ref('')
const loading = ref(false)
const error = ref('')
const helpMain = ref<HTMLElement | null>(null)
const offs: Array<() => void> = []

function initialPage(): WikiPageId {
  const fromQuery = new URLSearchParams(window.location.search).get('page')
  return normalizeWikiPageId(fromQuery) ?? 'README.md'
}

function scrollContentToTop(): void {
  const el = helpMain.value
  if (el) {
    el.scrollTop = 0
  }
}

async function loadPage(page: string): Promise<void> {
  const id = normalizeWikiPageId(page)
  if (!id) {
    error.value = t('help.missingPage')
    html.value = ''
    return
  }
  loading.value = true
  error.value = ''
  currentId.value = id
  scrollContentToTop()
  try {
    const result = (await getDesktopBridge().rpc.invoke('help.read', { page: id })) as HelpReadResult
    currentId.value = normalizeWikiPageId(result.id) ?? id
    title.value = result.title
    html.value = renderHelpMarkdown(result.markdown)
  } catch (err) {
    html.value = ''
    error.value = translateRpcError(err, t, te)
  } finally {
    loading.value = false
    await nextTick()
    scrollContentToTop()
  }
}

async function loadList(): Promise<void> {
  const result = (await getDesktopBridge().rpc.invoke('help.list', {})) as { pages: HelpPageSummary[] }
  pages.value = result.pages
}

function onContentClick(event: MouseEvent): void {
  const target = event.target
  if (!(target instanceof Element)) {
    return
  }
  const anchor = target.closest('a')
  if (!(anchor instanceof HTMLAnchorElement)) {
    return
  }
  const href = anchor.getAttribute('href')
  if (!href) {
    return
  }
  event.preventDefault()
  const resolved = resolveHelpLink(currentId.value, href)
  if (resolved.kind === 'page') {
    void loadPage(resolved.page)
    return
  }
  if (resolved.kind === 'external') {
    void getDesktopBridge().rpc.invoke('app.openUrl', { url: resolved.url }).catch(() => undefined)
  }
}

onMounted(() => {
  const page = initialPage()
  void loadList()
    .then(() => loadPage(page))
    .catch((err) => {
      error.value = translateRpcError(err, t, te)
    })
  offs.push(
    getDesktopBridge().rpc.on('help.showPage', (params) => {
      const next = normalizeWikiPageId((params as { page?: unknown } | null)?.page)
      if (next) {
        void loadPage(next)
      }
    })
  )
})

onUnmounted(() => {
  for (const off of offs) {
    off()
  }
})

const windowTitle = computed(() => title.value || t('help.windowTitle'))
</script>

<template>
  <div class="help-root">
    <header class="help-titlebar">
      <span class="help-titlebar__text">{{ windowTitle }}</span>
    </header>
    <div class="help-body">
      <nav class="help-nav" :aria-label="t('help.contents')">
        <p class="help-nav__label">{{ t('help.contents') }}</p>
        <button
          v-for="page in pages"
          :key="page.id"
          type="button"
          class="help-nav__item"
          :class="{ 'is-active': page.id === currentId }"
          @click="loadPage(page.id)"
        >
          {{ page.title }}
        </button>
      </nav>
      <main ref="helpMain" class="help-main">
        <p v-if="error" class="help-error">{{ error }}</p>
        <article
          v-else
          class="help-article markdown-body"
          :class="{ 'is-loading': loading }"
          @click="onContentClick"
          v-html="html"
        />
      </main>
    </div>
  </div>
</template>

<style scoped>
.help-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
}
.help-titlebar {
  box-sizing: border-box;
  flex: 0 0 auto;
  height: env(titlebar-area-height, 36px);
  margin-left: env(titlebar-area-x, 0px);
  width: env(titlebar-area-width, 100%);
  display: flex;
  align-items: center;
  padding: 0 12px;
  border-bottom: 1px solid #ebeef5;
  -webkit-app-region: drag;
}
.help-titlebar__text {
  font-size: 13px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.help-body {
  display: flex;
  min-height: 0;
  flex: 1;
}
.help-nav {
  flex: 0 0 240px;
  border-right: 1px solid #ebeef5;
  overflow: auto;
  padding: 8px 0 16px;
  background: #fafafa;
}
.help-nav__label {
  margin: 8px 16px;
  font-size: 12px;
  color: #909399;
}
.help-nav__item {
  display: block;
  width: 100%;
  border: 0;
  background: transparent;
  text-align: left;
  padding: 8px 16px;
  font-size: 13px;
  color: #303133;
  cursor: pointer;
  line-height: 1.4;
}
.help-nav__item:hover {
  background: #f0f2f5;
}
.help-nav__item.is-active {
  background: #eaf2fb;
  color: var(--dw-accent, #5280c1);
  font-weight: 600;
}
.help-main {
  flex: 1;
  min-width: 0;
  overflow: auto;
  padding: 16px 28px 40px;
}
.help-error {
  color: #c45656;
  font-size: 14px;
}
.help-article.is-loading {
  opacity: 0.6;
}
.markdown-body {
  color: #303133;
  font-size: 14px;
  line-height: 1.65;
}
.markdown-body :deep(h1) {
  font-size: 22px;
  margin: 0 0 16px;
}
.markdown-body :deep(h2) {
  font-size: 18px;
  margin: 24px 0 12px;
}
.markdown-body :deep(h3) {
  font-size: 15px;
  margin: 20px 0 8px;
}
.markdown-body :deep(p),
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 0 0 12px;
}
.markdown-body :deep(img) {
  max-width: 100%;
  height: auto;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}
.markdown-body :deep(table) {
  border-collapse: collapse;
  margin: 0 0 16px;
  width: 100%;
}
.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid #ebeef5;
  padding: 6px 8px;
  text-align: left;
  vertical-align: top;
}
.markdown-body :deep(code) {
  font-family: Consolas, 'Courier New', monospace;
  font-size: 12px;
  background: #f5f7fa;
  padding: 1px 4px;
  border-radius: 3px;
}
.markdown-body :deep(pre) {
  background: #f5f7fa;
  padding: 12px;
  overflow: auto;
  border-radius: 4px;
}
.markdown-body :deep(pre code) {
  background: transparent;
  padding: 0;
}
.markdown-body :deep(a) {
  color: var(--dw-accent, #5280c1);
}
</style>
