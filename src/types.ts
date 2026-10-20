export type JsonSchemaType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'array'
  | 'object'
  | 'null'
  /** 任意值：不写 type，导出为空 schema（接受任何类型） */
  | 'any'

export const JSON_SCHEMA_TYPES: JsonSchemaType[] = [
  'string',
  'number',
  'integer',
  'boolean',
  'array',
  'object',
  'null',
  'any',
]

export const TYPE_HINT: Record<JsonSchemaType, string> = {
  string: '文本、ID、枚举值',
  number: '浮点数，如金额、比率',
  integer: '整数，如数量、页码',
  boolean: 'true / false 开关',
  array: '有序列表，元素类型另定',
  object: '嵌套对象',
  null: '仅表示空值',
  any: '任意类型，不写 type 约束',
}

/** 支持填写候选值的类型 */
export const ENUM_CAPABLE: JsonSchemaType[] = ['string', 'number', 'integer']

export interface SchemaField {
  id: string
  /** 字段名，英文 snake_case，导出为 properties 的键 */
  name: string
  /** 中文名，给人看的，导出为 JSON Schema 的 title */
  title: string
  type: JsonSchemaType
  required: boolean
  description: string
  /** 候选值，仅约束取值范围，不是独立类型 */
  enumValues: string[]
  /**
   * 层级子节点，按字段类型决定含义：
   * - object：properties 下的子字段
   * - array：只放一个 isItems 节点，描述 items 的元素结构
   * - 其余标量类型：保留但导出时忽略，切回 object / array 后原样恢复
   */
  children: SchemaField[]
  /** array 的 items 承载行：不渲染字段名、不参与 required、不可删除 */
  isItems?: boolean
}

export interface ToolAnnotations {
  readOnlyHint: boolean
  destructiveHint: boolean
  idempotentHint: boolean
  openWorldHint: boolean
}

export interface Tool {
  id: string
  /** 英文名，MCP 唯一标识 */
  name: string
  /** 中文名，写入 title */
  title: string
  /**
   * 外部描述：面向 agent 调用的说明，原样写入 MCP 的 description。
   * 模型读的就是这一段，所以要写「什么时候该用、边界在哪」。
   */
  description: string
  /**
   * 内部说明：面向 SDD 编码实现的说明，不进 MCP 协议语义。
   * 只随 IR 备份的 x-design 走，预览里的协议 JSON 不会出现它。
   */
  internalNotes: string
  input: SchemaField[]
  output: SchemaField[]
  /**
   * 请求 / 响应示例：设计期的说明性素材，不进 MCP 协议表示。
   * 每条是一段 JSON 文本，展示时格式化，编辑时按原文改。
   */
  requestExamples: string[]
  responseExamples: string[]
  annotations: ToolAnnotations
  createdAt: string
  updatedAt: string
}

export type Transport = 'streamable-http' | 'stdio'

/** Server 本质是一份本地设计文档 */
export interface ServerDoc {
  id: string
  name: string
  description: string
  transport: Transport
  protocolVersion: string
  tools: Tool[]
}

export type View =
  | { kind: 'workspace' }
  | { kind: 'editor'; toolId: string }
  | { kind: 'settings' }
