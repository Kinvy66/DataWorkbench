import { describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE, FALLBACK_LOCALE, i18n } from './index'

describe('i18n', () => {
  it('defaults the UI to Simplified Chinese', () => {
    expect(DEFAULT_LOCALE).toBe('zh-CN')
    expect(FALLBACK_LOCALE).toBe('en')
    expect(i18n.global.locale.value).toBe('zh-CN')
  })

  it('uses vue-i18n for the empty dataset copy instead of a P1 placeholder', () => {
    expect(String(i18n.global.t('layout.datasetsEmpty'))).toContain('添加数据')
    expect(String(i18n.global.t('layout.datasetsEmpty'))).not.toContain('P1')
    i18n.global.locale.value = 'en'
    expect(String(i18n.global.t('layout.datasetsEmpty'))).toContain('Add Data')
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
    expect(String(i18n.global.t('ribbon.dataOperate'))).toBe('Data Operation')
    expect(String(i18n.global.t('ribbon.operate'))).toBe('Operate')
    expect(String(i18n.global.t('ribbon.dataImport'))).toBe('Add Data')
    expect(String(i18n.global.t('ribbon.dataDropNa'))).toBe('Drop None')
    i18n.global.locale.value = 'zh-CN'
    expect(String(i18n.global.t('ribbon.dataOperate'))).toBe('数据操作')
    expect(String(i18n.global.t('ribbon.operate'))).toBe('操作')
    expect(String(i18n.global.t('ribbon.dataImport'))).toBe('添加数据')
    expect(String(i18n.global.t('ribbon.dataDropNa'))).toBe('删除缺失值')
    i18n.global.locale.value = 'en'
    expect(String(i18n.global.t('ribbon.dataDropDuplicates'))).toBe('Drop Duplicates')
    i18n.global.locale.value = 'zh-CN'
    expect(String(i18n.global.t('ribbon.dataDropDuplicates'))).toBe('删除重复值')
    i18n.global.locale.value = 'en'
    expect(String(i18n.global.t('ribbon.dataFillNa'))).toBe('Fill None')
    i18n.global.locale.value = 'zh-CN'
    expect(String(i18n.global.t('ribbon.dataFillNa'))).toBe('填充缺失值')
    i18n.global.locale.value = 'en'
    expect(String(i18n.global.t('ribbon.dataInterpolate'))).toBe('Fill Interpolate')
    i18n.global.locale.value = 'zh-CN'
    expect(String(i18n.global.t('ribbon.dataInterpolate'))).toBe('插值填充')
    i18n.global.locale.value = 'en'
    expect(String(i18n.global.t('ribbon.dataIqr'))).toBe('IQR Outlier Handling')
    i18n.global.locale.value = 'zh-CN'
    expect(String(i18n.global.t('ribbon.dataIqr'))).toBe('IQR异常值处理')
    i18n.global.locale.value = 'en'
    expect(String(i18n.global.t('ribbon.dataZscore'))).toBe('Z-Score Outlier Handling')
    i18n.global.locale.value = 'zh-CN'
    expect(String(i18n.global.t('ribbon.dataZscore'))).toBe('Z-Score异常值处理')
    i18n.global.locale.value = 'en'
    expect(String(i18n.global.t('ribbon.dataTransformSkewed'))).toBe('Transform Skewed')
    i18n.global.locale.value = 'zh-CN'
    expect(String(i18n.global.t('ribbon.dataTransformSkewed'))).toBe('转换偏态数据')
    i18n.global.locale.value = 'en'
    expect(String(i18n.global.t('ribbon.dataReplaceValues'))).toBe('Replace Values')
    i18n.global.locale.value = 'zh-CN'
    expect(String(i18n.global.t('ribbon.dataReplaceValues'))).toBe('替换值')
    i18n.global.locale.value = 'en'
    expect(String(i18n.global.t('ribbon.dataThresholdFilter'))).toBe('Threshold Filter')
    i18n.global.locale.value = 'zh-CN'
    expect(String(i18n.global.t('ribbon.dataThresholdFilter'))).toBe('阈值筛选')
    i18n.global.locale.value = 'en'
    expect(String(i18n.global.t('ribbon.dataFilterByColumn'))).toBe('Filter by Column')
    i18n.global.locale.value = 'zh-CN'
    expect(String(i18n.global.t('ribbon.dataFilterByColumn'))).toBe('列数据过滤')
    i18n.global.locale.value = 'en'
    expect(String(i18n.global.t('ribbon.dataEval'))).toBe('Eval Data')
    i18n.global.locale.value = 'zh-CN'
    expect(String(i18n.global.t('ribbon.dataEval'))).toBe('数值计算')
    i18n.global.locale.value = 'en'
    expect(String(i18n.global.t('ribbon.dataSearch'))).toBe('Data Retrieval')
    i18n.global.locale.value = 'zh-CN'
    expect(String(i18n.global.t('ribbon.dataSearch'))).toBe('数据检索')
    i18n.global.locale.value = 'en'
    expect(String(i18n.global.t('ribbon.dataQuery'))).toBe('Query Data')
    i18n.global.locale.value = 'zh-CN'
    expect(String(i18n.global.t('ribbon.dataQuery'))).toBe('条件筛选')
    i18n.global.locale.value = 'en'
    expect(String(i18n.global.t('ribbon.dataSort'))).toBe('Sort')
    i18n.global.locale.value = 'zh-CN'
    expect(String(i18n.global.t('ribbon.dataSort'))).toBe('数据排序')
    i18n.global.locale.value = 'en'
    expect(String(i18n.global.t('ribbon.dataDescribe'))).toBe('Data Description')
    i18n.global.locale.value = 'zh-CN'
    expect(String(i18n.global.t('ribbon.dataDescribe'))).toBe('数据描述')
    i18n.global.locale.value = 'en'
    expect(String(i18n.global.t('ribbon.dataPivotTable'))).toBe('Pivot Table')
    i18n.global.locale.value = 'zh-CN'
    expect(String(i18n.global.t('ribbon.dataPivotTable'))).toBe('数据透视表')
    expect(String(i18n.global.t('ribbon.dataClean'))).toBe('数据清洗')
    expect(String(i18n.global.t('ribbon.dataFilter'))).toBe('数据过滤')
    expect(String(i18n.global.t('ribbon.dataStatistic'))).toBe('统计')
    i18n.global.locale.value = 'en'
    expect(String(i18n.global.t('ribbon.chart'))).toBe('Chart')
    expect(String(i18n.global.t('ribbon.chartLine'))).toBe('Line')
    expect(String(i18n.global.t('ribbon.chartHist'))).toBe('Histogram')
    expect(String(i18n.global.t('layout.figure'))).toBe('Figure')
    expect(String(i18n.global.t('ribbon.chartExportPngTip'))).toBe('Export the current chart as PNG')
    expect(String(i18n.global.t('log.chartExportOk', { format: 'SVG' }))).toBe('Chart exported as SVG.')
    i18n.global.locale.value = 'zh-CN'
    expect(String(i18n.global.t('ribbon.chart'))).toBe('图表')
    expect(String(i18n.global.t('ribbon.chartLine'))).toBe('折线')
    expect(String(i18n.global.t('ribbon.chartHist'))).toBe('直方')
    expect(String(i18n.global.t('layout.figure'))).toBe('绘图')
    expect(String(i18n.global.t('chart.exportMissing'))).toBe('请先绘图再导出。')
    expect(String(i18n.global.t('chart.downsampled', { points: 5000, source: 1000000 }))).toBe(
      '显示 5000 / 1000000 点。缩放后会按视口重新取样。'
    )
    expect(String(i18n.global.t('project.invalid'))).toBe('这不是 DataWorkbench 工程文件。')
    i18n.global.locale.value = 'en'
    expect(String(i18n.global.t('log.projectSaved'))).toBe('Project saved.')
    i18n.global.locale.value = 'zh-CN'
    expect(String(i18n.global.t('log.projectSaved'))).toBe('工程已保存。')
  })
})
