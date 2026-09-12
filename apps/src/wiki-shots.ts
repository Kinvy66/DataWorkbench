/** Files written under docs/assets/wiki by the DW_WIKI_CAPTURE pass. */
export const WIKI_SHOT_FILES = [
  'interface-raw.png',
  'interface-overview.png',
  '01-ready.png',
  '03-data-tab.png',
  '03-table.png',
  '04-operate-tab.png',
  '04-dropna-dialog.png',
  '04-query-dialog.png',
  '05-nodes.png',
  '05-workflow.png',
  '06-chart-tab.png',
  '06-bind-dialog.png',
  '06-chart.png',
  '07-file-menu.png'
] as const

export type WikiShotFile = (typeof WIKI_SHOT_FILES)[number]
