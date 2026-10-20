import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import {
  buildMarkdown,
  byteSize,
  copyText,
  downloadText,
  fileNameFor,
  formatBytes,
  irText,
  mimeFor,
  type Artifact,
  type ExportSelection,
} from '../lib/export'
import { highlight } from '../lib/highlight'
import type { Tool } from '../types'
import { MarkdownView } from './MarkdownView'
import {
  CheckIcon,
  CodeIcon,
  DownloadIcon,
  FileTextIcon,
  LayersIcon,
  SearchIcon,
} from './Icons'
import { Btn, Chip, Modal } from './ui'

/* ------------------------------------------------------------- 弹层入口 */

interface ExportApi {
  openDialog: () => void
  isOpen: boolean
}

const ExportCtx = createContext<ExportApi | null>(null)

export function ExportProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  // ⌘/Ctrl + E：哪儿都能叫出导出
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const value = useMemo<ExportApi>(() => ({ openDialog: () => setOpen(true), isOpen: open }), [open])

  return (
    <ExportCtx.Provider value={value}>
      {children}
      <ExportDialog open={open} onClose={() => setOpen(false)} />
    </ExportCtx.Provider>
  )
}

export function useExport(): ExportApi {
  const ctx = useContext(ExportCtx)
  if (!ctx) throw new Error('useExport must be used within ExportProvider')
  return ctx
}

/* --------------------------------------------------------------- 主体 */

type Scope = 'all' | 'pick'

const ARTIFACTS: {
  key: Artifact
  title: string
  ext: string
  desc: string
  icon: (p: { size?: number; className?: string }) => React.ReactElement
}[] = [
  {
    key: 'markdown',
    title: 'Markdown 文档',
    ext: '.md',
    desc: '工具索引 + 入参、返回表格，给人读也方便投喂。',
    icon: FileTextIcon,
  },
  {
    key: 'ir',
    title: 'IR 备份文件',
    ext: '.json',
    desc: '完整结构，用于备份、迁移与重新导入。',
    icon: LayersIcon,
  },
]

function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { activeServer } = useStore()
  const [scope, setScope] = useState<Scope>('all')
  const [picked, setPicked] = useState<Set<string>>(() => new Set())
  const [query, setQuery] = useState('')
  const [artifact, setArtifact] = useState<Artifact>('markdown')
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)
  const copyTimer = useRef<number | null>(null)
  const savedTimer = useRef<number | null>(null)

  // 每次打开都从「全部工具 + Markdown」起步，并预选全部，切到选择模式时不用再点全选
  useEffect(() => {
    if (!open) return
    setScope('all')
    setArtifact('markdown')
    setQuery('')
    setCopied(false)
    setSaved(false)
    setPicked(new Set(activeServer.tools.map((t) => t.id)))
  }, [open, activeServer.id])

  useEffect(
    () => () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current)
      if (savedTimer.current) window.clearTimeout(savedTimer.current)
    },
    [],
  )

  // 切产物、切范围后回到顶部，避免停在上一份文档的中间
  useEffect(() => {
    if (previewRef.current) previewRef.current.scrollTop = 0
  }, [artifact, scope, picked])

  const allTools = activeServer.tools
  const tools = scope === 'all' ? allTools : allTools.filter((t) => picked.has(t.id))

  const selection = useMemo<ExportSelection>(
    () => ({ server: activeServer, tools }),
    [activeServer, tools],
  )

  const mdText = useMemo(() => buildMarkdown(selection), [selection])
  const irTextValue = useMemo(() => irText(selection), [selection])
  const text = artifact === 'markdown' ? mdText : irTextValue
  const size = byteSize(text)

  const visible = query.trim()
    ? allTools.filter(
        (t) =>
          t.name.toLowerCase().includes(query.trim().toLowerCase()) ||
          t.title.includes(query.trim()),
      )
    : allTools

  const allPicked = allTools.length > 0 && allTools.every((t) => picked.has(t.id))
  const blocked = tools.length === 0

  const toggle = (tool: Tool) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(tool.id)) next.delete(tool.id)
      else next.add(tool.id)
      return next
    })

  const onCopy = async () => {
    const ok = await copyText(text)
    setCopied(ok)
    if (copyTimer.current) window.clearTimeout(copyTimer.current)
    copyTimer.current = window.setTimeout(() => setCopied(false), 1600)
  }

  const onDownload = () => {
    downloadText(fileNameFor(activeServer, artifact), text, mimeFor(artifact))
    setSaved(true)
    if (savedTimer.current) window.clearTimeout(savedTimer.current)
    savedTimer.current = window.setTimeout(() => setSaved(false), 2000)
  }

  const artifactSize = (key: Artifact) => formatBytes(byteSize(key === 'markdown' ? mdText : irTextValue))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="导出"
      subtitle="选择范围与产物，右侧就是将要写进文件的原文。"
      width={900}
      footer={
        <>
          <span className="mr-auto flex items-center gap-1.5 text-[11px] text-ink-faint">
            <DownloadIcon size={12} />
            {blocked
              ? '当前范围没有工具，先勾选或切回全部'
              : `将导出 ${tools.length} 个工具 · ${formatBytes(size)}`}
          </span>
          <Btn variant="ghost" onClick={onClose}>
            取消
          </Btn>
          <Btn variant="primary" disabled={blocked} onClick={onDownload}>
            {saved ? <CheckIcon size={13} strokeWidth={2.4} /> : <DownloadIcon size={13} />}
            {saved ? '已下载' : artifact === 'markdown' ? '下载 Markdown' : '下载 IR 备份'}
          </Btn>
        </>
      }
    >
      <div className="flex h-[452px] gap-4">
        {/* 左：配置 */}
        <div className="scroll-thin flex h-full w-[300px] shrink-0 flex-col gap-3 overflow-y-auto pr-0.5">
          {/* 选择工具时这一块撑满剩余高度，让清单自己滚，避免把产物挤出视野 */}
          <div className={`flex flex-col ${scope === 'pick' ? 'min-h-0 flex-1' : 'shrink-0'}`}>
            <div className="mb-1.5 flex items-baseline gap-1.5">
              <span className="text-[11.5px] font-medium text-ink-sub">导出范围</span>
              <span className="ml-auto font-mono text-[10.5px] text-ink-faint">
                {tools.length} / {allTools.length}
              </span>
            </div>

            <div className="flex rounded-ctl border border-line bg-surface-sunken p-[2px]">
              {(
                [
                  { key: 'all', label: '全部工具' },
                  { key: 'pick', label: '选择工具' },
                ] as { key: Scope; label: string }[]
              ).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setScope(item.key)}
                  className={`h-[26px] flex-1 rounded-[5px] text-[11.5px] transition-colors ${
                    scope === item.key
                      ? 'bg-white font-medium text-ink shadow-sm'
                      : 'text-ink-mute hover:text-ink'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {scope === 'pick' && (
              <div className="mt-2 flex min-h-0 flex-1 flex-col rounded-ctl border border-line bg-white">
                <div className="relative shrink-0 border-b border-line-soft">
                  <SearchIcon
                    size={12}
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-faint"
                  />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="筛选工具"
                    className="h-8 w-full rounded-t-ctl border-0 bg-transparent pl-[24px] pr-2 text-[11.5px] placeholder:text-ink-faint focus:outline-none"
                  />
                </div>

                <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-1">
                  {visible.map((tool) => {
                    const on = picked.has(tool.id)
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => toggle(tool)}
                        className="grid w-full grid-cols-[13px_minmax(0,1fr)_68px] items-center gap-2 rounded-[5px] px-1.5 py-[5px] text-left transition-colors hover:bg-surface-sunken"
                      >
                        <span
                          className={`flex h-[13px] w-[13px] shrink-0 items-center justify-center rounded-[3px] border transition-colors ${
                            on ? 'border-brand bg-brand text-white' : 'border-[#CFD3DA] bg-white'
                          }`}
                        >
                          {on && <CheckIcon size={9} strokeWidth={3.2} />}
                        </span>
                        <span className="truncate font-mono text-[11px] text-ink-sub">
                          {tool.name || '（未命名）'}
                        </span>
                        <span className="truncate text-right text-[10.5px] text-ink-faint">
                          {tool.title}
                        </span>
                      </button>
                    )
                  })}
                  {visible.length === 0 && (
                    <p className="px-1.5 py-4 text-center text-[11px] text-ink-faint">
                      没有匹配的工具
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2 border-t border-line-soft px-2 py-1.5">
                  <span className="text-[10.5px] text-ink-mute">
                    已选 <span className="font-mono text-ink">{picked.size}</span> / {allTools.length}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPicked(
                        allPicked ? new Set() : new Set(allTools.map((t) => t.id)),
                      )
                    }
                    className="ml-auto text-[10.5px] text-brand transition-opacity hover:opacity-75"
                  >
                    {allPicked ? '清空' : '全选'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0">
            <div className="mb-1.5 text-[11.5px] font-medium text-ink-sub">产物</div>
            <div className="space-y-1">
              {ARTIFACTS.map((item) => {
                const on = artifact === item.key
                const Icon = item.icon
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setArtifact(item.key)}
                    className={`flex w-full flex-col gap-0.5 rounded-ctl border px-2.5 py-1.5 text-left transition-colors ${
                      on
                        ? 'border-brand-line bg-brand-soft/60'
                        : 'border-line bg-white hover:border-[#D5D9E0]'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Icon size={13} className={on ? 'text-brand' : 'text-ink-mute'} />
                      <span
                        className={`text-[12px] font-medium ${on ? 'text-brand' : 'text-ink'}`}
                      >
                        {item.title}
                      </span>
                      <Chip className="ml-px">{item.ext}</Chip>
                      <span className="ml-auto font-mono text-[10px] text-ink-faint">
                        {blocked ? '—' : artifactSize(item.key)}
                      </span>
                    </span>
                    <span
                      className={`text-[10.5px] leading-[15px] ${on ? 'text-brand/75' : 'text-ink-mute'}`}
                    >
                      {item.desc}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {scope === 'all' && (
            <div className="mt-auto shrink-0 space-y-2">
              <div className="border-t border-line-soft pt-2">
                <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-ink-faint">
                  本次导出
                </div>
                <div className="mt-1 font-mono text-[10.5px] leading-[16px] text-ink-mute">
                  {artifact === 'markdown'
                    ? `${tools.length} 个工具 · ${tools.length * 2} 张字段表 · ${mdText.split('\n').length} 行`
                    : `${tools.length} 个工具 · 完整 schema · ${formatBytes(size)}`}
                </div>
              </div>
              <p className="rounded-ctl bg-surface-sunken px-2.5 py-2 text-[10.5px] leading-[15px] text-ink-mute">
                文件只下载到本机，不上传。IR 里的 <span className="font-mono">x-design</span>{' '}
                是设计期信息，不再导入时可以直接删掉。
              </p>
            </div>
          )}
        </div>

        {/* 右：预览 */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-card border border-line bg-white">
          <div className="flex h-[40px] shrink-0 items-center gap-2 border-b border-line px-3">
            <span className="text-[12px] font-semibold text-ink">预览</span>
            <Chip tone="brand">{artifact === 'markdown' ? 'Markdown' : 'IR JSON'}</Chip>
            <span className="font-mono text-[10px] text-ink-faint">{formatBytes(size)}</span>
            <button
              type="button"
              onClick={onCopy}
              className="ml-auto rounded-[5px] border border-line bg-white px-1.5 py-[3px] text-[10.5px] text-ink-sub transition-colors hover:border-ink-faint hover:text-ink"
            >
              {copied ? '已复制' : '复制'}
            </button>
          </div>

          <div ref={previewRef} className="scroll-thin min-h-0 flex-1 overflow-auto px-4 py-3">
            {blocked ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <p className="text-[12px] text-ink-sub">当前范围里没有工具</p>
                <p className="mt-1 text-[11px] text-ink-faint">
                  切回「全部工具」，或在「选择工具」里勾选至少一个
                </p>
              </div>
            ) : artifact === 'markdown' ? (
              <MarkdownView md={mdText} />
            ) : (
              <pre
                className="whitespace-pre-wrap break-words font-mono text-[10.5px] leading-[16px] text-ink-sub"
                dangerouslySetInnerHTML={{ __html: highlight(irTextValue) }}
              />
            )}
          </div>

          <div className="flex h-[30px] shrink-0 items-center gap-1.5 border-t border-line-soft px-3 text-[10.5px] text-ink-mute">
            <CodeIcon size={11} />
            {artifact === 'markdown'
              ? '与下载的 .md 文件逐字一致'
              : '与下载的 .ir.json 文件逐字一致'}
          </div>
        </div>
      </div>
    </Modal>
  )
}
