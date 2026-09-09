import { describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE, FALLBACK_LOCALE, i18n } from './index'

describe('i18n', () => {
  it('defaults the UI to Simplified Chinese', () => {
    expect(DEFAULT_LOCALE).toBe('zh-CN')
    expect(FALLBACK_LOCALE).toBe('en')
    expect(i18n.global.locale.value).toBe('zh-CN')
  })

  it('uses vue-i18n for the empty dataset copy instead of a P1 placeholder', () => {
    expect(String(i18n.global.t('layout.datasetsEmpty'))).toContain('导入')
    expect(String(i18n.global.t('layout.datasetsEmpty'))).not.toContain('P1')
    i18n.global.locale.value = 'en'
    expect(String(i18n.global.t('layout.datasetsEmpty'))).toContain('Import')
    i18n.global.locale.value = 'zh-CN'
  })

  it('translates workflow empty states', () => {
    expect(String(i18n.global.t('layout.nodesEmpty'))).toContain('节点')
    expect(String(i18n.global.t('layout.workflowEmpty'))).toContain('节点')
    i18n.global.locale.value = 'en'
    expect(String(i18n.global.t('layout.nodesEmpty'))).toContain('Node types')
    expect(String(i18n.global.t('workflow.busy'))).toContain('running')
    expect(String(i18n.global.t('log.workflowStopped'))).toBe('Workflow stopped.')
    expect(String(i18n.global.t('layout.fitView'))).toBe('Fit view')
    expect(String(i18n.global.t('ribbon.undo'))).toBe('Undo')
    i18n.global.locale.value = 'zh-CN'
    expect(String(i18n.global.t('layout.fitView'))).toBe('适应画布')
    expect(String(i18n.global.t('log.workflowStopped'))).toBe('工作流已停止。')
    expect(String(i18n.global.t('ribbon.undo'))).toBe('撤销')
  })
})
