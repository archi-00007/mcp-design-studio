import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { useExport } from '../components/ExportDialog'
import { useImport } from '../components/ImportDialog'
import { DeleteToolPopover } from '../components/DeleteToolPopover'
import {
  ExportIcon,
  ImportIcon,
  GripIcon,
  PlusIcon,
  SearchIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '../components/Icons'
import { Btn } from '../components/ui'
import type { Tool } from '../types'

const PAGE_SIZES = [10, 20, 50] as const
const DEFAULT_PAGE_SIZE = 10

/** manual 表示按工具在数据里的顺序（可拖动调整）；其余三种是临时按列排序 */
type SortKey = 'manual' | 'name' | 'createdAt' | 'updatedAt'

type DropPos = 'before' | 'after'

export function Workspace() {
  const { state, dispatch, activeServer } = useStore()
  const { openDialog } = useExport()
  const { openDialog: openImport } = useImport()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE)
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'manual', dir: 'asc' })
  const [confirm, setConfirm] = useState<{ tool: Tool; rect: DOMRect } | null>(null)
  const [highlight, setHighlight] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [drop, setDrop] = useState<{ id: string; pos: DropPos } | null>(null)
  const bootRef = useRef(false)

  const closeConfirm = useCallback(() => setConfirm(null), [])

  const tools = activeServer.tools
  const canDrag = sort.key === 'manual'

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? tools.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            t.title.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q),
        )
      : [...tools]

    const key = sort.key
    if (key !== 'manual') {
      list.sort((a, b) => {
        const av = a[key]
        const bv = b[key]
        return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      })
    }
    return list
  }, [tools, query, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const current = Math.min(page, totalPages)
  const rows = filtered.slice((current - 1) * pageSize, current * pageSize)

  const toggleSort = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
    setPage(1)
  }

  /** 列排序只是临时视图，拖拽只认自定义顺序；一键退回时顺带把分页回到第一页 */
  const resetOrder = () => {
    setSort({ key: 'manual', dir: 'asc' })
    setPage(1)
  }

  // 从编辑器返回时，定位到刚才那个工具所在的页并短暂高亮
  useEffect(() => {
    if (bootRef.current) return
    bootRef.current = true
    const id = state.focusToolId
    if (!id) return
    const idx = filtered.findIndex((t) => t.id === id)
    if (idx < 0) return
    setPage(Math.floor(idx / pageSize) + 1)
    setHighlight(id)
    const timer = window.setTimeout(() => setHighlight(null), 2200)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 翻页、改页大小、搜索、换 Server 后锚点已失效，确认浮层不能留在屏幕上
  useEffect(() => {
    setConfirm(null)
  }, [current, pageSize, query, activeServer.id])

  const sortMark = (key: SortKey) =>
    sort.key === key ? (      <ChevronDownIcon
        size={11}
        strokeWidth={2}
        className={`text-brand transition-transform ${sort.dir === 'asc' ? 'rotate-180' : ''}`}
      />
    ) : null

  const th = 'text-[11.5px] font-medium text-ink-sub'
  const openTool = (id: string) => dispatch({ type: 'nav', view: { kind: 'editor', toolId: id } })

  /** 落点指示线：只在拖拽中、且不是被拖的那一行时出现 */
  const dropClass = (id: string) =>
    drop && drop.id === id && dragId !== id
      ? drop.pos === 'before'
        ? 'row-drop-before'
        : 'row-drop-after'
      : ''

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-surface-sunken">
      {/* 顶栏 */}
      <header className="flex h-[52px] shrink-0 items-center gap-1.5 border-b border-line bg-white px-5">
        <h1 className="text-[14px] font-semibold tracking-[-0.01em] text-ink">{activeServer.name}</h1>
        <ChevronRightIcon size={12} className="text-ink-faint" />
        <span className="text-[13.5px] text-ink-sub">工具列表</span>
        <div className="ml-auto flex items-center gap-2">
          <Btn variant="secondary" onClick={openImport} title="从 IR 备份还原（⌘I）">
            <ImportIcon size={14} />
            导入
          </Btn>
          <Btn variant="secondary" onClick={openDialog} title="导出 Markdown 文档或 IR 备份（⌘E）">
            <ExportIcon size={14} />
            导出
          </Btn>
        </div>
      </header>

      {/* 内容 */}
      <div className="flex min-h-0 flex-1 flex-col px-5 pb-2 pt-4">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-line bg-white shadow-card">
          {/* 卡头：搜索 + 新建 */}
          <div className="flex h-[48px] shrink-0 items-center gap-2 border-b border-line px-4">
            <div className="ml-auto flex items-center gap-2">
              {sort.key !== 'manual' && (
                <button
                  type="button"
                  onClick={resetOrder}
                  title="清除列排序，回到可拖动调整的自定义顺序"
                  className="rounded-[5px] px-2 py-[4px] text-[11.5px] text-ink-sub transition-colors hover:bg-surface-sunken hover:text-ink"
                >
                  恢复自定义顺序
                </button>
              )}
              <div className="relative">
                <SearchIcon size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setPage(1)
                  }}
                  placeholder="搜索英文名、中文名或描述"
                  className="h-7 w-[240px] rounded-ctl border border-line bg-white pl-[27px] pr-2 text-[12px] transition-colors placeholder:text-ink-faint hover:border-[#D5D9E0] focus-ring"
                />
              </div>
              <Btn variant="primary" size="sm" onClick={() => dispatch({ type: 'tool/create' })}>
                <PlusIcon size={13} strokeWidth={1.9} />
                新建
              </Btn>
            </div>
          </div>

          {/* 表体（滚动） */}
          {tools.length > 0 ? (
            <div className="scroll-thin min-h-0 flex-1 overflow-auto">
              <table className="w-full table-fixed border-collapse">
                <colgroup>
                  <col style={{ width: 30 }} />
                  <col style={{ width: 186 }} />
                  <col style={{ width: 120 }} />
                  <col />
                  <col style={{ width: 146 }} />
                  <col style={{ width: 146 }} />
                  <col style={{ width: 148 }} />
                </colgroup>
                <thead className="sticky top-0 z-10">
                  <tr className="h-[44px] border-b border-line bg-surface-sunken">
                    <th className="pl-2 pr-0 align-middle" aria-label="拖动排序" />
                    <th className="px-4 text-left align-middle">
                      <button
                        type="button"
                        onClick={() => toggleSort('name')}
                        className={`inline-flex items-center gap-1 ${th} hover:text-ink`}
                      >
                        英文名
                        {sortMark('name')}
                      </button>
                    </th>
                    <th className={`px-2 text-left align-middle ${th}`}>中文名</th>
                    <th className={`px-2 text-left align-middle ${th}`}>描述</th>
                    <th className="px-2 text-left align-middle">
                      <button
                        type="button"
                        onClick={() => toggleSort('createdAt')}
                        className={`inline-flex items-center gap-1 ${th} hover:text-ink`}
                      >
                        创建时间
                        {sortMark('createdAt')}
                      </button>
                    </th>
                    <th className="px-2 text-left align-middle">
                      <button
                        type="button"
                        onClick={() => toggleSort('updatedAt')}
                        className={`inline-flex items-center gap-1 ${th} hover:text-ink`}
                      >
                        更新时间
                        {sortMark('updatedAt')}
                      </button>
                    </th>
                    <th className={`px-2 text-center align-middle ${th}`}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((tool, rowIndex) => (
                    <tr
                      key={tool.id}
                      onDragOver={(e) => {
                        if (!dragId || dragId === tool.id) return
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                        const rect = e.currentTarget.getBoundingClientRect()
                        const pos: DropPos = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
                        if (drop?.id !== tool.id || drop.pos !== pos) setDrop({ id: tool.id, pos })
                      }}
                      onDragLeave={(e) => {
                        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
                        setDrop((d) => (d?.id === tool.id ? null : d))
                      }}
                      onDrop={(e) => {
                        if (!dragId) return
                        e.preventDefault()
                        if (dragId === tool.id) return
                        const rect = e.currentTarget.getBoundingClientRect()
                        const isBefore = e.clientY < rect.top + rect.height / 2
                        // 落在下半区 = 插到下一行之前；最后一行没有下一行，就表示挪到末尾
                        const beforeId = isBefore ? tool.id : (rows[rowIndex + 1]?.id ?? null)
                        dispatch({ type: 'tool/move', toolId: dragId, beforeId })
                        setDragId(null)
                        setDrop(null)
                      }}
                      className={`group h-[44px] border-b border-line-soft transition-colors last:border-b-0 ${
                        dragId === tool.id ? 'opacity-40' : ''
                      } ${dropClass(tool.id)} ${
                        confirm?.tool.id === tool.id
                          ? 'bg-brand-soft/60'
                          : highlight === tool.id
                            ? 'bg-brand-soft/50'
                            : 'hover:bg-surface-hover'
                      }`}
                    >
                      <td className="h-[44px] pl-2 pr-0 align-middle">
                        <button
                          type="button"
                          draggable={canDrag}
                          aria-label={`拖动调整「${tool.name}」的顺序`}
                          title={canDrag ? '拖动调整顺序' : '已按列排序，恢复自定义顺序后可拖动'}
                          onDragStart={(e) => {
                            if (!canDrag) {
                              e.preventDefault()
                              return
                            }
                            e.dataTransfer.effectAllowed = 'move'
                            // 必须带数据，否则 Firefox 不认这次拖拽
                            e.dataTransfer.setData('text/plain', tool.id)
                            const tr = e.currentTarget.closest('tr')
                            if (tr) e.dataTransfer.setDragImage(tr, 28, 22)
                            setConfirm(null)
                            setDragId(tool.id)
                            setDrop(null)
                          }}
                          onDragEnd={() => {
                            setDragId(null)
                            setDrop(null)
                          }}
                          className={`flex h-6 w-4 items-center justify-center rounded-[4px] text-ink-faint transition-colors ${
                            canDrag
                              ? 'cursor-grab group-hover:text-ink-mute hover:bg-surface-sunken active:cursor-grabbing'
                              : 'cursor-not-allowed opacity-30'
                          }`}
                        >
                          <GripIcon size={12} />
                        </button>
                      </td>
                      <td className="h-[44px] px-4 align-middle">
                        <button
                          type="button"
                          onClick={() => openTool(tool.id)}
                          className="block max-w-full truncate font-mono text-[12px] text-brand hover:underline"
                          title={tool.name}
                        >
                          {tool.name}
                        </button>
                      </td>
                      <td className="h-[44px] px-2 align-middle">
                        <button
                          type="button"
                          onClick={() => openTool(tool.id)}
                          className="block max-w-full truncate text-left text-[12px] text-ink hover:text-brand hover:underline"
                          title={tool.title}
                        >
                          {tool.title}
                        </button>
                      </td>
                      <td
                        className="h-[44px] truncate px-2 align-middle text-[12px] text-ink-mute"
                        title={tool.description}
                      >
                        {tool.description || <span className="text-ink-faint">未填写</span>}
                      </td>
                      <td
                        className="h-[44px] px-2 align-middle font-mono text-[11px] whitespace-nowrap text-ink-mute"
                        title={`创建于 ${tool.createdAt}`}
                      >
                        {tool.createdAt}
                      </td>
                      <td
                        className="h-[44px] px-2 align-middle font-mono text-[11px] whitespace-nowrap text-ink-mute"
                        title={`更新于 ${tool.updatedAt}`}
                      >
                        {tool.updatedAt}
                      </td>
                      <td className="h-[44px] px-1.5 align-middle">
                        <div className="flex items-center justify-center gap-1 whitespace-nowrap text-[11.5px]">
                          <button
                            type="button"
                            onClick={() => openTool(tool.id)}
                            className="shrink-0 rounded-[5px] px-2 py-[4px] text-brand transition-colors hover:bg-brand-soft outline-none focus-visible:ring-2 focus-visible:ring-brand/25"
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            onClick={() => dispatch({ type: 'tool/duplicate', toolId: tool.id })}
                            className="shrink-0 rounded-[5px] px-2 py-[4px] text-brand transition-colors hover:bg-brand-soft outline-none focus-visible:ring-2 focus-visible:ring-brand/25"
                            title={`复制「${tool.name}」，并打开副本`}
                          >
                            复制
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect()
                              setConfirm({ tool, rect })
                            }}
                            className={`shrink-0 rounded-[5px] px-2 py-[4px] transition-colors outline-none hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand/25 ${
                              confirm?.tool.id === tool.id ? 'bg-brand-soft text-brand' : 'text-brand'
                            }`}
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-16 text-center">
                        <div className="text-[12.5px] text-ink-sub">没有匹配「{query}」的工具</div>
                        <div className="mt-1 text-[11.5px] text-ink-faint">换个关键词，或清空搜索</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center py-16">
              <div className="text-[12.5px] text-ink-sub">这个 Server 还没有工具</div>
              <div className="mt-1 text-[11.5px] text-ink-faint">
                从新建工具开始，字段按 mcpdesc v0.8.0 组织
              </div>
              <Btn variant="primary" size="sm" className="mt-4" onClick={() => dispatch({ type: 'tool/create' })}>
                <PlusIcon size={13} />
                新建第一个工具
              </Btn>
            </div>
          )}

          {/* 页脚分页 */}
          {tools.length > 0 && (
            <div className="flex h-[44px] shrink-0 items-center gap-2 border-t border-line px-4">
              <span className="font-mono text-[11px] text-ink-mute">
                显示 {filtered.length === 0 ? 0 : (current - 1) * pageSize + 1}–
                {Math.min(current * pageSize, filtered.length)} / 共 {filtered.length} 条
              </span>
              <div className="ml-auto flex items-center gap-3">
                <label className="flex items-center gap-1 text-[11px] text-ink-mute">
                  每页
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value))
                      setPage(1)
                    }}
                    aria-label="每页显示行数"
                    className="h-6 cursor-pointer rounded-[5px] border border-line bg-white pl-1.5 pr-1 font-mono text-[11px] text-ink-sub transition-colors hover:border-ink-faint focus-ring"
                  >
                    {PAGE_SIZES.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  条
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={current <= 1}
                    onClick={() => setPage(current - 1)}
                    className="flex h-6 w-6 items-center justify-center rounded-[5px] border border-line text-ink-sub transition-colors hover:border-ink-faint disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="上一页"
                  >
                    <ChevronRightIcon size={12} className="rotate-180" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      aria-current={p === current ? 'page' : undefined}
                      className={`h-6 min-w-6 rounded-[5px] px-1.5 font-mono text-[11px] transition-colors ${
                        p === current
                          ? 'bg-brand text-white'
                          : 'border border-line text-ink-sub hover:border-ink-faint'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={current >= totalPages}
                    onClick={() => setPage(current + 1)}
                    className="flex h-6 w-6 items-center justify-center rounded-[5px] border border-line text-ink-sub transition-colors hover:border-ink-faint disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="下一页"
                  >
                    <ChevronRightIcon size={12} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <p className="mt-2 shrink-0 px-1 text-[11px] text-ink-faint">
          数据保存在浏览器本地，刷新不丢。换设备前先导出 IR，到新设备用「导入」接回来。
        </p>
      </div>

      {confirm && (
        <DeleteToolPopover
          tool={confirm.tool}
          anchor={confirm.rect}
          onCancel={closeConfirm}
          onConfirm={() => {
            dispatch({ type: 'tool/delete', toolId: confirm.tool.id })
            closeConfirm()
          }}
        />
      )}
    </main>
  )
}
