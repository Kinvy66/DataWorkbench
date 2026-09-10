/**
 * LTTB for unit tests only. Production downsampling is Python chart.buildSeries.
 */
export function lttbIndices(x: number[], y: Array<number | null>, nOut: number): number[] {
  const n = x.length
  if (nOut >= n || nOut < 3) {
    return Array.from({ length: n }, (_, i) => i)
  }
  const yy = y.map((v) => (v == null || !Number.isFinite(v) ? 0 : v))
  const every = (n - 2) / (nOut - 2)
  const indices = new Array<number>(nOut)
  indices[0] = 0
  indices[nOut - 1] = n - 1
  let a = 0
  for (let i = 0; i < nOut - 2; i += 1) {
    const avgStart = Math.floor((i + 1) * every) + 1
    const avgEnd = Math.min(Math.floor((i + 2) * every) + 1, n)
    let avgX = 0
    let avgY = 0
    const avgCount = Math.max(avgEnd - avgStart, 1)
    for (let j = avgStart; j < avgEnd; j += 1) {
      avgX += x[j]
      avgY += yy[j]
    }
    avgX /= avgCount
    avgY /= avgCount
    const rangeOffs = Math.floor(i * every) + 1
    const rangeTo = Math.min(Math.max(Math.floor((i + 1) * every) + 1, rangeOffs + 1), n - 1)
    const ax = x[a]
    const ay = yy[a]
    let maxArea = -1
    let nextA = rangeOffs
    for (let j = rangeOffs; j < rangeTo; j += 1) {
      const area = Math.abs((ax - avgX) * (yy[j] - ay) - (ax - x[j]) * (avgY - ay))
      if (area > maxArea) {
        maxArea = area
        nextA = j
      }
    }
    indices[i + 1] = nextA
    a = nextA
  }
  return indices
}
