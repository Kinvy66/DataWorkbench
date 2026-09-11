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

  it('toggles the UI locale from the ribbon extra slot', () => {
    const source = readFileSync(resolve(here, 'AppRibbon.vue'), 'utf8')
    expect(source).toContain('toggleLocale')
    expect(source).toContain('locale-btn')
  })

  it('paints Qt File-menu icons onto the teleported dropdown', () => {
    const source = readFileSync(resolve(here, 'AppRibbon.vue'), 'utf8')
    expect(source).toContain('ml-ribbon-file-menu-dropdown')
    expect(source).toContain("fileMenuIconCss('app/appendProject')")
    expect(source).toContain("fileMenuIconCss('app/file')")
    expect(source).toContain("fileMenuIconCss('app/save')")
    expect(source).toContain("fileMenuIconCss('app/save-as')")
    expect(source).toContain("fileMenuIconCss('gui/cancel')")
  })
})
