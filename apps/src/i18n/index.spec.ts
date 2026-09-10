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
    i18n.global.locale.value = 'en'
    expect(String(i18n.global.t('ribbon.dataDropNa'))).toBe('Drop NA')
    i18n.global.locale.value = 'zh-CN'
    expect(String(i18n.global.t('ribbon.dataDropNa'))).toBe('删除缺失')
    i18n.global.locale.value = 'en'
    expect(String(i18n.global.t('ribbon.dataDropDuplicates'))).toBe('Drop Duplicates')
    i18n.global.locale.value = 'zh-CN'
    expect(String(i18n.global.t('ribbon.dataDropDuplicates'))).toBe('删除重复')
    i18n.global.locale.value = 'en'
    expect(String(i18n.global.t('ribbon.dataFillNa'))).toBe('Fill NA')
    i18n.global.locale.value = 'zh-CN'
    expect(String(i18n.global.t('ribbon.dataFillNa'))).toBe('填充缺失')
    i18n.global.locale.value = 'en'
    expect(String(i18n.global.t('ribbon.dataReplaceValues'))).toBe('Replace Values')
    i18n.global.locale.value = 'zh-CN'
    expect(String(i18n.global.t('ribbon.dataReplaceValues'))).toBe('替换值')
    i18n.global.locale.value = 'en'
    expect(String(i18n.global.t('ribbon.dataThresholdFilter'))).toBe('Threshold Filter')
    i18n.global.locale.value = 'zh-CN'
    expect(String(i18n.global.t('ribbon.dataThresholdFilter'))).toBe('阈值筛选')
    i18n.global.locale.value = 'en'
    expect(String(i18n.global.t('ribbon.dataQuery'))).toBe('Query')
    i18n.global.locale.value = 'zh-CN'
    expect(String(i18n.global.t('ribbon.dataQuery'))).toBe('查询')
    i18n.global.locale.value = 'en'
    expect(String(i18n.global.t('ribbon.dataSort'))).toBe('Sort')
    i18n.global.locale.value = 'zh-CN'
    expect(String(i18n.global.t('ribbon.dataSort'))).toBe('排序')
    i18n.global.locale.value = 'en'
    expect(String(i18n.global.t('ribbon.dataDescribe'))).toBe('Describe')
    i18n.global.locale.value = 'zh-CN'
    expect(String(i18n.global.t('ribbon.dataDescribe'))).toBe('描述统计')
    expect(String(i18n.global.t('ribbon.dataAnalyze'))).toBe('分析')
  })
})
