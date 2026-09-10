export function canvasToPngDataUrl(canvas: HTMLCanvasElement): string {
  const out = document.createElement('canvas')
  out.width = Math.max(1, canvas.width)
  out.height = Math.max(1, canvas.height)
  const ctx = out.getContext('2d')
  if (!ctx) {
    throw new Error('2d context unavailable')
  }
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(canvas, 0, 0)
  return out.toDataURL('image/png')
}

export function decodePngDataUrl(dataUrl: string): Uint8Array {
  const prefix = 'data:image/png;base64,'
  if (!dataUrl.startsWith(prefix)) {
    throw new Error('expected png data URL')
  }
  return decodeBase64(dataUrl.slice(prefix.length))
}

function decodeBase64(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return Uint8Array.from(Buffer.from(b64, 'base64'))
  }
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i)
  }
  return out
}
