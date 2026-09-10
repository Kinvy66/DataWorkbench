export type ViewportWindow = {
  xMin: number
  xMax: number
}

export type ViewportKind = 'line' | 'scatter' | 'bar' | 'hist'

export function dataXFromScale(
  min: number,
  max: number,
  xKind: 'number' | 'time'
): ViewportWindow {
  if (xKind === 'time') {
    return { xMin: min * 1000, xMax: max * 1000 }
  }
  return { xMin: min, xMax: max }
}

export function rangesNearlyEqual(a: ViewportWindow, b: ViewportWindow, span: number): boolean {
  const tol = Math.max(Math.abs(span) * 1e-6, 1e-9)
  return Math.abs(a.xMin - b.xMin) <= tol && Math.abs(a.xMax - b.xMax) <= tol
}

export function dataExtent(x: Array<number | null | undefined>): ViewportWindow {
  let xMin = Infinity
  let xMax = -Infinity
  for (const value of x) {
    if (value == null || !Number.isFinite(value)) {
      continue
    }
    if (value < xMin) {
      xMin = value
    }
    if (value > xMax) {
      xMax = value
    }
  }
  if (!Number.isFinite(xMin) || !Number.isFinite(xMax)) {
    return { xMin: 0, xMax: 1 }
  }
  if (xMin === xMax) {
    return { xMin: xMin - 1, xMax: xMax + 1 }
  }
  return { xMin, xMax }
}

export function planViewportRequest(input: {
  range: ViewportWindow
  currentWindow: ViewportWindow | null
  dataExtent: ViewportWindow
  downsampled: boolean
  sourceCount: number
  maxPoints: number
  kind?: ViewportKind
}): ViewportWindow | null {
  const windowed = input.currentWindow != null
  const isHist = input.kind === 'hist'
  if (!isHist && !windowed && !input.downsampled && input.sourceCount <= input.maxPoints) {
    return null
  }
  const baseline = input.currentWindow ?? input.dataExtent
  const span = Math.max(
    Math.abs(baseline.xMax - baseline.xMin),
    Math.abs(input.range.xMax - input.range.xMin),
    1e-12
  )
  if (rangesNearlyEqual(input.range, baseline, span)) {
    return null
  }
  return input.range
}

export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  ms: number
): ((...args: Args) => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null
  const wrapped = ((...args: Args) => {
    if (timer != null) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => {
      timer = null
      fn(...args)
    }, ms)
  }) as ((...args: Args) => void) & { cancel: () => void }
  wrapped.cancel = () => {
    if (timer != null) {
      clearTimeout(timer)
      timer = null
    }
  }
  return wrapped
}
