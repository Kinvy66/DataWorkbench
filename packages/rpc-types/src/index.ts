/** JSON-RPC 2.0 method names and payload shapes shared by Electron and docs. */

export const APP_VERSION = '0.1.0'

export const JsonRpcErrorCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  DatasetNotFound: 1001,
  ColumnOrValidation: 1002,
  FileIo: 3001,
  Internal: 9001
} as const

export const FETCH_BLOCK_DEFAULT = 512
export const FETCH_BLOCK_MAX = 2048

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
  DataRegister: 'data.register'
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

export interface OkResult {
  ok: true
}

export interface DialogCancelled {
  cancelled: true
}
