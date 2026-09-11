import type { OpenDialogOptions, SaveDialogOptions } from 'electron'

export const DATA_OPEN_FILTERS: OpenDialogOptions['filters'] = [
  { name: 'Data files', extensions: ['csv', 'txt', 'tsv', 'xlsx', 'parquet'] },
  { name: 'CSV', extensions: ['csv', 'txt', 'tsv'] },
  { name: 'Excel', extensions: ['xlsx'] },
  { name: 'Parquet', extensions: ['parquet'] },
  { name: 'All files', extensions: ['*'] }
]

export const DATA_SAVE_FILTERS: SaveDialogOptions['filters'] = [
  { name: 'CSV', extensions: ['csv'] },
  { name: 'Excel', extensions: ['xlsx'] },
  { name: 'Parquet', extensions: ['parquet'] }
]

export function dataOpenDialogOptions(): OpenDialogOptions {
  return {
    properties: ['openFile'],
    filters: DATA_OPEN_FILTERS
  }
}

export function dataSaveDialogOptions(suggestedName?: string): SaveDialogOptions {
  return {
    defaultPath: suggestedName,
    filters: DATA_SAVE_FILTERS
  }
}

export function chartSaveDialogOptions(
  format: 'png' | 'svg' | 'pdf',
  suggestedName?: string
): SaveDialogOptions {
  const filters =
    format === 'png'
      ? [{ name: 'PNG', extensions: ['png'] }]
      : format === 'svg'
        ? [{ name: 'SVG', extensions: ['svg'] }]
        : [{ name: 'PDF', extensions: ['pdf'] }]
  return {
    defaultPath: suggestedName,
    filters
  }
}

export function projectOpenDialogOptions(): OpenDialogOptions {
  return {
    properties: ['openFile'],
    filters: [
      { name: 'DataWorkbench project', extensions: ['dwproj'] },
      { name: 'All files', extensions: ['*'] }
    ]
  }
}

export function projectSaveDialogOptions(suggestedName?: string): SaveDialogOptions {
  return {
    defaultPath: suggestedName,
    filters: [{ name: 'DataWorkbench project', extensions: ['dwproj'] }]
  }
}
