import { buildToolJson, cleanExamples } from './model'
import type { JsonSchemaType, SchemaField, ServerDoc, Tool } from '../types'

/** 字段基线，页面与导出产物上的标注都从这里取，避免多处硬编码走偏 */
export const SPEC_LABEL = 'mcpdesc v0.8.0'

export type Artifact = 'markdown' | 'ir'

/** 一次导出任务：哪一个 Server、哪些工具 */
export interface ExportSelection {
  server: ServerDoc
  tools: Tool[]
}

/* ------------------------------------------------------------------ IR */

/**
 * 完整交付 IR。根节点就是 server 清单，tools 是完整工具对象（不是名字数组）——
 * 这份文件要能被重新导入，所以不能只放摘要。
 */
export function buildIr({ server, tools }: ExportSelection) {
  return {
    name: server.name,
    description: server.description,
    protocolVersion: server.protocolVersion,
    transport: { type: server.transport },
    capabilities: { tools: {} },
    tools: tools.map((tool) => {
      const request = cleanExamples(tool.requestExamples)
      const response = cleanExamples(tool.responseExamples)
      return {
        ...buildToolJson(tool),
        // 设计期信息，不参与协议语义：列表用的时间、请求 / 响应示例、内部说明。
        // 为空时不写这一段，导出的工具节点保持干净。
        'x-design': {
          createdAt: tool.createdAt,
          updatedAt: tool.updatedAt,
          ...(request.length || response.length ? { examples: { request, response } } : {}),
          ...(tool.internalNotes.trim() ? { internalNotes: tool.internalNotes } : {}),
        },
      }
    }),
    'x-design': { spec: SPEC_LABEL, generator: 'MCP Design Studio' },
  }
}

export function irText(selection: ExportSelection): string {
  return `${JSON.stringify(buildIr(selection), null, 2)}\n`
}

/* --------------------------------------------------------------- 扁平化 */

/**
 * 一行表格记录。嵌套结构用路径表达（items[].sku），而不是靠缩进——
 * Markdown 表格里的缩进会被吃掉，路径在复制出去之后也仍然准确。
 */
export interface FlatField {
  path: string
  title: string
  type: JsonSchemaType
  /** null = 数组元素结构行，本身没有必填语义 */
  required: boolean | null
  description: string
}

export function flattenFields(fields: SchemaField[], parent = ''): FlatField[] {
  const rows: FlatField[] = []

  for (const field of fields) {
    if (field.isItems) continue
    const name = field.name.trim()
    // 英文名为空的行是还没填的草稿，不进文档，与导出 IR 的口径一致
    if (!name) continue

    const path = parent ? `${parent}.${name}` : name
    rows.push({
      path,
      title: field.title.trim(),
      type: field.type,
      required: field.required,
      description: field.description.trim(),
    })

    if (field.type === 'object') {
      rows.push(...flattenFields(field.children, path))
    } else if (field.type === 'array') {
      const items = field.children.find((c) => c.isItems)
      if (items) rows.push(...flattenItems(items, path))
    }
  }

  return rows
}

function flattenItems(items: SchemaField, parent: string): FlatField[] {
  const path = `${parent}[]`

  if (items.type === 'object') {
    const kids = flattenFields(items.children, path)
    return kids.length
      ? kids
      : [{ path, title: '', type: 'object', required: null, description: items.description.trim() }]
  }

  if (items.type === 'array') {
    const inner = items.children.find((c) => c.isItems)
    return inner ? flattenItems(inner, path) : []
  }

  return [
    {
      path,
      title: (items.title ?? '').trim(),
      type: items.type,
      required: null,
      description: items.description.trim(),
    },
  ]
}

/* ----------------------------------------------------------- Markdown */

const HINT_LABEL: Record<keyof Tool['annotations'], string> = {
  readOnlyHint: '只读',
  destructiveHint: '破坏性',
  idempotentHint: '幂等',
  openWorldHint: '开放世界',
}

/** 表格单元格转义：竖线会切断列，换行会切断行 */
function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r?\n+/g, ' ').trim()
}

function fieldTable(rows: FlatField[]): string[] {
  if (!rows.length) return ['_无_']

  const out = ['| 字段 | 中文名 | 类型 | 必填 | 说明 |', '| --- | --- | --- | --- | --- |']
  for (const row of rows) {
    const required = row.required === null ? '—' : row.required ? '是' : '否'
    out.push(
      `| \`${cell(row.path)}\` | ${cell(row.title) || '—'} | ${row.type} | ${required} | ${cell(row.description) || '—'} |`,
    )
  }
  return out
}

/** 示例按 json 代码块排列，多条之间空一行 */
function exampleBlocks(list: string[]): string[] {
  const out: string[] = []
  for (const body of list) {
    if (out.length) out.push('')
    out.push('```json', body, '```')
  }
  return out
}

export function buildMarkdown({ server, tools }: ExportSelection): string {
  const lines: string[] = []

  lines.push(`# ${server.name || '未命名 Server'}`)
  if (server.description.trim()) lines.push('', server.description.trim())
  lines.push(
    '',
    `> 字段基线 ${SPEC_LABEL} · 协议 MCP ${server.protocolVersion} · 传输 ${server.transport}`,
    '',
    `共 ${tools.length} 个工具。`,
  )

  if (tools.length > 1) {
    lines.push('', '## 工具索引', '', '| 英文名 | 中文名 | 说明 |', '| --- | --- | --- |')
    for (const tool of tools) {
      const name = tool.name.trim() || '（未命名）'
      lines.push(`| \`${cell(name)}\` | ${cell(tool.title) || '—'} | ${cell(tool.description) || '—'} |`)
    }
  }

  for (const tool of tools) {
    const name = tool.name.trim() || '（未命名）'
    lines.push('', '---', '', `## \`${name}\``, '')

    if (tool.title.trim()) lines.push(`**${tool.title.trim()}**`, '')
    if (tool.description.trim()) lines.push(tool.description.trim(), '')

    const hints = (Object.keys(HINT_LABEL) as (keyof Tool['annotations'])[])
      .filter((key) => tool.annotations[key])
      .map((key) => HINT_LABEL[key])
    if (hints.length) lines.push(`> 行为提示：${hints.join(' · ')}`, '')

    lines.push('### 请求参数', '', ...fieldTable(flattenFields(tool.input)))
    lines.push('', '### 响应参数', '', ...fieldTable(flattenFields(tool.output)))

    // 示例与界面上的「请求示例 / 响应示例」同源，空示例不写进文档
    const request = cleanExamples(tool.requestExamples)
    if (request.length) lines.push('', '### 请求示例', '', ...exampleBlocks(request))
    const response = cleanExamples(tool.responseExamples)
    if (response.length) lines.push('', '### 响应示例', '', ...exampleBlocks(response))
  }

  return `${lines.join('\n').trimEnd()}\n`
}

/* ------------------------------------------------------------- 文件相关 */

/** 去掉文件名里不能用的字符，避免下载被浏览器改名 */
function safeName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || 'mcp-server'
}

export function fileNameFor(server: ServerDoc, artifact: Artifact): string {
  const base = safeName(server.name)
  return artifact === 'markdown' ? `${base}.md` : `${base}.ir.json`
}

export function byteSize(text: string): number {
  return new Blob([text]).size
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

export function downloadText(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // 立刻 revoke 会让部分浏览器拿不到内容，留一拍再释放
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function mimeFor(artifact: Artifact): string {
  return artifact === 'markdown' ? 'text/markdown' : 'application/json'
}

/** 复制失败时回退到选区方案：file:// 下 Clipboard API 可能不可用 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const area = document.createElement('textarea')
      area.value = text
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      area.remove()
      return ok
    } catch {
      return false
    }
  }
}
