import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    include: ['electron/**/*.spec.ts', 'src/**/*.spec.ts'],
    environment: 'node'
  },
  resolve: {
    alias: {
      '@': resolve(root, 'src'),
      '@dw/rpc-types': resolve(root, '../packages/rpc-types/src/index.ts'),
      '@dw/chart-core': resolve(root, '../packages/chart-core/src/index.ts')
    }
  }
})
