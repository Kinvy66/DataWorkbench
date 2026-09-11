import fs from 'node:fs'
import path from 'node:path'

export type PathExists = (candidate: string) => boolean

const defaultExists: PathExists = (candidate) => fs.existsSync(candidate)

function isPythonRoot(dir: string, exists: PathExists): boolean {
  return exists(path.join(dir, 'dw_host', '__main__.py'))
}

export type FindPythonRootInput = {
  startDir: string
  cwd?: string
  resourcesPath?: string
  env?: NodeJS.ProcessEnv
  exists?: PathExists
}

export function findPythonRoot(input: FindPythonRootInput): string {
  const exists = input.exists ?? defaultExists
  const env = input.env ?? process.env
  const fromEnv = env.DW_PYTHON_ROOT
  if (fromEnv && isPythonRoot(fromEnv, exists)) {
    return fromEnv
  }
  if (input.resourcesPath) {
    const packed = path.join(input.resourcesPath, 'python')
    if (isPythonRoot(packed, exists)) {
      return packed
    }
  }
  const starts = [input.startDir, input.cwd ?? process.cwd()]
  for (const start of starts) {
    let dir = start
    for (let i = 0; i < 12; i++) {
      const nested = path.join(dir, 'python')
      if (isPythonRoot(nested, exists)) {
        return nested
      }
      if (isPythonRoot(dir, exists)) {
        return dir
      }
      const parent = path.dirname(dir)
      if (parent === dir) {
        break
      }
      dir = parent
    }
  }
  throw new Error(
    'Cannot find Python sidecar (dw_host missing). Set DW_PYTHON_ROOT or install a complete packaged build.'
  )
}

export type ResolvePythonCommandInput = {
  pythonRoot: string
  resourcesPath?: string
  platform?: NodeJS.Platform
  env?: NodeJS.ProcessEnv
  exists?: PathExists
}

export type PythonCommand = {
  cmd: string
  args: string[]
  source: 'env' | 'venv' | 'bundled' | 'system'
}

function bundledPythonExe(resourcesPath: string | undefined, platform: NodeJS.Platform): string | null {
  if (!resourcesPath) {
    return null
  }
  if (platform === 'win32') {
    return path.join(resourcesPath, 'python-runtime', 'python.exe')
  }
  return path.join(resourcesPath, 'python-runtime', 'bin', 'python3')
}

export function resolvePythonCommand(input: ResolvePythonCommandInput): PythonCommand {
  const exists = input.exists ?? defaultExists
  const env = input.env ?? process.env
  const platform = input.platform ?? process.platform
  const fromEnv = env.DW_PYTHON
  if (fromEnv) {
    return { cmd: fromEnv, args: [], source: 'env' }
  }
  const venvWin = path.join(input.pythonRoot, '.venv', 'Scripts', 'python.exe')
  if (exists(venvWin)) {
    return { cmd: venvWin, args: [], source: 'venv' }
  }
  const venvUnix = path.join(input.pythonRoot, '.venv', 'bin', 'python')
  if (exists(venvUnix)) {
    return { cmd: venvUnix, args: [], source: 'venv' }
  }
  const bundled = bundledPythonExe(input.resourcesPath, platform)
  if (bundled && exists(bundled)) {
    return { cmd: bundled, args: [], source: 'bundled' }
  }
  if (platform === 'win32') {
    return { cmd: 'py', args: ['-3.12'], source: 'system' }
  }
  return { cmd: 'python3', args: [], source: 'system' }
}
