export const HISTORY_LIMIT = 50

export interface HistoryPoint {
  x: number
  y: number
}

export interface HistoryEdge {
  connectionId: string
  fromId: string
  fromPort: string
  toId: string
  toPort: string
}

export type HistoryCommand =
  | {
      kind: 'addNode'
      nodeId: string
      qualifiedName: string
      position: HistoryPoint
      params: Record<string, unknown>
    }
  | {
      kind: 'removeNode'
      nodeId: string
      qualifiedName: string
      position: HistoryPoint
      params: Record<string, unknown>
      edges: HistoryEdge[]
    }
  | {
      kind: 'connect'
      connectionId: string
      fromId: string
      fromPort: string
      toId: string
      toPort: string
    }
  | {
      kind: 'disconnect'
      connectionId: string
      fromId: string
      fromPort: string
      toId: string
      toPort: string
    }
  | {
      kind: 'setParam'
      nodeId: string
      name: string
      oldValue: unknown
      newValue: unknown
    }
  | {
      kind: 'move'
      nodeId: string
      from: HistoryPoint
      to: HistoryPoint
    }

export function samePoint(a: HistoryPoint, b: HistoryPoint): boolean {
  return a.x === b.x && a.y === b.y
}
