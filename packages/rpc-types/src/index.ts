/** JSON-RPC 2.0 method names and payload shapes shared by Electron and docs. */

export const APP_VERSION = '0.1.0'

export const JsonRpcErrorCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  DatasetNotFound: 1001,
  ColumnOrValidation: 1002,
  NodeTypeNotFound: 2001,
  DagCycle: 2002,
  WorkflowExecute: 2003,
  FileIo: 3001,
  Internal: 9001
} as const

export const FETCH_BLOCK_DEFAULT = 512
export const FETCH_BLOCK_MAX = 2048
export const CHART_MAX_POINTS_DEFAULT = 5000
export const CHART_MAX_POINTS_MAX = 20000

export const RpcMethod = {
  HostHello: 'host.hello',
  HostShutdown: 'host.shutdown',
  DataImport: 'data.import',
  DataList: 'data.list',
  DataGetSchema: 'data.getSchema',
  DataFetchBlock: 'data.fetchBlock',
  DataPatchCells: 'data.patchCells',
  DataRename: 'data.rename',
  DataRemove: 'data.remove',
  DataExport: 'data.export',
  DataRegister: 'data.register',
  DataDropNa: 'data.dropNa',
  DataDropDuplicates: 'data.dropDuplicates',
  DataQuery: 'data.query',
  DataEval: 'data.eval',
  DataSearch: 'data.search',
  DataSort: 'data.sort',
  DataFillNa: 'data.fillNa',
  DataInterpolate: 'data.interpolate',
  DataRemoveOutliersIqr: 'data.removeOutliersIqr',
  DataRemoveOutliersZscore: 'data.removeOutliersZscore',
  DataTransformSkewed: 'data.transformSkewed',
  DataReplaceValues: 'data.replaceValues',
  DataThresholdFilter: 'data.thresholdFilter',
  DataFilterByColumn: 'data.filterByColumn',
  DataDescribe: 'data.describe',
  DataPivotTable: 'data.pivotTable',
  WorkflowCreate: 'workflow.create',
  WorkflowListNodeTypes: 'workflow.listNodeTypes',
  WorkflowAddNode: 'workflow.addNode',
  WorkflowRemoveNode: 'workflow.removeNode',
  WorkflowSetParam: 'workflow.setParam',
  WorkflowConnect: 'workflow.connect',
  WorkflowDisconnect: 'workflow.disconnect',
  WorkflowExecute: 'workflow.execute',
  WorkflowPause: 'workflow.pause',
  WorkflowResume: 'workflow.resume',
  WorkflowStop: 'workflow.stop',
  WorkflowDumpLogic: 'workflow.dumpLogic',
  WorkflowLoadLogic: 'workflow.loadLogic',
  WorkflowGetGraph: 'workflow.getGraph',
  ChartListTypes: 'chart.listTypes',
  ChartBuildSeries: 'chart.buildSeries'
} as const

export type JsonRpcId = number | string

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: JsonRpcId
  method: string
  params?: unknown
}

export interface JsonRpcNotification {
  jsonrpc: '2.0'
  method: string
  params?: unknown
}

export interface JsonRpcSuccess {
  jsonrpc: '2.0'
  id: JsonRpcId
  result: unknown
}

export interface JsonRpcFailure {
  jsonrpc: '2.0'
  id: JsonRpcId | null
  error: {
    code: number
    message: string
    data?: { i18nKey?: string; [key: string]: unknown }
  }
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure

export interface HostHelloParams {
  appVersion: string
  workspaceRoot: string
}

export interface HostHelloResult {
  ok: true
  pythonVersion: string
  appVersion: string
  workspaceRoot: string
  pandasAvailable: boolean
}

export interface HostReadyParams {
  pid: number
  pandasAvailable: boolean
}

export interface ColumnSchema {
  name: string
  dtype: string
}

export interface DatasetListItem {
  id: string
  name: string
  rows: number
  cols: number
}

export interface DataImportParams {
  path: string
  format?: string
}

export interface DataImportResult {
  id: string
  name: string
  rows: number
  cols: number
  columns: ColumnSchema[]
}

export interface DataListResult {
  datasets: DatasetListItem[]
}

export interface DataGetSchemaParams {
  id: string
}

export interface DataGetSchemaResult {
  columns: ColumnSchema[]
  rowCount: number
}

export interface DataFetchBlockParams {
  id: string
  startRow: number
  rowCount?: number
}

export interface DataFetchBlockResult {
  startRow: number
  rows: unknown[][]
}

export const ARROW_ENCODING = 'arrow-v1' as const

export interface DataFetchBlockArrowHeader {
  encoding: typeof ARROW_ENCODING
  bytes: number
  meta: {
    rows: number
    startRow: number
  }
}

export interface CellPatch {
  row: number
  col: number
  value: unknown
}

export interface DataPatchCellsParams {
  id: string
  patches: CellPatch[]
}

export interface DataRenameParams {
  id: string
  name: string
}

export interface DataRemoveParams {
  id: string
}

export interface DataExportParams {
  id: string
  path: string
  format?: string
}

export interface DataRegisterParams {
  name: string
  handle?: unknown
}

export interface DataDropNaParams {
  id: string
  how?: 'any' | 'all' | string
  subset?: string[] | string
  minNonNa?: number
}

export interface DataDropNaResult {
  id: string
  name: string
  rows: number
  cols: number
  columns: ColumnSchema[]
  removedCount: number
}

export interface DataDropDuplicatesParams {
  id: string
  keep?: 'first' | 'last' | 'none' | string | boolean
  subset?: string[] | string
}

export interface DataDropDuplicatesResult {
  id: string
  name: string
  rows: number
  cols: number
  columns: ColumnSchema[]
  removedCount: number
}

export interface DataQueryParams {
  id: string
  queryString: string
}

export interface DataQueryResult {
  id: string
  name: string
  rows: number
  cols: number
  columns: ColumnSchema[]
  matchedCount: number
  removedCount: number
}

export interface DataEvalParams {
  id: string
  expression: string
}

export interface DataEvalResult {
  id: string
  name: string
  rows: number
  cols: number
  columns: ColumnSchema[]
}

export interface DataSearchParams {
  id: string
  column: string
  pattern: string
  caseSensitive?: boolean
}

export interface DataSearchResult {
  id: string
  name: string
  rows: number
  cols: number
  columns: ColumnSchema[]
  matchedCount: number
  removedCount: number
}

export interface DataSortParams {
  id: string
  columns: string[] | string
  ascending?: boolean
}

export interface DataSortResult {
  id: string
  name: string
  rows: number
  cols: number
  columns: ColumnSchema[]
}

export interface DataFillNaParams {
  id: string
  method?: string
  subset?: string[] | string
  value?: string | number | boolean | null
}

export interface DataFillNaResult {
  id: string
  name: string
  rows: number
  cols: number
  columns: ColumnSchema[]
  filledCount: number
}

export interface DataInterpolateParams {
  id: string
  method?: string
  subset?: string[] | string
  limit?: number | null
  order?: number
}

export interface DataInterpolateResult {
  id: string
  name: string
  rows: number
  cols: number
  columns: ColumnSchema[]
  filledCount: number
}

export interface DataRemoveOutliersIqrParams {
  id: string
  multiplier?: number
  action?: string
  customValue?: number
  reindex?: boolean
  subset?: string[] | string
}

export interface DataRemoveOutliersIqrResult {
  id: string
  name: string
  rows: number
  cols: number
  columns: ColumnSchema[]
  action: string
  removedCount: number
  replacedCount: number
}

export interface DataRemoveOutliersZscoreParams {
  id: string
  threshold?: number
  robust?: boolean
  action?: string
  customValue?: number
  reindex?: boolean
  subset?: string[] | string
}

export interface DataRemoveOutliersZscoreResult {
  id: string
  name: string
  rows: number
  cols: number
  columns: ColumnSchema[]
  action: string
  robust: boolean
  removedCount: number
  replacedCount: number
}

export interface DataTransformSkewedParams {
  id: string
  method?: string
  lambdaValue?: number
  addOne?: boolean
  subset?: string[] | string
}

export interface DataTransformSkewedResult {
  id: string
  name: string
  rows: number
  cols: number
  columns: ColumnSchema[]
  method: string
  transformedCount: number
  changedCount: number
}

export interface DataReplaceValuesParams {
  id: string
  oldValues?: string[] | string
  newValue?: string | number | boolean | null
  subset?: string[] | string
  caseSensitive?: boolean
}

export interface DataReplaceValuesResult {
  id: string
  name: string
  rows: number
  cols: number
  columns: ColumnSchema[]
  replacedCount: number
}

export interface DataThresholdFilterParams {
  id: string
  filterType?: string
  lower?: number
  upper?: number
  subset?: string[] | string
  rowLogic?: 'any' | 'all' | string
  treatNan?: boolean
}

export interface DataThresholdFilterResult {
  id: string
  name: string
  rows: number
  cols: number
  columns: ColumnSchema[]
  removedCount: number
}

export interface DataFilterByColumnParams {
  id: string
  column: string
  min?: number | null
  max?: number | null
}

export interface DataFilterByColumnResult {
  id: string
  name: string
  rows: number
  cols: number
  columns: ColumnSchema[]
  matchedCount: number
  removedCount: number
}

export interface DataDescribeParams {
  id: string
  percentiles?: number[] | string
  name?: string
}

export interface DataDescribeResult {
  id: string
  name: string
  rows: number
  cols: number
  columns: ColumnSchema[]
}

export interface DataPivotTableParams {
  id: string
  index: string[] | string
  columns?: string[] | string
  values?: string[] | string
  aggfunc?: string
  margins?: boolean
  marginsName?: string
  sort?: boolean
  name?: string
}

export interface DataPivotTableResult {
  id: string
  name: string
  rows: number
  cols: number
  columns: ColumnSchema[]
  aggfunc: string
}

export interface OkResult {
  ok: true
}

export interface DialogCancelled {
  cancelled: true
}

export interface WorkflowPortSpec {
  name: string
  type: string
  required?: boolean
}

export interface WorkflowParamSpec {
  name: string
  type: string
  description?: string
  default?: unknown
  min?: number
  max?: number
  step?: number
  decimals?: number
  layout?: 'inline' | 'below'
  height?: number
  choices?: string[]
}

export interface WorkflowNodeType {
  qualifiedName: string
  name: string
  category: string
  inputs: WorkflowPortSpec[]
  outputs: WorkflowPortSpec[]
  parameters: WorkflowParamSpec[]
  bodyShape?: string
}

export interface WorkflowListNodeTypesResult {
  types: WorkflowNodeType[]
}

export interface WorkflowCreateParams {
  name?: string
}

export interface WorkflowCreateResult {
  workflowId: string
  name: string
}

export interface WorkflowIdParams {
  workflowId: string
}

export interface WorkflowAddNodeParams {
  workflowId: string
  qualifiedName: string
  nodeId?: string
  position?: { x: number; y: number }
}

export interface WorkflowAddNodeResult {
  nodeId: string
  qualifiedName: string
}

export interface WorkflowRemoveNodeParams {
  workflowId: string
  nodeId: string
}

export interface WorkflowSetParamParams {
  workflowId: string
  nodeId: string
  name: string
  value: unknown
}

export interface WorkflowConnectParams {
  workflowId: string
  fromId: string
  fromPort: string
  toId: string
  toPort: string
  connectionId?: string
}

export interface WorkflowConnectResult {
  connectionId: string
}

export interface WorkflowDisconnectParams {
  workflowId: string
  connectionId?: string
  fromId?: string
  fromPort?: string
  toId?: string
  toPort?: string
}

export interface WorkflowDumpLogicParams {
  workflowId: string
  format?: 'json' | 'xml'
}

export interface WorkflowDumpLogicResult {
  format: 'json' | 'xml'
  payload: unknown
}

export interface WorkflowLoadLogicParams {
  payload: unknown
  format?: 'json' | 'xml'
  workflowId?: string
}

export interface WorkflowLoadLogicResult {
  workflowId: string
  name: string
}

export interface WorkflowGraphNode {
  nodeId: string
  qualifiedName: string
  parameters: Record<string, unknown>
  runtimeState?: {
    displayText?: string
  }
}

export interface WorkflowGraphConnection {
  connectionId: string
  fromId: string
  fromPort: string
  toId: string
  toPort: string
}

export interface WorkflowGetGraphResult {
  workflowId: string
  name: string
  nodes: WorkflowGraphNode[]
  connections: WorkflowGraphConnection[]
}

export interface WorkflowExecuteResult {
  accepted: true
  workflowId: string
}

export interface WorkflowNodeStateParams {
  workflowId: string
  nodeId: string
  state: 'idle' | 'running' | 'ok' | 'error'
  message?: string
  displayText?: string
}

export interface WorkflowFinishedParams {
  workflowId: string
  ok: boolean
  error?: string
  cancelled?: boolean
}

export type ChartTypeId = 'line' | 'scatter' | 'bar' | 'hist'
export type ChartXKind = 'number' | 'time'

export interface ChartTypeItem {
  id: ChartTypeId
  name: string
}

export interface ChartListTypesResult {
  types: ChartTypeItem[]
}

export interface ChartBuildSeriesParams {
  dataId: string
  x: string
  y: string[]
  maxPoints?: number
  xMin?: number
  xMax?: number
}

export interface ChartBuildSeriesResult {
  x: Array<number | null>
  ys: Array<Array<number | null>>
  pointCount: number
  sourceCount: number
  downsampled: boolean
  xKind: ChartXKind
  maxPoints: number
}
