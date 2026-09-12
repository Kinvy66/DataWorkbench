import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('AppRibbon chrome layout', () => {
  it('keeps ribbon header content in the titlebar-area so it does not sit under native controls', () => {
    const source = readFileSync(resolve(here, 'AppRibbon.vue'), 'utf8')
    expect(source).toContain('env(titlebar-area-width')
    expect(source).toContain('env(titlebar-area-x')
    expect(source).not.toContain('WindowCaptionButtons')
  })

  it('spans large commands across the classic 3-row collection grid', () => {
    const source = readFileSync(resolve(here, 'AppRibbon.vue'), 'utf8')
    expect(source).toMatch(/grid-row:\s*1\s*\/\s*-1/)
  })

  it('places the application logo at the start of the title bar', () => {
    const source = readFileSync(resolve(here, 'AppRibbon.vue'), 'utf8')
    expect(source).toMatch(/<div class="titlebar-logo"[\s\S]*?<MlRibbon/)
    expect(source).toMatch(
      /margin-left:\s*calc\(env\(titlebar-area-x,\s*0px\)\s*\+\s*var\(--dw-title-logo-width\)\)/
    )
    expect(source).not.toMatch(/#tabs-extra>[\s\S]*?<DwIcon name="app\/icon"/)
  })

  it('toggles the UI locale from the ribbon extra slot without changing button size', () => {
    const source = readFileSync(resolve(here, 'AppRibbon.vue'), 'utf8')
    expect(source).toContain('toggleLocale')
    expect(source).toContain('locale-btn')
    expect(source).toContain('locale-btn__label')
    expect(source).toContain('grid-area: 1 / 1')
  })

  it('hides layout switcher and key tips, keeps minimize', () => {
    const source = readFileSync(resolve(here, 'AppRibbon.vue'), 'utf8')
    expect(source).toContain('hide-layout-switcher')
    expect(source).toContain('hide-key-tips-toggle')
    expect(source).not.toContain('hide-minimize-button')
  })

  it('restyles contextual tabs as a color bar instead of the library pill', () => {
    const source = readFileSync(resolve(here, 'AppRibbon.vue'), 'utf8')
    expect(source).toContain('ml-ribbon-contextual-tabs__block')
    expect(source).toContain('border-top: 3px solid var(--ctx-color)')
    expect(source).not.toContain('inset 0 3px 0 var(--ctx-color)')
    expect(source).toContain('font-weight: 600')
  })

  it('starts on Home and only follows workspace focus after it changes', () => {
    const source = readFileSync(resolve(here, 'AppRibbon.vue'), 'utf8')
    expect(source).toContain("activeTab = ref('home')")
    expect(source).toContain('ribbonContextTabId')
    expect(source).toContain('centerTab')
    expect(source).not.toContain('{ immediate: true }')
  })

  it('paints Qt File-menu icons onto the teleported dropdown', () => {
    const source = readFileSync(resolve(here, 'AppRibbon.vue'), 'utf8')
    expect(source).toContain('ml-ribbon-file-menu-dropdown')
    expect(source).toContain("url('@/assets/icons/app/appendProject.svg')")
    expect(source).toContain("url('@/assets/icons/app/file.svg')")
    expect(source).toContain("url('@/assets/icons/app/save.svg')")
    expect(source).toContain("url('@/assets/icons/app/save-as.svg')")
    expect(source).toContain("url('@/assets/icons/gui/cancel.svg')")
    // v-bind CSS vars live on the Vue host; the teleported popper never sees them.
    expect(source).not.toMatch(/background-image:\s*v-bind/)
  })
})
