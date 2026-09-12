export const WORKFLOW_PASTE_OFFSET = 48

export type WorkflowClipNode = {
  qualifiedName: string
  position: { x: number; y: number }
  params: Record<string, unknown>
}

export type WorkflowClipEdge = {
  fromIndex: number
  fromPort: string
  toIndex: number
  toPort: string
}

export type WorkflowClip = {
  nodes: WorkflowClipNode[]
  edges: WorkflowClipEdge[]
}

export function snapshotWorkflowClip(input: {
  nodes: Array<{
    id: string
    selected?: boolean
    position: { x: number; y: number }
    data?: { qualifiedName?: string }
  }>
  edges: Array<{ source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }>
  params: Record<string, Record<string, unknown>>
  fallbackId?: string | null
}): WorkflowClip | null {
  let ids = input.nodes.filter((node) => node.selected).map((node) => node.id)
  if (ids.length === 0 && input.fallbackId) {
    ids = [input.fallbackId]
  }
  if (ids.length === 0) {
    return null
  }
  const indexOf = new Map(ids.map((id, index) => [id, index]))
  const nodes: WorkflowClipNode[] = []
  for (const id of ids) {
    const node = input.nodes.find((item) => item.id === id)
    if (!node) {
      continue
    }
    nodes.push({
      qualifiedName: String(node.data?.qualifiedName ?? ''),
      position: { x: node.position.x, y: node.position.y },
      params: { ...(input.params[id] ?? {}) }
    })
  }
  if (!nodes.length || nodes.some((node) => !node.qualifiedName)) {
    return null
  }
  const edges: WorkflowClipEdge[] = []
  for (const edge of input.edges) {
    const fromIndex = indexOf.get(edge.source)
    const toIndex = indexOf.get(edge.target)
    if (fromIndex === undefined || toIndex === undefined) {
      continue
    }
    const fromPort = String(edge.sourceHandle ?? '')
    const toPort = String(edge.targetHandle ?? '')
    if (!fromPort || !toPort) {
      continue
    }
    edges.push({ fromIndex, fromPort, toIndex, toPort })
  }
  return { nodes, edges }
}

export function offsetWorkflowClip(clip: WorkflowClip, dx: number, dy: number): WorkflowClip {
  return {
    nodes: clip.nodes.map((node) => ({
      ...node,
      params: { ...node.params },
      position: { x: node.position.x + dx, y: node.position.y + dy }
    })),
    edges: clip.edges.map((edge) => ({ ...edge }))
  }
}
