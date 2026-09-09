import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

const root = dirname(fileURLToPath(import.meta.url))
const rpcTypes = resolve(root, '../packages/rpc-types/src/index.ts')

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
          // package.json is "type": "module"; .js preload would be ESM and
          // require('electron') would fail, leaving window.dw undefined.
          entryFileNames: 'index.cjs'
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
