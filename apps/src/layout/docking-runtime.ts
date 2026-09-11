let capture: (() => Record<string, unknown> | null) | null = null

export function registerDockingCapture(fn: (() => Record<string, unknown> | null) | null): void {
  capture = fn
}

export function captureLiveDocking(): Record<string, unknown> | null {
  try {
    return capture ? capture() : null
  } catch {
    return null
  }
}
