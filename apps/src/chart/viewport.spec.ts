import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  dataExtent,
  dataXFromScale,
  debounce,
  planViewportRequest,
  rangesNearlyEqual
} from '@dw/chart-core'
import { CHART_VIEWPORT_DEBOUNCE_MS } from '@dw/rpc-types'

describe('viewport helpers', () => {
  it('converts time scales from seconds to epoch ms', () => {
    expect(dataXFromScale(1.5, 3, 'time')).toEqual({ xMin: 1500, xMax: 3000 })
    expect(dataXFromScale(1.5, 3, 'number')).toEqual({ xMin: 1.5, xMax: 3 })
  })

  it('treats nearby ranges as equal', () => {
    const span = 1_000_000
    expect(
      rangesNearlyEqual({ xMin: 0, xMax: span }, { xMin: 0.4, xMax: span }, span)
    ).toBe(true)
    expect(
      rangesNearlyEqual({ xMin: 0, xMax: span }, { xMin: 10, xMax: span }, span)
    ).toBe(false)
  })

  it('reads finite x extent and skips nulls', () => {
    expect(dataExtent([null, 2, 8, Number.NaN, 5])).toEqual({ xMin: 2, xMax: 8 })
  })

  it('does not refetch small line charts that still show the full column', () => {
    expect(
      planViewportRequest({
        range: { xMin: 10, xMax: 20 },
        currentWindow: null,
        dataExtent: { xMin: 0, xMax: 99 },
        downsampled: false,
        sourceCount: 100,
        maxPoints: 5000,
        kind: 'line'
      })
    ).toBeNull()
  })

  it('refetches a downsampled overview when the scale leaves the data extent', () => {
    expect(
      planViewportRequest({
        range: { xMin: 10, xMax: 20 },
        currentWindow: null,
        dataExtent: { xMin: 0, xMax: 99 },
        downsampled: true,
        sourceCount: 1_000_000,
        maxPoints: 5000,
        kind: 'line'
      })
    ).toEqual({ xMin: 10, xMax: 20 })
  })

  it('skips the initial scale that matches the overview extent', () => {
    expect(
      planViewportRequest({
        range: { xMin: 0, xMax: 99 },
        currentWindow: null,
        dataExtent: { xMin: 0, xMax: 99 },
        downsampled: true,
        sourceCount: 1_000_000,
        maxPoints: 5000
      })
    ).toBeNull()
  })

  it('refetches a pan even when the current window is not downsampled', () => {
    expect(
      planViewportRequest({
        range: { xMin: 40, xMax: 80 },
        currentWindow: { xMin: 10, xMax: 50 },
        dataExtent: { xMin: 10, xMax: 50 },
        downsampled: false,
        sourceCount: 200,
        maxPoints: 5000,
        kind: 'line'
      })
    ).toEqual({ xMin: 40, xMax: 80 })
  })

  it('rebuilds histograms when the value axis zooms', () => {
    expect(
      planViewportRequest({
        range: { xMin: 0.2, xMax: 0.4 },
        currentWindow: null,
        dataExtent: { xMin: 0, xMax: 1 },
        downsampled: false,
        sourceCount: 100,
        maxPoints: 50,
        kind: 'hist'
      })
    ).toEqual({ xMin: 0.2, xMax: 0.4 })
  })
})

describe('debounce', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls once with the last arguments after the wait', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const wrapped = debounce(fn, CHART_VIEWPORT_DEBOUNCE_MS)
    wrapped(1)
    wrapped(2)
    vi.advanceTimersByTime(CHART_VIEWPORT_DEBOUNCE_MS - 1)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(2)
  })

  it('cancel drops a pending call', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const wrapped = debounce(fn, CHART_VIEWPORT_DEBOUNCE_MS)
    wrapped(1)
    wrapped.cancel()
    vi.advanceTimersByTime(CHART_VIEWPORT_DEBOUNCE_MS)
    expect(fn).not.toHaveBeenCalled()
  })
})
