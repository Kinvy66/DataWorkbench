/** JSON-RPC 2.0 method names and payload shapes shared by Electron and docs. */

export const APP_VERSION = '0.1.0'

export const JsonRpcErrorCode = {
  ParseError: -32700,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  Internal: 9001
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
