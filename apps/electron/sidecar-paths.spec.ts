import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { findPythonRoot, resolvePythonCommand } from './sidecar-paths'

describe('findPythonRoot', () => {
  it('prefers DW_PYTHON_ROOT when it contains dw_host', () => {
    const root = path.join('D:', 'bundle', 'python')
    const marker = path.join(root, 'dw_host', '__main__.py')
    expect(
      findPythonRoot({
        startDir: path.join('D:', 'elsewhere'),
        resourcesPath: path.join('D:', 'app', 'resources'),
        env: { DW_PYTHON_ROOT: root },
        exists: (candidate) => candidate === marker
      })
    ).toBe(root)
  })

  it('uses extraResources python next to a packaged Electron app', () => {
    const resourcesPath = path.join('D:', 'DataWorkbench', 'resources')
    const packed = path.join(resourcesPath, 'python')
    const marker = path.join(packed, 'dw_host', '__main__.py')
    expect(
      findPythonRoot({
        startDir: path.join(resourcesPath, 'app.asar', 'out', 'main'),
        cwd: path.join('D:', 'DataWorkbench'),
        resourcesPath,
        env: {},
        exists: (candidate) => candidate === marker
      })
    ).toBe(packed)
  })

  it('walks up to the repo python/ folder in development', () => {
    const repo = path.join('D:', 'Rep', 'DataWorkbench')
    const nested = path.join(repo, 'python')
    const marker = path.join(nested, 'dw_host', '__main__.py')
    expect(
      findPythonRoot({
        startDir: path.join(repo, 'apps', 'out', 'main'),
        cwd: repo,
        env: {},
        exists: (candidate) => candidate === marker
      })
    ).toBe(nested)
  })
})

describe('resolvePythonCommand', () => {
  it('uses DW_PYTHON before a venv', () => {
    expect(
      resolvePythonCommand({
        pythonRoot: path.join('D:', 'python'),
        platform: 'win32',
        env: { DW_PYTHON: 'C:\\Python312\\python.exe' },
        exists: () => true
      })
    ).toEqual({ cmd: 'C:\\Python312\\python.exe', args: [], source: 'env' })
  })

  it('uses the sidecar venv on Windows when present', () => {
    const pythonRoot = path.join('D:', 'python')
    const venv = path.join(pythonRoot, '.venv', 'Scripts', 'python.exe')
    expect(
      resolvePythonCommand({
        pythonRoot,
        platform: 'win32',
        env: {},
        exists: (candidate) => candidate === venv
      })
    ).toEqual({ cmd: venv, args: [], source: 'venv' })
  })

  it('uses bundled python-runtime when no venv is packed', () => {
    const resourcesPath = path.join('D:', 'DataWorkbench', 'resources')
    const bundled = path.join(resourcesPath, 'python-runtime', 'python.exe')
    expect(
      resolvePythonCommand({
        pythonRoot: path.join(resourcesPath, 'python'),
        resourcesPath,
        platform: 'win32',
        env: {},
        exists: (candidate) => candidate === bundled
      })
    ).toEqual({ cmd: bundled, args: [], source: 'bundled' })
  })

  it('prefers venv over bundled python-runtime', () => {
    const pythonRoot = path.join('D:', 'python')
    const venv = path.join(pythonRoot, '.venv', 'Scripts', 'python.exe')
    const bundled = path.join('D:', 'app', 'resources', 'python-runtime', 'python.exe')
    expect(
      resolvePythonCommand({
        pythonRoot,
        resourcesPath: path.join('D:', 'app', 'resources'),
        platform: 'win32',
        env: {},
        exists: (candidate) => candidate === venv || candidate === bundled
      })
    ).toEqual({ cmd: venv, args: [], source: 'venv' })
  })

  it('falls back to the Windows py launcher when no venv or runtime is packed', () => {
    expect(
      resolvePythonCommand({
        pythonRoot: path.join('D:', 'app', 'resources', 'python'),
        resourcesPath: path.join('D:', 'app', 'resources'),
        platform: 'win32',
        env: {},
        exists: () => false
      })
    ).toEqual({ cmd: 'py', args: ['-3.12'], source: 'system' })
  })
})
