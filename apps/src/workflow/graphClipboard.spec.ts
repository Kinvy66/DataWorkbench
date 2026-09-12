import { describe, expect, it } from 'vitest'
import { WORKFLOW_PASTE_OFFSET, offsetWorkflowClip, snapshotWorkflowClip } from './graphClipboard'

describe('workflow graph clipboard', () => {
  it('snapshots selected nodes and edges that stay inside the selection', () => {
    const clip = snapshotWorkflowClip({
      nodes: [
        {
          id: 'a',
          selected: true,
          position: { x: 10, y: 20 },
          data: { qualifiedName: 'sys.A' }
        },
        {
          id: 'b',
          selected: true,
          position: { x: 40, y: 80 },
          data: { qualifiedName: 'sys.B' }
        },
        {
          id: 'c',
          selected: false,
          position: { x: 0, y: 0 },
          data: { qualifiedName: 'sys.C' }
        }
      ],
      edges: [
        { source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'in' },
        { source: 'a', target: 'c', sourceHandle: 'out', targetHandle: 'in' }
      ],
      params: { a: { n: 1 }, b: { n: 2 } }
    })
    expect(clip?.nodes).toHaveLength(2)
    expect(clip?.edges).toEqual([{ fromIndex: 0, fromPort: 'out', toIndex: 1, toPort: 'in' }])
    expect(clip?.nodes[0]?.params).toEqual({ n: 1 })
  })

  it('falls back to the focused node when nothing is marked selected', () => {
    const clip = snapshotWorkflowClip({
      nodes: [
        {
          id: 'only',
          position: { x: 1, y: 2 },
          data: { qualifiedName: 'sys.Only' }
        }
      ],
      edges: [],
      params: {},
      fallbackId: 'only'
    })
    expect(clip?.nodes).toEqual([
      { qualifiedName: 'sys.Only', position: { x: 1, y: 2 }, params: {} }
    ])
  })

  it('offsets pasted nodes without sharing the original objects', () => {
    const clip = {
      nodes: [{ qualifiedName: 'sys.A', position: { x: 0, y: 0 }, params: { v: 1 } }],
      edges: []
    }
    const next = offsetWorkflowClip(clip, WORKFLOW_PASTE_OFFSET, WORKFLOW_PASTE_OFFSET)
    expect(next.nodes[0]?.position).toEqual({ x: 48, y: 48 })
    expect(next.nodes[0]?.params).toEqual({ v: 1 })
    next.nodes[0]!.params.v = 9
    expect(clip.nodes[0]?.params.v).toBe(1)
  })
})
