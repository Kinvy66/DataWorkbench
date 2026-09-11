/** CJK-capable stack so SVG and Chromium print-to-PDF keep Chinese titles. */
export const SVG_TEXT_FONT =
  'Microsoft YaHei, PingFang SC, Noto Sans SC, Segoe UI, sans-serif'

export function xmlEscape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
