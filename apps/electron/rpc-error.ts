export const DW_RPC_ERROR = '__dwRpcError'

export type DwRpcErrorPayload = {
  [DW_RPC_ERROR]: true
  code: number
  message: string
  i18nKey?: string
}

export class RpcError extends Error {
  readonly code: number
  readonly i18nKey?: string

  constructor(code: number, message: string, i18nKey?: string) {
    super(encodeRpcErrorMessage(message, i18nKey))
    this.name = 'RpcError'
    this.code = code
    this.i18nKey = i18nKey
  }

  toPayload(): DwRpcErrorPayload {
    return {
      [DW_RPC_ERROR]: true,
      code: this.code,
      message: this.message,
      i18nKey: this.i18nKey
    }
  }
}

export function isDwRpcErrorPayload(value: unknown): value is DwRpcErrorPayload {
  return typeof value === 'object' && value !== null && (value as DwRpcErrorPayload)[DW_RPC_ERROR] === true
}

export function encodeRpcErrorMessage(message: string, i18nKey?: string): string {
  if (!i18nKey) {
    return message
  }
  return `${message} [@@${i18nKey}]`
}

export function rpcTimeoutMs(method: string): number {
  if (
    method === 'data.import' ||
    method === 'chart.buildSeries' ||
    method.startsWith('project.')
  ) {
    return 120_000
  }
  if (method === 'workflow.execute') {
    return 0
  }
  return 30_000
}
