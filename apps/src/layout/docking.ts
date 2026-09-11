import { DEFAULT_PROJECT_SPLITS, type ProjectSplits } from '@dw/rpc-types'
import { LayoutConfig } from 'golden-layout'

export const DOCK_PANELS = [
  'datasets',
  'nodes',
  'table',
  'workflow',
  'figure',
  'properties',
  'log'
] as const

export type DockPanelId = (typeof DOCK_PANELS)[number]

export const LEFT_DOCK_PANELS = ['datasets', 'nodes'] as const
export const CENTER_DOCK_PANELS = ['table', 'workflow', 'figure'] as const

export type DockTitles = Record<DockPanelId, string>

export function isDockPanelId(value: string): value is DockPanelId {
  return (DOCK_PANELS as readonly string[]).includes(value)
}

export function collectDockPanelIds(raw: unknown, into: Set<string> = new Set()): Set<string> {
  if (!raw || typeof raw !== 'object') {
    return into
  }
  const node = raw as Record<string, unknown>
  if (node.type === 'component' && typeof node.componentType === 'string') {
    into.add(node.componentType)
  }
  if (node.root) {
    collectDockPanelIds(node.root, into)
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      collectDockPanelIds(child, into)
    }
  }
  return into
}

export function dockingIsComplete(raw: unknown): boolean {
  const ids = collectDockPanelIds(raw)
  return DOCK_PANELS.every((id) => ids.has(id))
}

function panel(
  id: DockPanelId,
  title: string
): { type: 'component'; componentType: DockPanelId; id: DockPanelId; title: string; isClosable: false } {
  return { type: 'component', componentType: id, id, title, isClosable: false }
}

export function defaultDockingConfig(options: {
  splits?: ProjectSplits
  centerTab?: 'table' | 'workflow' | 'figure'
  leftTab?: 'datasets' | 'nodes'
  titles: DockTitles
  maximiseLabel?: string
}): LayoutConfig {
  const splits = options.splits ?? DEFAULT_PROJECT_SPLITS
  const centerTab = options.centerTab ?? 'table'
  const leftTab = options.leftTab ?? 'datasets'
  const titles = options.titles
  const leftIndex = leftTab === 'nodes' ? 1 : 0
  const centerIndex = centerTab === 'workflow' ? 1 : centerTab === 'figure' ? 2 : 0
  return {
    settings: {
      constrainDragToContainer: true,
      reorderEnabled: true,
      blockedPopoutsThrowError: false
    },
    header: {
      show: 'top',
      popout: false,
      close: false,
      maximise: options.maximiseLabel || 'Maximise'
    },
    root: {
      type: 'column',
      content: [
        {
          type: 'row',
          size: `${splits.main}%`,
          content: [
            {
              type: 'stack',
              size: `${splits.left}%`,
              activeItemIndex: leftIndex,
              content: [panel('datasets', titles.datasets), panel('nodes', titles.nodes)]
            },
            {
              type: 'stack',
              size: `${splits.center}%`,
              activeItemIndex: centerIndex,
              content: [
                panel('table', titles.table),
                panel('workflow', titles.workflow),
                panel('figure', titles.figure)
              ]
            },
            {
              type: 'stack',
              size: `${splits.properties}%`,
              content: [panel('properties', titles.properties)]
            }
          ]
        },
        {
          type: 'stack',
          size: `${splits.log}%`,
          minSize: '72px',
          content: [panel('log', titles.log)]
        }
      ]
    }
  }
}

export function asLayoutConfig(raw: unknown): LayoutConfig | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }
  if (LayoutConfig.isResolved(raw as LayoutConfig)) {
    return LayoutConfig.fromResolved(raw as Parameters<typeof LayoutConfig.fromResolved>[0])
  }
  return raw as LayoutConfig
}

export function persistableDocking(config: LayoutConfig): Record<string, unknown> {
  return { ...config, openPopouts: [] } as unknown as Record<string, unknown>
}

export function sanitizeDocking(raw: unknown, fallback: LayoutConfig): LayoutConfig {
  const config = asLayoutConfig(raw)
  if (!config || !dockingIsComplete(config)) {
    return fallback
  }
  return config
}
