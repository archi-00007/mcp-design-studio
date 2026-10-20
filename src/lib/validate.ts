import type { SchemaField, Tool } from '../types'

/**
 * 编辑期的唯一性校验。
 *
 * MCP 用工具英文名做唯一标识，同层字段名则是 JSON Schema `properties` 的键——
 * 两者重复都不会报错，只会静默覆盖（对象赋值后写赢），所以必须在写之前提示。
 */

/** 同层重复的字段 id，含嵌套层；items 承载行不参与 */
export function duplicateFieldIds(fields: SchemaField[]): Set<string> {
  const ids = new Set<string>()
  walk(fields, (level) => {
    for (const group of groupByName(level).values()) {
      if (group.length < 2) continue
      for (const field of group) ids.add(field.id)
    }
  })
  return ids
}

/** 同层重复字段的英文名，供导出前汇总成一两句人话 */
export function duplicateFieldNames(fields: SchemaField[]): string[] {
  const names = new Set<string>()
  walk(fields, (level) => {
    for (const [name, group] of groupByName(level)) {
      if (group.length > 1) names.add(name)
    }
  })
  return [...names]
}

function walk(fields: SchemaField[], visit: (level: SchemaField[]) => void): void {
  visit(fields)
  for (const field of fields) {
    if (field.children.length) walk(field.children, visit)
  }
}

function groupByName(fields: SchemaField[]): Map<string, SchemaField[]> {
  const byName = new Map<string, SchemaField[]>()
  for (const field of fields) {
    if (field.isItems) continue
    const name = field.name.trim()
    if (!name) continue
    const hit = byName.get(name)
    if (hit) hit.push(field)
    else byName.set(name, [field])
  }
  return byName
}

/** 工具英文名是否已被同 Server 下的别的工具占用 */
export function isToolNameTaken(tools: Tool[], selfId: string, name: string): boolean {
  const key = name.trim()
  if (!key) return false
  return tools.some((tool) => tool.id !== selfId && tool.name.trim() === key)
}

/**
 * 导出前的阻塞项：重名不会让导出失败，但会让产物在客户端那边悄悄丢东西，
 * 所以在这里显式说出来，由用户决定改不改。
 */
export function exportWarnings(tools: Tool[]): string[] {
  const warnings: string[] = []

  const counts = new Map<string, number>()
  for (const tool of tools) {
    const key = tool.name.trim()
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const repeatedTools = [...counts].filter(([, n]) => n > 1).map(([name]) => name)
  if (repeatedTools.length) {
    warnings.push(`工具英文名重复：${repeatedTools.join('、')}，客户端按 name 注册时会被覆盖。`)
  }

  for (const tool of tools) {
    const names = [...new Set([...duplicateFieldNames(tool.input), ...duplicateFieldNames(tool.output)])]
    if (names.length) {
      warnings.push(`${tool.name || '未命名工具'} 有同层重名字段：${names.join('、')}，导出后只保留最后一个。`)
    }
  }

  return warnings
}
