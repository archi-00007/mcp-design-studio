import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import {
  appendChildTo,
  applyType,
  buildToolJson,
  countFieldsIn,
  formatExample,
  insertSiblingAfter,
  isJsonText,
  newField,
  newItemsField,
  removeFieldFromTree,
  updateFieldInTree,
} from '../lib/model'
import { highlight } from '../lib/highlight'
import { ENUM_CAPABLE, JSON_SCHEMA_TYPES, TYPE_HINT, type JsonSchemaType, type SchemaField, type Tool } from '../types'
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CodeIcon,
  ExportIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  XCircleIcon,
  XIcon,
} from '../components/Icons'
import { Btn, Chip, SectionTitle, useClickOutside } from '../components/ui'
import { useExport } from '../components/ExportDialog'

type SectionKey = 'input' | 'output'

/** 字段行七列：英文名 / 中文名 / 类型 / 必填 / 说明 / 加号 / 减号。层级只压英文名列，右侧列位不动 */
const SCHEMA_GRID =
  'grid grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)_84px_46px_minmax(0,1.15fr)_24px_24px] items-center gap-1 px-1.5'

const HINTS: { key: keyof Tool['annotations']; label: string; note: string }[] = [
  { key: 'readOnlyHint', label: 'readOnlyHint', note: '只读，不改变任何状态' },
  { key: 'destructiveHint', label: 'destructiveHint', note: '可能造成不可逆变更' },
  { key: 'idempotentHint', label: 'idempotentHint', note: '重复调用结果一致' },
  { key: 'openWorldHint', label: 'openWorldHint', note: '会触达外部世界' },
]

export function ToolEditor() {
  const { dispatch, activeServer, activeTool } = useStore()
  const { openDialog } = useExport()
  const [mode, setMode] = useState<'edit' | 'view'>('edit')

  if (!activeTool) {
    return (
      <main className="flex flex-1 items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-[13px] text-ink-sub">这个工具已不存在</p>
          <Btn variant="secondary" size="sm" className="mt-3" onClick={() => dispatch({ type: 'nav', view: { kind: 'workspace' } })}>
            返回工具列表
          </Btn>
        </div>
      </main>
    )
  }

  const readonly = mode === 'view'

  return (
    <div className="flex h-full min-w-0 flex-1 bg-white">
      {/* 表单 */}
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[52px] shrink-0 items-center gap-1.5 border-b border-line px-4">
          <button
            type="button"
            onClick={() => dispatch({ type: 'nav', view: { kind: 'workspace' } })}
            className="-ml-1 mr-1 flex h-6 w-6 items-center justify-center rounded-[6px] text-ink-mute transition-colors hover:bg-surface-sunken hover:text-ink"
            title="返回工具列表"
          >
            <ArrowLeftIcon size={14} />
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'nav', view: { kind: 'settings' } })}
            title="打开 Server 设置"
            className="text-[11.5px] text-ink-mute hover:text-brand"
          >
            {activeServer.name}
          </button>
          <span className="text-[11px] text-ink-faint">/</span>
          <button
            type="button"
            onClick={() => dispatch({ type: 'nav', view: { kind: 'workspace' } })}
            className="text-[11.5px] text-ink-mute hover:text-brand"
          >
            工具列表
          </button>
          <span className="text-[11px] text-ink-faint">/</span>
          <span className="font-mono text-[11.5px] font-medium text-ink">{activeTool.name}</span>

          <div className="ml-auto flex items-center gap-2.5">
            <span className="flex items-center gap-1.5 text-[11px] text-ink-mute">
              <span className={`h-1.5 w-1.5 rounded-full ${readonly ? 'bg-ink-faint' : 'bg-ok'}`} />
              {readonly ? '只读' : '已自动保存'}
            </span>
            <div className="flex items-center rounded-ctl border border-line bg-surface-sunken p-[2px]">
              {(['edit', 'view'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`h-[22px] rounded-[5px] px-2 text-[11px] transition-colors ${
                    mode === m ? 'bg-white font-medium text-ink shadow-sm' : 'text-ink-mute hover:text-ink'
                  }`}
                >
                  {m === 'edit' ? '编辑' : '查看'}
                </button>
              ))}
            </div>
            <Btn variant="ghost" size="sm" onClick={openDialog} title="导出 Markdown 文档或 IR 备份（⌘E）">
              <ExportIcon size={13} />
              导出
            </Btn>
          </div>
        </header>

        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto bg-surface-sunken px-5 py-4">
          <BasicSection tool={activeTool} readonly={readonly} />

          <SchemaSection title="请求参数" section="input" tool={activeTool} readonly={readonly} />

          <ExamplesCard title="请求示例" section="input" tool={activeTool} readonly={readonly} />

          <SchemaSection title="响应参数" section="output" tool={activeTool} readonly={readonly} />

          <ExamplesCard title="响应示例" section="output" tool={activeTool} readonly={readonly} />

          <AnnotationsSection tool={activeTool} readonly={readonly} />
        </div>
      </section>

      {/* 预览 */}
      <PreviewPanel tool={activeTool} />
    </div>
  )
}

function BasicSection({ tool, readonly }: { tool: Tool; readonly: boolean }) {
  const { dispatch } = useStore()
  const patch = (p: Partial<Tool>) => dispatch({ type: 'tool/patch', toolId: tool.id, patch: p })

  /** 输入框基础样式：不设宽度，由外层决定是 flex-1 还是 w-full */
  const cell = 'rounded-[6px] border border-transparent bg-transparent px-2 py-[6px] text-[12.5px] transition-colors hover:border-line focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/12 disabled:cursor-default disabled:bg-surface-sunken disabled:text-ink-sub disabled:hover:border-transparent'
  /** 标签与输入框同行：pt-[8px] 让标签基线与输入框首行文字对齐 */
  const label = 'w-[52px] shrink-0 pt-[8px] text-[11.5px] font-medium text-ink-sub'

  return (
    <section className="mb-3 rounded-card border border-line bg-white p-4 pb-3">
      <SectionTitle>基本信息</SectionTitle>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
        <div className="flex items-start gap-2">
          <span className={label}>英文名</span>
          <input
            value={tool.name}
            disabled={readonly}
            autoFocus={tool.name.startsWith('new_tool_')}
            onFocus={(e) => {
              if (tool.name.startsWith('new_tool_')) e.currentTarget.select()
            }}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="update_order_status"
            className={`${cell} min-w-0 flex-1 border-line bg-white font-mono`}
          />
        </div>

        <div className="flex items-start gap-2">
          <span className={label}>中文名</span>
          <input
            value={tool.title}
            disabled={readonly}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="更新订单状态"
            className={`${cell} min-w-0 flex-1 border-line bg-white`}
          />
        </div>
      </div>

      <div className="mt-2.5 flex items-start gap-2">
        <span className={label}>外部描述</span>
        <div className="relative min-w-0 flex-1">
          <textarea
            value={tool.description}
            disabled={readonly}
            onChange={(e) => patch({ description: e.target.value })}
            rows={2}
            placeholder="面向 Agent 调用的工具描述"
            className={`${cell} w-full resize-none border-line bg-white pr-11 leading-[19px]`}
          />
          <span className="pointer-events-none absolute right-2 bottom-[5px] text-[10px] text-ink-faint">
            {tool.description.length} 字
          </span>
        </div>
      </div>

      {/* 内部说明：设计期字段，不进协议，只随 IR 备份与导出走 */}
      <div className="mt-2.5 flex items-start gap-2">
        <span className={label}>内部说明</span>
        <div className="relative min-w-0 flex-1">
          <textarea
            value={tool.internalNotes}
            disabled={readonly}
            onChange={(e) => patch({ internalNotes: e.target.value })}
            rows={2}
            placeholder="面向 SDD 实现的工具说明"
            className={`${cell} w-full resize-none border-line bg-white pr-11 leading-[19px]`}
          />
          <span className="pointer-events-none absolute right-2 bottom-[5px] text-[10px] text-ink-faint">
            {tool.internalNotes.length} 字
          </span>
        </div>
      </div>
    </section>
  )
}

function SchemaSection({
  title,
  tool,
  section,
  readonly,
}: {
  title: string
  tool: Tool
  section: SectionKey
  readonly: boolean
}) {
  const { dispatch } = useStore()
  const fields = tool[section]
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  /** 新增行后把焦点落到它的字段名上，省掉一次点击 */
  const [focusId, setFocusId] = useState<string | null>(null)

  // 焦点只够用一次：折叠展开会重新挂载子行，残留的标记会再次抢焦点
  useEffect(() => {
    if (!focusId) return
    const t = window.setTimeout(() => setFocusId(null), 600)
    return () => window.clearTimeout(t)
  }, [focusId])

  const setFields = (next: SchemaField[], silent = false) =>
    dispatch({
      type: 'tool/patch',
      toolId: tool.id,
      patch: { [section]: next } as Partial<Tool>,
      silent,
    })

  /**
   * 空 schema 默认给一行空白字段，打开就能直接填，不用先找地方加。
   * 只在这一节第一次打开时补一次：用户把最后一行删掉后不再自动补，
   * 那时显示的是带加号的占位行，避免「删了又回来」的错觉。
   * 这一行不碰 updatedAt——只是打开看看，不该改「更新时间」。
   */
  const seeded = useRef<string | null>(null)
  useEffect(() => {
    const key = `${tool.id}:${section}`
    if (readonly || seeded.current === key) return
    seeded.current = key
    if (fields.length === 0) setFields([newField()], true)
  }, [tool.id, section, readonly, fields.length])

  const updateField = (id: string, patch: Partial<SchemaField>) =>
    setFields(updateFieldInTree(fields, id, patch))

  const removeField = (id: string) => {
    setFields(removeFieldFromTree(fields, id))
    if (focusId === id) setFocusId(null)
  }

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const expand = (id: string) =>
    setCollapsed((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })

  /** 加号默认动作：在被点的那一行后面插入同级字段 */
  const addSibling = (id: string) => {
    const created = newField()
    setFields(insertSiblingAfter(fields, id, created))
    setFocusId(created.id)
  }

  /** 加子级：object 直接挂；array 落到 items 行，items 还是标量就先提升为 object */
  const addChild = (field: SchemaField) => {
    const created = newField()

    if (field.type === 'object') {
      setFields(appendChildTo(fields, field.id, created))
      expand(field.id)
      setFocusId(created.id)
      return
    }

    // array：先确保有 items 承载行，再往元素结构里加字段
    let base = fields
    let items = field.children.find((c) => c.isItems)
    if (!items) {
      items = newItemsField()
      base = updateFieldInTree(fields, field.id, { children: [...field.children, items] })
    }
    if (items.type !== 'object') base = updateFieldInTree(base, items.id, { type: 'object', enumValues: [] })
    setFields(appendChildTo(base, items.id, created))
    expand(items.id)
    expand(field.id)
    setFocusId(created.id)
  }

  /** 查看态不显示还没填英文名的草稿行——它们本来就不进 schema */
  const shown = readonly ? stripDrafts(fields) : fields

  const renderLevel = (list: SchemaField[], depth: number): React.ReactNode =>
    list.map((field) => {
      const branch = field.type === 'object' || field.type === 'array'
      const open = !collapsed.has(field.id)
      // object 只渲染 properties，array 只渲染 items 承载行；类型切换后的残留不显示
      const kids =
        field.type === 'object'
          ? field.children.filter((c) => !c.isItems)
          : field.children.filter((c) => c.isItems)
      return (
        <Fragment key={field.id}>
          <SchemaRow
            field={field}
            depth={depth}
            readonly={readonly}
            branch={branch}
            open={open}
            focus={focusId === field.id}
            onFocused={() => setFocusId(null)}
            onToggle={() => toggle(field.id)}
            onPatch={(patch) => updateField(field.id, patch)}
            onChangeType={(type) => updateField(field.id, applyType(field, type))}
            onAddSibling={() => addSibling(field.id)}
            onAddChild={() => addChild(field)}
            onRemove={() => removeField(field.id)}
          />
          {branch &&
            open &&
            (kids.length > 0 ? (
              renderLevel(kids, depth + 1)
            ) : readonly ? (
              <div
                className="py-1 text-[10.5px] text-ink-faint"
                style={{ paddingLeft: 6 + (depth + 1) * 18 + 30 }}
              >
                暂无字段
              </div>
            ) : (
              <EmptyRow depth={depth + 1} onAdd={() => addChild(field)} />
            ))}
        </Fragment>
      )
    })

  return (
    <section className="mb-3 rounded-card border border-line bg-white p-4">
      <SectionTitle
        right={
          <span className="font-mono text-[10px] text-ink-faint">{countFieldsIn(fields)} 个字段</span>
        }
      >
        {title}
      </SectionTitle>

      <div className={`${SCHEMA_GRID} pb-1.5`}>
        <span className="flex items-center">
          <span className="mr-[2px] h-[18px] w-[14px] shrink-0" />
          <span className="px-1.5 text-[10.5px] font-medium text-ink-faint">英文名</span>
        </span>
        <span className="px-1.5 text-[10.5px] font-medium text-ink-faint">中文名</span>
        <span className="px-1.5 text-[10.5px] font-medium text-ink-faint">类型</span>
        <span className="text-[10.5px] font-medium text-ink-faint">必填</span>
        <span className="px-1.5 text-[10.5px] font-medium text-ink-faint">说明</span>
        <span />
        <span />
      </div>

      <div>
        {shown.length > 0 ? (
          renderLevel(shown, 0)
        ) : readonly ? (
          <p className="px-1.5 py-2 text-[11.5px] text-ink-faint">这个工具没有声明字段。</p>
        ) : (
          <EmptyRow
            depth={0}
            onAdd={() => {
              const created = newField()
              setFields([created])
              setFocusId(created.id)
            }}
          />
        )}
      </div>

      {!readonly && countFieldsIn(fields) === 0 && (
        <p className="mt-1.5 px-1.5 text-[10.5px] text-ink-faint">
          英文名留空的行不会写入 schema，{section === 'input' ? '不需要入参' : '暂不声明返回结构'}时可以直接不填。
        </p>
      )}
    </section>
  )
}

/**
 * 请求 / 响应示例。示例只是文档素材，不进协议表示——
 * 展示时按 JSON 着色并格式化，编辑时按原文保存，写到一半也不改写内容。
 */
function ExamplesCard({
  title,
  section,
  tool,
  readonly,
}: {
  title: string
  section: SectionKey
  tool: Tool
  readonly: boolean
}) {
  const { dispatch } = useStore()
  const key = section === 'input' ? 'requestExamples' : 'responseExamples'
  const list = tool[key] ?? []

  /** 正在编辑的下标，null 表示浏览态 */
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState('')

  const commit = (next: string[]) =>
    dispatch({ type: 'tool/patch', toolId: tool.id, patch: { [key]: next } as Partial<Tool> })

  const add = () => {
    // 还有未收尾的编辑时先落定，别让刚写的内容白白丢掉
    let base = list
    if (editing !== null) {
      const body = draft.trim()
      base = body
        ? list.map((item, i) => (i === editing ? body : item))
        : list.filter((_, i) => i !== editing)
    }
    commit([...base, ''])
    setDraft('')
    setEditing(base.length)
  }

  const cancel = () => {
    // 新增的空白占位不该留在列表里
    if (editing !== null && !(list[editing] ?? '').trim()) {
      commit(list.filter((_, i) => i !== editing))
    }
    setEditing(null)
  }

  const save = () => {
    if (editing === null) return
    const body = draft.trim()
    if (!body) return
    commit(list.map((item, i) => (i === editing ? body : item)))
    setEditing(null)
  }

  const remove = (index: number) => {
    setEditing(null)
    commit(list.filter((_, i) => i !== index))
  }

  const valid = isJsonText(draft)

  return (
    <section className="mb-3 rounded-card border border-line bg-white p-4">
      <SectionTitle
        right={
          readonly ? (
            list.length > 0 ? (
              <span className="font-mono text-[10px] text-ink-faint">{list.length} 条</span>
            ) : null
          ) : list.length > 0 ? (
            <button
              type="button"
              onClick={add}
              className="inline-flex items-center gap-1 rounded-[5px] px-1 py-[2px] text-[11.5px] font-medium text-brand transition-colors hover:bg-brand-soft"
            >
              <PlusIcon size={11} />
              添加
            </button>
          ) : null
        }
      >
        {title}
      </SectionTitle>

      <div className="space-y-1.5">
        {list.map((body, index) =>
          editing === index ? (
            <div key={index} className="overflow-hidden rounded-ctl border border-brand-line bg-white shadow-[0_0_0_2px_rgba(76,91,212,0.08)]">
              <textarea
                autoFocus
                value={draft}
                spellCheck={false}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    cancel()
                  }
                  // ⌘/Ctrl + Enter 直接收尾，长示例不用去够按钮
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault()
                    save()
                  }
                }}
                rows={6}
                placeholder={'{\n  "order_id": "SO202610200001"\n}'}
                className="scroll-thin w-full resize-y bg-white px-2.5 py-2 font-mono text-[11px] leading-[17px] text-ink placeholder:text-ink-faint focus:outline-none"
              />
              <div className="flex items-center gap-2 border-t border-line-soft bg-surface-sunken/50 px-2 py-1.5">
                <span className={`text-[10.5px] ${valid ? 'text-ink-faint' : 'text-[#C6802A]'}`}>
                  {valid ? '合法 JSON' : '还不是合法 JSON，可以继续写'}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <Btn variant="ghost" size="sm" onClick={cancel}>
                    取消
                  </Btn>
                  <Btn variant="primary" size="sm" onClick={save} disabled={!draft.trim()}>
                    保存
                  </Btn>
                </div>
              </div>
            </div>
          ) : (
            <div
              key={index}
              className="group relative overflow-hidden rounded-ctl border border-line bg-surface-sunken/40"
            >
              <div className="absolute right-1 top-1 flex items-center gap-0.5">
                {!readonly && (
                  <>
                    <button
                      type="button"
                      title="编辑示例"
                      onClick={() => {
                        setDraft(body)
                        setEditing(index)
                      }}
                      className="flex h-[22px] w-[22px] items-center justify-center rounded-[5px] text-ink-faint opacity-60 transition-colors hover:bg-white hover:text-ink group-hover:opacity-100"
                    >
                      <PencilIcon size={11} />
                    </button>
                    <button
                      type="button"
                      title="删除示例"
                      onClick={() => remove(index)}
                      className="flex h-[22px] w-[22px] items-center justify-center rounded-[5px] text-ink-faint opacity-60 transition-colors hover:bg-white hover:text-[#D9534F] group-hover:opacity-100"
                    >
                      <TrashIcon size={11} />
                    </button>
                  </>
                )}
              </div>
              {body.trim() ? (
                <pre
                  className="scroll-thin max-h-[240px] overflow-auto px-2.5 py-2 pr-14 font-mono text-[11px] leading-[17px] text-ink-sub"
                  dangerouslySetInnerHTML={{ __html: highlight(formatExample(body)) }}
                />
              ) : (
                <p className="px-2.5 py-2 text-[11px] text-ink-faint">空示例</p>
              )}
            </div>
          ),
        )}

        {list.length === 0 &&
          (readonly ? (
            <p className="text-[11.5px] text-ink-faint">没有示例。</p>
          ) : (
            <button
              type="button"
              onClick={add}
              className="flex w-full items-center justify-center gap-1 rounded-ctl border border-dashed border-line py-2.5 text-[11.5px] text-ink-mute transition-colors hover:border-brand-line hover:bg-brand-soft/40 hover:text-brand"
            >
              <PlusIcon size={11} />
              添加{title}
            </button>
          ))}
      </div>
    </section>
  )
}

/** 一行字段。缩进只作用于名称列，类型 / 必填 / 说明保持固定列位 */
function SchemaRow({
  field,
  depth,
  readonly,
  branch,
  open,
  focus,
  onFocused,
  onToggle,
  onPatch,
  onChangeType,
  onAddSibling,
  onAddChild,
  onRemove,
}: {
  field: SchemaField
  depth: number
  readonly: boolean
  branch: boolean
  open: boolean
  focus: boolean
  onFocused: () => void
  onToggle: () => void
  onPatch: (patch: Partial<SchemaField>) => void
  onChangeType: (type: JsonSchemaType) => void
  onAddSibling: () => void
  onAddChild: () => void
  onRemove: () => void
}) {
  const cell =
    'w-full rounded-[6px] border border-transparent bg-transparent px-1.5 py-[4px] text-[11.5px] transition-colors hover:border-line focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/12 disabled:cursor-default disabled:bg-surface-sunken/70 disabled:text-ink-sub'

  return (
    <div
      data-field-id={field.id}
      data-field-name={field.isItems ? 'ITEMS' : field.name}
      data-depth={depth}
      className={`${SCHEMA_GRID} rounded-[5px] hover:bg-surface-sunken/50`}
    >
      <div className="flex min-w-0 items-center" style={{ paddingLeft: depth * 18 }}>
        {branch ? (
          <button
            type="button"
            onClick={onToggle}
            className="mr-[2px] flex h-[18px] w-[14px] shrink-0 items-center justify-center rounded-[3px] text-ink-faint transition-colors hover:bg-line/70 hover:text-ink-sub"
            title={open ? '收起子级' : '展开子级'}
          >
            {open ? (
              <ChevronDownIcon size={10} strokeWidth={2.2} />
            ) : (
              <ChevronRightIcon size={10} strokeWidth={2.2} />
            )}
          </button>
        ) : (
          <span className="mr-[2px] h-[18px] w-[14px] shrink-0" />
        )}

        {field.isItems ? (
          <span
            className="inline-flex h-[18px] shrink-0 items-center rounded-[3px] bg-[#EEEDFD] px-1 font-mono text-[9px] font-semibold uppercase tracking-[0.06em] text-[#6B57D2]"
            title="数组的元素结构，不参与字段名与必填"
          >
            items
          </span>
        ) : (
          <input
            value={field.name}
            disabled={readonly}
            autoFocus={focus}
            onFocus={() => {
              if (focus) onFocused()
            }}
            onChange={(e) => onPatch({ name: e.target.value })}
            placeholder="order_id"
            className={`${cell} font-mono`}
          />
        )}
      </div>

      {field.isItems ? (
        <span className="px-1.5 text-[10px] text-ink-faint">—</span>
      ) : (
        <input
          value={field.title}
          disabled={readonly}
          onChange={(e) => onPatch({ title: e.target.value })}
          placeholder="中文名"
          className={cell}
        />
      )}

      <TypeButton
        field={field}
        readonly={readonly}
        onChangeType={onChangeType}
        onChangeEnums={(enumValues) => onPatch({ enumValues })}
      />

      {field.isItems ? (
        <span className="text-[10px] text-ink-faint">—</span>
      ) : (
        <button
          type="button"
          disabled={readonly}
          onClick={() => onPatch({ required: !field.required })}
          className="flex items-center text-left disabled:cursor-default"
          aria-label={field.required ? '必填，点击取消' : '非必填，点击设为必填'}
          aria-pressed={field.required}
        >
          <span
            className={`flex h-[13px] w-[13px] items-center justify-center rounded-[3px] border transition-colors ${
              field.required ? 'border-brand bg-brand' : 'border-[#C8CDD6] bg-white'
            }`}
          >
            {field.required && <CheckIcon size={9} strokeWidth={3.2} className="text-white" />}
          </span>
        </button>
      )}

      <input
        value={field.description}
        disabled={readonly}
        onChange={(e) => onPatch({ description: e.target.value })}
        placeholder={field.isItems ? '元素整体的含义' : '这个字段的含义、格式或取值范围'}
        className={cell}
      />

      {readonly || (field.isItems && !branch) ? (
        <span />
      ) : (
        <AddButton
          isItems={!!field.isItems}
          branch={branch}
          onAddSibling={onAddSibling}
          onAddChild={onAddChild}
        />
      )}

      {field.isItems || readonly ? <span /> : <RemoveButton onConfirm={onRemove} />}
    </div>
  )
}

/** 去掉没填英文名的草稿行（含嵌套），只用于只读展示 */
function stripDrafts(fields: SchemaField[]): SchemaField[] {
  return fields
    .filter((field) => field.isItems || field.name.trim())
    .map((field) => (field.children.length ? { ...field, children: stripDrafts(field.children) } : field))
}

/** 空对象里的占位行：点右侧 + 落下第一个字段 */
function EmptyRow({ depth, onAdd }: { depth: number; onAdd: () => void }) {
  return (
    <div className={`${SCHEMA_GRID} rounded-[5px]`} data-empty-row={depth}>
      <div className="flex min-w-0 items-center" style={{ paddingLeft: depth * 18 }}>
        <span className="mr-[2px] h-[18px] w-[14px] shrink-0" />
        <span className="px-1.5 text-[11.5px] text-ink-faint/60">暂无字段</span>
      </div>
      <span />
      <span />
      <span />
      <span className="px-1.5 text-[10.5px] text-ink-faint/70">点右侧 + 添加</span>
      <button
        type="button"
        onClick={onAdd}
        title="添加字段"
        className="flex h-6 w-6 items-center justify-center rounded-[5px] text-ink-faint transition-colors hover:bg-white hover:text-brand"
      >
        <PlusIcon size={12} strokeWidth={1.9} />
      </button>
      <span />
    </div>
  )
}

/**
 * 加号。普通字段点一下在它后面插同级；object / array 悬停时给一个二选一浮层，
 * 直接点仍是默认的同级插入。items 行只有一个动作：往元素结构里加字段。
 */
function AddButton({
  isItems,
  branch,
  onAddSibling,
  onAddChild,
}: {
  isItems: boolean
  branch: boolean
  onAddSibling: () => void
  onAddChild: () => void
}) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const openTimer = useRef<number | null>(null)
  const closeTimer = useRef<number | null>(null)

  const stopTimers = () => {
    if (openTimer.current) window.clearTimeout(openTimer.current)
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    openTimer.current = null
    closeTimer.current = null
  }

  useEffect(() => stopTimers, [])

  useEffect(() => {
    if (!menu) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target) || btnRef.current?.contains(target)) return
      setMenu(null)
    }
    // 浮层是 fixed 定位，滚动后必须收起，否则会飘在错误的位置
    const onScroll = () => setMenu(null)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('scroll', onScroll, true)
    }
  }, [menu])

  const hoverIn = () => {
    if (isItems || !branch) return
    stopTimers()
    openTimer.current = window.setTimeout(() => {
      const el = btnRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const w = 148
      const h = 68
      const x = Math.max(12, Math.min(r.right - w, window.innerWidth - w - 12))
      const y = r.bottom + 6 + h > window.innerHeight - 8 ? r.top - h - 6 : r.bottom + 6
      setMenu({ x, y })
    }, 220)
  }

  const hoverOut = () => {
    if (openTimer.current) {
      window.clearTimeout(openTimer.current)
      openTimer.current = null
    }
    closeTimer.current = window.setTimeout(() => setMenu(null), 200)
  }

  const pick = (action: () => void) => {
    stopTimers()
    setMenu(null)
    action()
  }

  const title = isItems
    ? '往数组元素里添加字段'
    : branch
      ? '点击在下方插入同级字段；悬停可选择加到内部'
      : '在下方插入同级字段'

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => pick(isItems ? onAddChild : onAddSibling)}
        onMouseEnter={hoverIn}
        onMouseLeave={hoverOut}
        title={title}
        className={`flex h-6 w-6 items-center justify-center rounded-[5px] transition-colors ${
          menu ? 'bg-white text-brand' : 'text-ink-faint hover:bg-white hover:text-brand'
        }`}
      >
        <PlusIcon size={12} strokeWidth={1.9} />
      </button>

      {menu && (
        <div
          ref={menuRef}
          onMouseEnter={stopTimers}
          onMouseLeave={hoverOut}
          className="fixed z-50 w-[148px] overflow-hidden rounded-[9px] border border-line bg-white p-[3px] shadow-pop"
          style={{ left: menu.x, top: menu.y }}
        >
          <button
            type="button"
            onClick={() => pick(onAddSibling)}
            className="flex h-[28px] w-full items-center rounded-[6px] px-2 text-left text-[11.5px] text-ink transition-colors hover:bg-surface-sunken"
          >
            添加同级节点
          </button>
          <button
            type="button"
            onClick={() => pick(onAddChild)}
            className="flex h-[28px] w-full items-center rounded-[6px] px-2 text-left text-[11.5px] text-ink transition-colors hover:bg-surface-sunken"
          >
            添加子节点
          </button>
        </div>
      )}
    </>
  )
}

/** 减号：第一次点变成红叉，2 秒内再点一次才真正删除；超时或失焦自动复位 */
function RemoveButton({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false)
  const timer = useRef<number | null>(null)

  const disarm = () => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
    setArmed(false)
  }

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
    },
    [],
  )

  return (
    <button
      type="button"
      onBlur={disarm}
      onClick={() => {
        if (armed) {
          disarm()
          onConfirm()
          return
        }
        setArmed(true)
        timer.current = window.setTimeout(() => setArmed(false), 2000)
      }}
      title={armed ? '再点一次删除这一行' : '删除这一行（需点两次）'}
      className={`flex h-6 w-6 items-center justify-center rounded-[5px] transition-colors ${
        armed
          ? 'bg-[#FCEEEC] text-[#C0483E]'
          : 'text-ink-faint hover:bg-white hover:text-ink-sub'
      }`}
    >
      {armed ? <XCircleIcon size={14} strokeWidth={1.9} /> : <MinusIcon size={14} strokeWidth={1.5} />}
    </button>
  )
}

function TypeButton({
  field,
  readonly,
  onChangeType,
  onChangeEnums,
}: {
  field: SchemaField
  readonly: boolean
  onChangeType: (t: JsonSchemaType) => void
  onChangeEnums: (v: string[]) => void
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [draft, setDraft] = useState('')
  const ref = useClickOutside<HTMLDivElement>(!!pos, () => setPos(null))

  const open = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (readonly) return
    const r = e.currentTarget.getBoundingClientRect()
    const width = 440
    const x = Math.min(r.left, window.innerWidth - width - 16)
    const y = Math.min(r.bottom + 6, window.innerHeight - 420)
    setPos({ x, y })
    setDraft('')
  }

  const canEnum = ENUM_CAPABLE.includes(field.type)

  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={readonly}
        className={`flex h-[26px] w-full items-center gap-1 rounded-[6px] border px-1.5 text-left transition-colors disabled:cursor-default ${
          pos
            ? 'border-brand bg-white'
            : 'border-line bg-surface-sunken/60 hover:border-[#D5D9E0] hover:bg-white'
        }`}
      >
        <span className="truncate font-mono text-[11px] text-ink">{field.type}</span>
        {field.enumValues.length > 0 && (
          <span className="h-1 w-1 shrink-0 rounded-full bg-brand" title={`${field.enumValues.length} 个候选值`} />
        )}
        <ChevronDownIcon size={11} className="ml-auto shrink-0 text-ink-faint" />
      </button>

      {pos && (
        <div
          ref={ref}
          className="fixed z-50 w-[440px] overflow-auto rounded-[10px] border border-line bg-white shadow-pop"
          style={{ left: pos.x, top: pos.y, maxHeight: 'min(70vh, 420px)' }}
        >
          <div className="px-2 py-1.5">
            <div className="px-1.5 pb-1 text-[10px] font-medium uppercase tracking-[0.06em] text-ink-faint">
              JSON Schema 类型
            </div>
            {JSON_SCHEMA_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  onChangeType(t)
                  setPos(null)
                }}
                className={`flex w-full items-center gap-2 rounded-[6px] px-1.5 py-[5px] text-left transition-colors ${
                  field.type === t ? 'bg-brand-soft' : 'hover:bg-surface-sunken'
                }`}
              >
                <span className="w-3 shrink-0">
                  {field.type === t && <CheckIcon size={11} strokeWidth={2.4} className="text-brand" />}
                </span>
                <span
                  className={`w-[62px] shrink-0 font-mono text-[11.5px] ${
                    field.type === t ? 'font-medium text-brand' : 'text-ink'
                  }`}
                >
                  {t}
                </span>
                <span className="text-[11px] text-ink-mute">{TYPE_HINT[t]}</span>
              </button>
            ))}
          </div>

          <div className="border-t border-line-soft px-2 pb-2.5 pt-2">
            <div className="flex items-baseline gap-1.5 px-1.5">
              <span className="text-[11px] font-medium text-ink-sub">候选值</span>
              <span className="text-[10.5px] text-ink-faint">仅需限定取值范围时填写，写入 enum</span>
            </div>

            {!canEnum ? (
              <p className="mt-1.5 rounded-[6px] bg-surface-sunken px-2 py-1.5 text-[10.5px] text-ink-mute">
                {field.type} 类型不支持候选值。改用 string、number 或 integer 后可添加。
              </p>
            ) : (
              <>
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  {field.enumValues.map((v) => (
                    <span
                      key={v}
                      className="inline-flex h-[22px] items-center gap-1 rounded-[5px] border border-brand-line bg-brand-soft pl-1.5 pr-1 font-mono text-[10.5px] text-brand"
                    >
                      {v}
                      <button
                        type="button"
                        onClick={() => onChangeEnums(field.enumValues.filter((x) => x !== v))}
                        className="flex h-3.5 w-3.5 items-center justify-center rounded-[3px] hover:bg-brand-line/70"
                      >
                        <XIcon size={8} strokeWidth={2.4} />
                      </button>
                    </span>
                  ))}
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return
                      const v = draft.trim()
                      if (v && !field.enumValues.includes(v)) onChangeEnums([...field.enumValues, v])
                      setDraft('')
                    }}
                    placeholder="+ 添加"
                    className="h-[22px] w-[72px] rounded-[5px] border border-dashed border-line bg-white px-1.5 font-mono text-[10.5px] placeholder:text-ink-faint focus:border-brand focus:outline-none"
                  />
                </div>
                <p className="mt-1.5 px-1.5 pb-1 text-[10px] leading-[14px] text-ink-faint">
                  按回车确认。候选值只是约束，不改变字段类型。
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function AnnotationsSection({ tool, readonly }: { tool: Tool; readonly: boolean }) {
  const { dispatch } = useStore()
  const enabled = HINTS.filter((h) => tool.annotations[h.key]).length

  return (
    <section className="mb-3 rounded-card border border-line bg-white p-4">
      <SectionTitle
        hint="点击标签切换；未选中表示该字段不写入 annotations"
        right={
          <span className="font-mono text-[10px] text-ink-faint">
            {enabled}/4 已启用
          </span>
        }
      >
        标签
      </SectionTitle>

      <div className="grid grid-cols-4 gap-2">
        {HINTS.map((h) => {
          const on = tool.annotations[h.key]
          return (
            <button
              key={h.key}
              type="button"
              disabled={readonly}
              onClick={() =>
                dispatch({
                  type: 'tool/patch',
                  toolId: tool.id,
                  patch: { annotations: { ...tool.annotations, [h.key]: !on } },
                })
              }
              className={`group flex h-[42px] flex-col justify-center gap-0.5 rounded-ctl border px-2 text-left transition-colors disabled:cursor-default disabled:opacity-70 ${
                on
                  ? 'border-brand-line bg-brand-soft'
                  : 'border-line bg-white hover:border-[#D5D9E0]'
              }`}
            >
              <span className="flex items-center gap-1">
                {on && <CheckIcon size={10} strokeWidth={2.6} className="shrink-0 text-brand" />}
                <span
                  className={`truncate font-mono text-[11px] ${on ? 'font-medium text-brand' : 'text-ink-sub'}`}
                >
                  {h.label}
                </span>
              </span>
              <span className={`truncate text-[10px] ${on ? 'text-brand/70' : 'text-ink-faint'}`}>{h.note}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function PreviewPanel({ tool }: { tool: Tool }) {
  const [copied, setCopied] = useState(false)
  const json = useMemo(() => JSON.stringify(buildToolJson(tool), null, 2), [tool])
  const html = useMemo(() => highlight(json), [json])
  const timer = useRef<number | null>(null)

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])

  return (
    <aside className="flex w-[400px] shrink-0 flex-col border-l border-line bg-[#FBFBFC]">
      <div className="flex h-[52px] shrink-0 items-center gap-2 border-b border-line px-4">
        <span className="text-[12.5px] font-semibold text-ink">预览</span>
        <Chip tone="brand">JSON</Chip>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(json)
              setCopied(true)
              if (timer.current) window.clearTimeout(timer.current)
              timer.current = window.setTimeout(() => setCopied(false), 1600)
            } catch {
              setCopied(false)
            }
          }}
          className="ml-auto rounded-[5px] border border-line bg-white px-1.5 py-[3px] text-[10.5px] text-ink-sub transition-colors hover:border-ink-faint hover:text-ink"
        >
          {copied ? '已复制' : '复制'}
        </button>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-auto px-4 py-3">
        <pre
          className="whitespace-pre-wrap break-words font-mono text-[10.5px] leading-[16px] text-ink-sub"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>

      <div className="shrink-0 border-t border-line-soft px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-[10.5px] text-ink-mute">
          <CodeIcon size={11} />
          随表单实时更新 · 协议视角的工具定义，不含设计与文档素材
        </div>
      </div>
    </aside>
  )
}
