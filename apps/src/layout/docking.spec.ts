import { describe, expect, it } from 'vitest'
import { DEFAULT_PROJECT_SPLITS } from '@dw/rpc-types'
import {
  collectDockPanelIds,
  defaultDockingConfig,
  dockingIsComplete,
  persistableDocking,
  sanitizeDocking
} from './docking'

const titles = {
  datasets: 'Datasets',
  nodes: 'Nodes',
  table: 'Table',
  workflow: 'Workflow',
  figure: 'Figure',
  properties: 'Properties',
  log: 'Log'
}

describe('defaultDockingConfig', () => {
  it('places the seven workbench panels and respects active tabs', () => {
    const config = defaultDockingConfig({
      splits: DEFAULT_PROJECT_SPLITS,
      centerTab: 'figure',
      leftTab: 'nodes',
      titles
    })
    const ids = collectDockPanelIds(config)
    expect([...ids].sort()).toEqual([
      'datasets',
      'figure',
      'log',
      'nodes',
      'properties',
      'table',
      'workflow'
    ])
    expect(dockingIsComplete(config)).toBe(true)
    const row = config.root && 'content' in config.root ? config.root.content?.[0] : undefined
    const stacks = row && 'content' in row ? row.content : undefined
    expect(stacks?.[0]).toMatchObject({ type: 'stack', activeItemIndex: 1 })
    expect(stacks?.[1]).toMatchObject({ type: 'stack', activeItemIndex: 2 })
    const logStack = config.root && 'content' in config.root ? config.root.content?.[1] : undefined
    expect(logStack).toMatchObject({ type: 'stack', minSize: '72px' })
  })

  it('falls back when a saved docking config is missing a panel', () => {
    const fallback = defaultDockingConfig({ titles })
    expect(sanitizeDocking({ root: { type: 'row', content: [] } }, fallback)).toBe(fallback)
    expect(sanitizeDocking(fallback, fallback)).toBe(fallback)
    expect(persistableDocking({ ...fallback, openPopouts: [{ dummy: true } as never] }).openPopouts).toEqual(
      []
    )
  })
})
