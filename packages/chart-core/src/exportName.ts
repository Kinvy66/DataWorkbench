const ILLEGAL = /[<>:"/\\|?*\u0000-\u001f]/g

export function suggestedExportName(title: string, format: 'png' | 'svg'): string {
  const cleaned = title.replace(ILLEGAL, '_').replace(/[. ]+$/g, '').trim()
  const stem = (cleaned || 'chart').slice(0, 80)
  return `${stem}.${format}`
}
