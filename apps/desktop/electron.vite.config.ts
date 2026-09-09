import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

const root = dirname(fileURLToPath(import.meta.url))
const rpcTypes = resolve(root, '../../packages/rpc-types/src/index.ts')

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['@dw/rpc-types'] })],
    resolve: {
      alias: {
        '@dw/rpc-types': rpcTypes
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(root, 'electron/main.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(root, 'electron/preload.ts')
        },
        output: {
          format: 'cjs',
          entryFileNames: 'index.js'
        }
      }
    }
  },
  renderer: {
    root: resolve(root, 'src'),
    plugins: [vue()],
    resolve: {
      alias: {
        '@': resolve(root, 'src'),
        '@dw/rpc-types': rpcTypes
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(root, 'src/index.html')
        }
      }
    }
  }
})
