import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PROJECT_FORMAT, PROJECT_MAGIC } from '@dw/rpc-types'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PROJECT_SPLITS,
  normalizeUiLayout,
  openProjectArchive,
  saveProjectArchive,
  validateManifest,
  withProjectExtension
} from './project-io'
import { ProjectFileError } from './project-zip'

describe('project archive helpers', () => {
  it('appends .dwproj when missing', () => {
    expect(withProjectExtension('C:\\tmp\\run')).toMatch(/run\.dwproj$/)
    expect(withProjectExtension('C:\\tmp\\run.csv')).toMatch(/run\.dwproj$/)
  })

  it('rejects a bad magic and unsupported format', () => {
    expect(() => validateManifest({ magic: 'nope', format: 1 })).toThrow(ProjectFileError)
    expect(() => validateManifest({ magic: PROJECT_MAGIC, format: 99 })).toThrow(/newer/)
    expect(() => validateManifest({ magic: PROJECT_MAGIC, format: PROJECT_FORMAT })).not.toThrow()
  })

  it('fills missing ui-layout fields', () => {
    const layout = normalizeUiLayout({ centerTab: 'figure', nodes: { a: { x: 10, y: 20 } } })
    expect(layout.centerTab).toBe('figure')
    expect(layout.leftTab).toBe('datasets')
    expect(layout.splits).toEqual(DEFAULT_PROJECT_SPLITS)
    expect(layout.nodes.a).toEqual({ x: 10, y: 20 })
  })

  it('saves then opens layout and charts without sampled points', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dw-proj-io-'))
    try {
      const dest = join(dir, 'demo.dwproj')
      await saveProjectArchive({
        dest,
        workflowLogic: { name: 'untitle', version: '1.0', nodes: [], connections: [] },
        uiLayout: {
          centerTab: 'workflow',
          leftTab: 'nodes',
          currentDataId: 'ds-1',
          splits: DEFAULT_PROJECT_SPLITS,
          nodes: { n1: { x: 40, y: 80 } }
        },
        charts: {
          currentId: 'c1',
          charts: [
            {
              id: 'c1',
              type: 'line',
              dataId: 'ds-1',
              x: 't',
              y: ['ch1'],
              title: 'wave',
              xLabel: 't',
              yLabel: 'ch1',
              grid: true,
              legend: true,
              series: [{ key: 'ch1', color: '#5280C1', width: 1.5 }]
            }
          ]
        },
        packLogic: async (staging) => {
          mkdirSync(join(staging, 'datas'))
          writeFileSync(join(staging, 'data-manager.json'), '[]')
        }
      })
      const opened = await openProjectArchive({
        src: dest,
        unpackLogic: async () => ({ workflowId: 'wf-1', datasets: [] })
      })
      expect(opened.workflowId).toBe('wf-1')
      expect(opened.uiLayout.nodes.n1).toEqual({ x: 40, y: 80 })
      expect(opened.charts.charts[0]?.y).toEqual(['ch1'])
      expect(JSON.stringify(opened.charts)).not.toContain('"data":')
      expect(readFileSync(dest).length).toBeGreaterThan(20)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
