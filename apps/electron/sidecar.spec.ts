import { describe, expect, it } from 'vitest'
import { SidecarBridge } from './sidecar'

describe('SidecarBridge.invoke', () => {
  it('rejects with RpcError when the process never starts', async () => {
    const bridge = new SidecarBridge({ processWaitMs: 20 })
    await expect(bridge.invoke('data.list', {})).rejects.toMatchObject({
      name: 'RpcError',
      i18nKey: 'rpc.sidecarNotRunning'
    })
  })
})
