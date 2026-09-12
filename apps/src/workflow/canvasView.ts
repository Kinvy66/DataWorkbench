/** Vue Flow view ops for the active workflow canvas (not stored in Pinia). */

export type WorkflowCanvasView = {
  zoomIn: () => void
  zoomOut: () => void
  fitView: () => void
}

let current: WorkflowCanvasView | null = null

export function bindWorkflowCanvasView(ops: WorkflowCanvasView | null): void {
  current = ops
}

export function workflowCanvasView(): WorkflowCanvasView | null {
  return current
}
