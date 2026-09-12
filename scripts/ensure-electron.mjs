import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

process.env.electron_use_remote_checksums ??= '1'
process.env.npm_config_electron_use_remote_checksums ??= 'true'
process.env.ELECTRON_MIRROR ??= 'https://npmmirror.com/mirrors/electron/'
process.env.electron_mirror ??= process.env.ELECTRON_MIRROR

const require = createRequire(import.meta.url)
let installJs
try {
  installJs = require.resolve('electron/install.js')
} catch {
  console.error('ensure-electron: electron package is not installed')
  process.exit(1)
}

const result = spawnSync(process.execPath, [installJs], {
  cwd: dirname(installJs),
  env: process.env,
  stdio: 'inherit'
})
process.exit(result.status ?? 1)
