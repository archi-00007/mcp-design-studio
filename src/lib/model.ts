import { ENUM_CAPABLE, type JsonSchemaType, type SchemaField, type ServerDoc, type Tool } from '../types'

let fidSeq = 0
function nextId(): string {
  fidSeq += 1
  return `fd-${Date.now().toString(36)}-${fidSeq}`
}

export function newField(type: JsonSchemaType = 'string'): SchemaField {
  return {
    id: nextId(),
    name: '',
    title: '',
    type,
    required: false,
    description: '',
    enumValues: [],
    children: [],
  }
}

/**
 * 深拷贝一棵字段树，并给每个节点重新分配 id。
 * 复制工具时用：副本与原件此后互不干涉，即使两边同时被编辑也不会串改。
 */
export function cloneFields(fields: SchemaField[]): SchemaField[] {
  return fields.map((field) => ({
    ...field,
    id: nextId(),
    enumValues: [...field.enumValues],
    children: cloneFields(field.children ?? []),
  }))
}

/** array 的元素结构承载行，名字与必填都不参与 */
export function newItemsField(type: JsonSchemaType = 'string'): SchemaField {
  return {
    id: nextId(),
    name: '',
    title: '',
    type,
    required: false,
    description: '',
    enumValues: [],
    children: [],
    isItems: true,
  }
}

/* ---------------------------------------------------------------- 树操作 */

export function findField(fields: SchemaField[], id: string): SchemaField | null {
  for (const field of fields) {
    if (field.id === id) return field
    const hit = findField(field.children, id)
    if (hit) return hit
  }
  return null
}

export function updateFieldInTree(
  fields: SchemaField[],
  id: string,
  patch: Partial<SchemaField>,
): SchemaField[] {
  return fields.map((field) =>
    field.id === id
      ? { ...field, ...patch }
      : field.children.length
        ? { ...field, children: updateFieldInTree(field.children, id, patch) }
        : field,
  )
}

export function removeFieldFromTree(fields: SchemaField[], id: string): SchemaField[] {
  return fields
    .filter((field) => field.id !== id)
    .map((field) =>
      field.children.length ? { ...field, children: removeFieldFromTree(field.children, id) } : field,
    )
}

export function appendChildTo(fields: SchemaField[], parentId: string, child: SchemaField): SchemaField[] {
  return mapTree(fields, parentId, (field) => ({ ...field, children: [...field.children, child] }))
}

/**
 * 在指定字段所在的层级里，紧挨着它后面插入一个同辈字段。
 * 找不到目标时原样返回（引用不变，便于上层判断是否命中）。
 */
export function insertSiblingAfter(
  fields: SchemaField[],
  id: string,
  sibling: SchemaField,
): SchemaField[] {
  const index = fields.findIndex((field) => field.id === id)
  if (index >= 0) {
    const next = fields.slice()
    next.splice(index + 1, 0, sibling)
    return next
  }

  let changed = false
  const next = fields.map((field) => {
    if (changed || !field.children.length) return field
    const kids = insertSiblingAfter(field.children, id, sibling)
    if (kids === field.children) return field
    changed = true
    return { ...field, children: kids }
  })
  return changed ? next : fields
}

function mapTree(
  fields: SchemaField[],
  id: string,
  fn: (field: SchemaField) => SchemaField,
): SchemaField[] {
  return fields.map((field) => {
    if (field.id === id) return fn(field)
    if (!field.children.length) return field
    return { ...field, children: mapTree(field.children, id, fn) }
  })
}

/**
 * 切换类型。array 必须有且只有一个 items 行，缺了就补；
 * 切到标量时不清空子级，切回来还在。
 */
export function applyType(field: SchemaField, type: JsonSchemaType): SchemaField {
  const next: SchemaField = {
    ...field,
    type,
    enumValues: ENUM_CAPABLE.includes(type) ? field.enumValues : [],
  }
  if (type === 'array' && !field.children.some((c) => c.isItems)) {
    next.children = [...field.children, newItemsField()]
  }
  return next
}

/** 该字段能否直接挂子级：object 可以，array 通过 items 行 */
export function canHoldChildren(field: SchemaField): boolean {
  return !field.isItems && (field.type === 'object' || field.type === 'array')
}

/* ------------------------------------------------------------ 导出 schema */

/** 单个字段的 JSON Schema 片段，递归展开 */
function fieldToSchema(field: SchemaField): Record<string, unknown> {
  // any 用空 schema 表达：缺省 type 即「接受任意值」，写 type 反而会限制范围
  const node: Record<string, unknown> = {}
  if (field.type !== 'any') node.type = field.type

  const title = (field.title ?? '').trim()
  if (title && !field.isItems) node.title = title

  const description = field.description.trim()
  if (description) node.description = description

  if (field.enumValues.length && ENUM_CAPABLE.includes(field.type)) {
    node.enum =
      field.type === 'number' || field.type === 'integer'
        ? field.enumValues.map((v) => (Number.isNaN(Number(v)) ? v : Number(v)))
        : field.enumValues
  }

  if (field.type === 'object') {
    const { properties, required } = collectProperties(field.children)
    node.properties = properties
    if (required.length) node.required = required
  }

  if (field.type === 'array') {
    const items = field.children.find((c) => c.isItems)
    // 元素结构缺失时退化为字符串数组，保证输出的 schema 始终合法
    node.items = items ? fieldToSchema(items) : { type: 'string' }
  }

  return node
}

function collectProperties(fields: SchemaField[]) {
  const properties: Record<string, unknown> = {}
  const required: string[] = []

  for (const field of fields) {
    if (field.isItems) continue
    const key = field.name.trim()
    if (!key) continue
    properties[key] = fieldToSchema(field)
    if (field.required) required.push(key)
  }

  return { properties, required }
}

function buildObject(fields: SchemaField[]): Record<string, unknown> {
  const { properties, required } = collectProperties(fields)
  const schema: Record<string, unknown> = { type: 'object', properties }
  if (required.length) schema.required = required
  return schema
}

export function buildInputSchema(tool: Tool) {
  return buildObject(tool.input)
}

export function buildOutputSchema(tool: Tool) {
  return buildObject(tool.output)
}

/** 单个工具的完整协议表示，也是预览面板渲染的唯一数据源 */
export function buildToolJson(tool: Tool) {
  const annotations = tool.annotations
  const hasAnnotation = Object.values(annotations).some(Boolean)

  const node: Record<string, unknown> = {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: buildInputSchema(tool),
    outputSchema: buildOutputSchema(tool),
  }

  if (hasAnnotation) node.annotations = { ...annotations }

  return node
}

/**
 * Server 清单摘要，设置页右侧展示用。tools 只列名称——
 * 完整工具定义由 `lib/export.ts` 的 buildIr 生成，两处粒度不同但出处相同。
 */
export function buildServerJson(server: ServerDoc) {
  return {
    name: server.name,
    description: server.description,
    protocolVersion: server.protocolVersion,
    transport: { type: server.transport },
    capabilities: { tools: {} },
    tools: server.tools.map((t) => t.name),
  }
}

/**
 * 含嵌套结构的总字段数。items 承载行本身不计；英文名空着的草稿行也不计——
 * 它们不会写进导出结果，计数要和导出保持一致。
 */
export function countFieldsIn(fields: SchemaField[]): number {
  return fields.reduce((sum, field) => {
    if (field.isItems) return sum + countFieldsIn(field.children)
    if (!field.name.trim()) return sum
    return sum + 1 + countFieldsIn(field.children)
  }, 0)
}

/* -------------------------------------------------------------- 示例文本 */

/**
 * 示例的展示形态：合法 JSON 就格式化缩进，不合法就原样给出——
 * 用户正写到一半时不该被改写。
 */
export function formatExample(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2)
  } catch {
    return trimmed
  }
}

export function isJsonText(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  try {
    JSON.parse(trimmed)
    return true
  } catch {
    return false
  }
}

/** 只保留有内容的示例，导出与文档都按这个口径 */
export function cleanExamples(list: string[] = []): string[] {
  return list.filter((text) => text.trim()).map((text) => formatExample(text))
}

/**
 * 兼容早期草稿：SchemaField 早先没有中文名字段，读进来补齐。
 * 缺的中文名先按字段 id 从种子表里找，找不到就留空。
 */
export function normalizeFields(
  fields: SchemaField[],
  fallback?: Record<string, string>,
): SchemaField[] {
  return fields.map((field) => ({
    ...field,
    title:
      typeof field.title === 'string' ? field.title : (fallback?.[field.id] ?? ''),
    enumValues: field.enumValues ?? [],
    children: normalizeFields(field.children ?? [], fallback),
  }))
}
