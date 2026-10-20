const pad = (n: number) => String(n).padStart(2, '0')

/** 时间戳精确到秒，表格里直接显示，不做二次格式化 */
export function now(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}:${pad(d.getSeconds())}`
}

/**
 * 兼容只写到日期的旧草稿，以及手写导入的 IR。
 * 缺时间时：有同一天的已知时刻就用它（种子数据重新生成过），否则补 00:00:00。
 */
export function normalizeTimestamp(value: unknown, known?: string): string {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return known ?? now()
  const dateOnly = /^(\d{4}-\d{2}-\d{2})$/.exec(text)
  if (!dateOnly) return text
  return known && known.startsWith(dateOnly[1]) ? known : `${dateOnly[1]} 00:00:00`
}
