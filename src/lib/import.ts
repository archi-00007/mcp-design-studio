import { normalizeTimestamp } from './time'
import type { JsonSchemaType, SchemaField, Tool, ToolAnnotations, Transport } from '../types'

/** JSON Schema 的合法 type 值。enum 不在这里——它是约束关键字，不是类型 */
const TYPES: JsonSchemaType[] = [
  'string',
  'number',
  'integer',
  'boolean',
  'array',
  'object',
  'null',
  'any',
]

export interface ParsedImport {
  name: string
  description: string
  transport: Transport
  protocolVersion: string
  tools: Tool[]
  /** 转换过程中被降级或丢弃的内容，导入前让用户看一眼 */
  warnings: string[]
}

export type ImportResult =
  | { ok: true; data: ParsedImport }
  | { ok: false; error: string }

let seq = 0
function importId(prefix: string): string {
  seq += 1
  return `${prefix}-imp${Date.now().toString(36)}${seq}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** 转换期的统计，最后汇总成 warnings */
interface Ctx {
  unknownTypes: Set<string>
  unions: number
  skippedTools: number
}

function pickType(raw: unknown, ctx: Ctx): JsonSchemaType {
  // type 写成数组是联合类型（常见的是 ['string','null']），本工具只表达单一类型
  if (Array.isArray(raw)) {
    ctx.unions += 1
    const members = raw.map(String).filter((t) => t !== 'null')
    if (members.length === 1) return pickType(members[0], ctx)
    return 'any'
  }

  if (typeof raw !== 'string' || !raw) return 'any'
  if ((TYPES as string[]).includes(raw)) return raw as JsonSchemaType

  ctx.unknownTypes.add(raw)
  return 'any'
}

function itemsField(raw: unknown, ctx: Ctx): SchemaField {
  const base = fieldFrom('', raw, false, ctx)
  return { ...base, name: '', title: '', required: false, isItems: true }
}

function fieldFrom(name: string, raw: unknown, required: boolean, ctx: Ctx): SchemaField {
  const node = isRecord(raw) ? raw : {}
  const type = pickType(node.type, ctx)

  const field: SchemaField = {
    id: importId('f'),
    name,
    title: str(node.title),
    type,
    required,
    description: str(node.description),
    enumValues: Array.isArray(node.enum) ? node.enum.map((v) => String(v)) : [],
    children: [],
  }

  if (type === 'object') field.children = fieldsFromSchema(node, ctx)
  else if (type === 'array') field.children = [itemsField(node.items, ctx)]

  return field
}

function fieldsFromSchema(schema: unknown, ctx: Ctx): SchemaField[] {
  if (!isRecord(schema)) return []
  const props = schema.properties
  if (!isRecord(props)) return []

  const required = Array.isArray(schema.required) ? schema.required.map(String) : []
  return Object.entries(props).map(([key, value]) =>
    fieldFrom(key, value, required.includes(key), ctx),
  )
}

/** 示例只接受字符串条目，其它形态（对象、数字）静默丢弃 */
function examplesFrom(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : []
}

function annotationsFrom(raw: unknown): ToolAnnotations {
  const node = isRecord(raw) ? raw : {}
  return {
    readOnlyHint: node.readOnlyHint === true,
    destructiveHint: node.destructiveHint === true,
    idempotentHint: node.idempotentHint === true,
    openWorldHint: node.openWorldHint === true,
  }
}

function toolFromJson(raw: unknown, ctx: Ctx): Tool | null {
  if (!isRecord(raw)) return null

  // name 是工具在 MCP 里的唯一标识，没有它这条记录没有意义
  const name = str(raw.name).trim()
  if (!name) {
    ctx.skippedTools += 1
    return null
  }

  // 导出的 IR 会带 x-design 记录原始时间；手写的没有，就按导入时间算
  const design = isRecord(raw['x-design']) ? raw['x-design'] : {}
  const examples = isRecord(design.examples) ? design.examples : {}

  return {
    id: importId('t'),
    name,
    title: str(raw.title),
    description: str(raw.description),
    // 内部说明存在 x-design 里，不在协议字段上
    internalNotes: str(design.internalNotes),
    input: fieldsFromSchema(raw.inputSchema, ctx),
    output: fieldsFromSchema(raw.outputSchema, ctx),
    requestExamples: examplesFrom(examples.request),
    responseExamples: examplesFrom(examples.response),
    annotations: annotationsFrom(raw.annotations),
    createdAt: normalizeTimestamp(design.createdAt),
    updatedAt: normalizeTimestamp(design.updatedAt),
  }
}

/**
 * 解析一份 IR。既接受完整的 server 清单，也接受单个工具对象——
 * 从别处手抄一个工具过来时不用为了导入先包一层。
 */
export function parseIr(text: string): ImportResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: '文件不是合法的 JSON，确认内容是完整的导出文件' }
  }

  if (!isRecord(data)) return { ok: false, error: '顶层必须是一个 JSON 对象' }

  const isToolObject = 'inputSchema' in data || 'outputSchema' in data
  const rawTools = Array.isArray(data.tools) ? data.tools : isToolObject ? [data] : null

  if (!rawTools) {
    return { ok: false, error: '没有找到 tools 数组，这份文件不像是 IR 备份' }
  }
  if (rawTools.length === 0) {
    return { ok: false, error: 'IR 里没有任何工具，导入会得到一个空 Server' }
  }

  const ctx: Ctx = { unknownTypes: new Set(), unions: 0, skippedTools: 0 }
  const tools = rawTools.map((raw) => toolFromJson(raw, ctx)).filter((t): t is Tool => !!t)

  if (tools.length === 0) {
    return { ok: false, error: '所有工具都缺少 name，无法判断工具标识' }
  }

  const transportRaw = isRecord(data.transport) ? data.transport.type : data.transport
  const transport: Transport = transportRaw === 'stdio' ? 'stdio' : 'streamable-http'

  const warnings: string[] = []
  if (ctx.unknownTypes.size) {
    warnings.push(`未知类型按 any 处理：${[...ctx.unknownTypes].join('、')}`)
  }
  if (ctx.unions) {
    warnings.push(`${ctx.unions} 处联合类型（type 为数组）按 any 处理`)
  }
  if (ctx.skippedTools) {
    warnings.push(`${ctx.skippedTools} 个工具没有 name，已跳过`)
  }

  // 协议版本在本工具里是锁定的：字段基线依赖 outputSchema，旧版本声明不了
  const importedVersion = str(data.protocolVersion)
  const protocolVersion = '2025-06-18'
  if (importedVersion && importedVersion !== protocolVersion) {
    warnings.push(`原文件协议 ${importedVersion}，已按 ${protocolVersion} 保存`)
  }

  return {
    ok: true,
    data: {
      name: str(data.name).trim() || '导入的 Server',
      description: str(data.description),
      transport,
      protocolVersion,
      tools,
      warnings,
    },
  }
}

/* --------------------------------------------------------------- 合并统计 */

export interface MergeStat {
  add: number
  overwrite: number
  skip: number
}

/** 同名判定用英文名（trim 后），与 reducer 里的合并逻辑保持同一口径 */
export function mergeStat(
  existing: string[],
  incoming: Tool[],
  conflict: 'skip' | 'overwrite',
): MergeStat {
  const seen = new Set(existing.map((n) => n.trim()))
  const stat: MergeStat = { add: 0, overwrite: 0, skip: 0 }

  for (const tool of incoming) {
    const key = tool.name.trim()
    if (seen.has(key)) {
      if (conflict === 'overwrite') stat.overwrite += 1
      else stat.skip += 1
    } else {
      stat.add += 1
      seen.add(key)
    }
  }

  return stat
}
