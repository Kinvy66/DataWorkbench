import { clipboard, nativeImage } from 'electron'
import { RpcError } from './rpc-error'
import type { AppClipboardWriteParams } from './clipboard-params'

export function writeAppClipboard(params: AppClipboardWriteParams): void {
  if (params.pngDataUrl) {
    const image = nativeImage.createFromDataURL(params.pngDataUrl)
    if (image.isEmpty()) {
      throw new RpcError(-32602, 'PNG clipboard payload is empty', 'edit.clipboardEmpty')
    }
    clipboard.writeImage(image)
    return
  }
  clipboard.writeText(params.text ?? '')
}

export function readAppClipboardText(): string {
  return clipboard.readText()
}
