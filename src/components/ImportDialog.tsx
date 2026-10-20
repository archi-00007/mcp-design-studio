import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { mergeStat, parseIr, type ImportResult } from '../lib/import'
import { formatBytes } from '../lib/export'
import { AlertIcon, CheckIcon, FileTextIcon, ImportIcon } from './Icons'
import { Btn, Chip, Modal, inputCls } from './ui'

/* ------------------------------------------------------------- 弹层入口 */

interface ImportApi {
  openDialog: () => void
  isOpen: boolean
}

const ImportCtx = createContext<ImportApi | null>(null)

export function ImportProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  // ⌘/Ctrl + I：与导出的 ⌘E 对称
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const value = useMemo<ImportApi>(() => ({ openDialog: () => setOpen(true), isOpen: open }), [open])

  return (
    <ImportCtx.Provider value={value}>
      {children}
      <ImportDialog open={open} onClose={() => setOpen(false)} />
    </ImportCtx.Provider>
  )
}

export function useImport(): ImportApi {
  const ctx = useContext(ImportCtx)
  if (!ctx) throw new Error('useImport must be used within ImportProvider')
  return ctx
}

/* --------------------------------------------------------------- 主体 */

type Target = 'create' | 'merge'
type Conflict = 'skip' | 'overwrite'

const MAX_SIZE = 8 * 1024 * 1024

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <span className="shrink-0 text-[10.5px] text-ink-faint">{label}</span>
      <span className="min-w-0 truncate font-mono text-[11px] text-ink-sub">{value}</span>
    </div>
  )
}

function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dispatch, activeServer } = useStore()
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<{ name: string; size: number } | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [target, setTarget] = useState<Target>('create')
  const [name, setName] = useState('')
  const [conflict, setConflict] = useState<Conflict>('skip')
  const inputRef = useRef<HTMLInputElement>(null)

  // 每次打开都从空状态起步，避免上一次的文件残留
  useEffect(() => {
    if (!open) return
    setDragOver(false)
    setFile(null)
    setResult(null)
    setTarget('create')
    setName('')
    setConflict('skip')
  }, [open])

  const parsed = result?.ok ? result.data : null

  const stat = useMemo(
    () =>
      parsed
        ? mergeStat(
            activeServer.tools.map((t) => t.name),
            parsed.tools,
            conflict,
          )
        : { add: 0, overwrite: 0, skip: 0 },
    [parsed, activeServer.tools, conflict],
  )

  /** 合并模式下按名字判断每个工具会落到哪一档，清单里直接标出来 */
  const fate = useMemo(() => {
    if (!parsed) return new Map<string, 'add' | 'overwrite' | 'skip'>()
    const seen = new Set(activeServer.tools.map((t) => t.name.trim()))
    const map = new Map<string, 'add' | 'overwrite' | 'skip'>()
    for (const tool of parsed.tools) {
      const key = tool.name.trim()
      const hit = seen.has(key)
      map.set(tool.id, hit ? (conflict === 'overwrite' ? 'overwrite' : 'skip') : 'add')
      if (!hit) seen.add(key)
    }
    return map
  }, [parsed, activeServer.tools, conflict])

  const readFile = async (picked: File) => {
    setFile({ name: picked.name, size: picked.size })
    setResult(null)

    if (picked.size > MAX_SIZE) {
      setResult({ ok: false, error: '文件超过 8 MB，IR 备份通常只有几十 KB' })
      return
    }

    try {
      const text = await picked.text()
      const next = parseIr(text)
      setResult(next)
      if (next.ok) setName(next.data.name)
    } catch {
      setResult({ ok: false, error: '读取文件失败，换一个文件再试' })
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) void readFile(dropped)
  }

  const total = parsed ? parsed.tools.length : 0
  const writing = target === 'create' ? total : stat.add + stat.overwrite
  const canSubmit =
    !!parsed && writing > 0 && (target === 'merge' || name.trim().length > 0)

  const submit = () => {
    if (!parsed || !canSubmit) return
    dispatch({
      type: 'import',
      target,
      name: target === 'create' ? name.trim() : parsed.name,
      description: parsed.description,
      transport: parsed.transport,
      protocolVersion: parsed.protocolVersion,
      tools: parsed.tools,
      conflict,
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="导入"
      subtitle="读取一份 IR 备份，还原成一个 Server，或并进当前 Server。"
      width={560}
      footer={
        <>
          <span className="mr-auto text-[11px] text-ink-mute">
            {!file
              ? '先选一份 IR 文件'
              : !parsed
                ? '这份文件没能解析，换一份再试'
                : target === 'create'
                  ? `将新建一个 Server，包含 ${total} 个工具`
                  : `新增 ${stat.add} · 覆盖 ${stat.overwrite} · 跳过 ${stat.skip}`}
          </span>
          <Btn variant="ghost" onClick={onClose}>
            取消
          </Btn>
          <Btn variant="primary" disabled={!canSubmit} onClick={submit}>
            <ImportIcon size={13} />
            {target === 'create'
              ? total
                ? `创建并导入 ${total} 个工具`
                : '导入'
              : `导入 ${writing} 个工具`}
          </Btn>
        </>
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const picked = e.target.files?.[0]
          if (picked) void readFile(picked)
          e.target.value = ''
        }}
      />

      {/* 未选文件：拖入区 */}
      {!file && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              inputRef.current?.click()
            }
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`flex h-[172px] cursor-pointer flex-col items-center justify-center gap-2 rounded-card border border-dashed transition-colors focus:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/[0.12] ${
            dragOver
              ? 'border-brand bg-brand-soft/60'
              : 'border-[#D5D9E0] bg-surface-sunken/60 hover:border-brand-line hover:bg-brand-soft/30'
          }`}
        >
          <ImportIcon size={20} className={dragOver ? 'text-brand' : 'text-ink-mute'} />
          <span className="text-[12.5px] font-medium text-ink">拖入 .json 文件，或点击选择</span>
          <span className="text-[11px] text-ink-faint">只读本机文件，不上传任何内容</span>
        </div>
      )}

      {/* 已选文件：文件行 + 解析结果 */}
      {file && (
        <>
          <div className="flex items-center gap-2 rounded-ctl border border-line bg-white px-2.5 py-2">
            <FileTextIcon size={14} className="shrink-0 text-ink-mute" />
            <span className="min-w-0 truncate font-mono text-[11.5px] text-ink">{file.name}</span>
            <span className="shrink-0 font-mono text-[10.5px] text-ink-faint">
              {formatBytes(file.size)}
            </span>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="ml-auto shrink-0 text-[11px] text-brand transition-opacity hover:opacity-75"
            >
              换一个
            </button>
          </div>

          {result && !result.ok && (
            <div className="mt-2 flex items-start gap-2 rounded-ctl border border-line bg-white px-2.5 py-2">
              <AlertIcon size={13} className="mt-[1px] shrink-0 text-ink-mute" />
              <span className="text-[11.5px] leading-[17px] text-ink-sub">{result.error}</span>
            </div>
          )}

          {parsed && (
            <>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-ctl bg-surface-sunken px-2.5 py-2">
                <SummaryRow label="Server" value={parsed.name} />
                <SummaryRow label="工具" value={`${total} 个`} />
                <SummaryRow label="协议" value={parsed.protocolVersion} />
                <SummaryRow label="传输" value={parsed.transport} />
              </div>

              {parsed.warnings.length > 0 && (
                <div className="mt-2 rounded-ctl border border-line bg-surface-sunken px-2.5 py-2">
                  {parsed.warnings.map((w) => (
                    <div
                      key={w}
                      className="flex items-start gap-1.5 text-[11px] leading-[16px] text-ink-mute"
                    >
                      <AlertIcon size={11} className="mt-[2px] shrink-0" />
                      {w}
                    </div>
                  ))}
                </div>
              )}

              {/* 落到哪儿 */}
              <div className="mt-3">
                <div className="mb-1.5 text-[11.5px] font-medium text-ink-sub">导入位置</div>
                <div className="flex rounded-ctl border border-line bg-surface-sunken p-[2px]">
                  {([
                    { key: 'create' as Target, label: '新建 Server' },
                    { key: 'merge' as Target, label: `合并到「${activeServer.name}」` },
                  ]).map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setTarget(item.key)}
                      className={`h-[26px] flex-1 truncate rounded-[5px] px-1 text-[11.5px] transition-colors ${
                        target === item.key
                          ? 'bg-white font-medium text-ink shadow-sm'
                          : 'text-ink-mute hover:text-ink'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {target === 'create' ? (
                <label className="mt-2 block">
                  <div className="mb-1.5 text-[11.5px] font-medium text-ink-sub">新 Server 名称</div>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例如：订单中心"
                    className={inputCls}
                  />
                </label>
              ) : (
                <div className="mt-2 space-y-1">
                  {(
                    [
                      {
                        key: 'skip' as Conflict,
                        label: '跳过同名工具',
                        desc: '保留当前的，只导入名字没出现过的',
                      },
                      {
                        key: 'overwrite' as Conflict,
                        label: '覆盖同名工具',
                        desc: '用文件里的版本替换当前的，不可撤销',
                      },
                    ]
                  ).map((item) => {
                    const on = conflict === item.key
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setConflict(item.key)}
                        className={`flex w-full items-start gap-2 rounded-ctl border px-2.5 py-1.5 text-left transition-colors ${
                          on
                            ? 'border-brand-line bg-brand-soft/60'
                            : 'border-line bg-white hover:border-[#D5D9E0]'
                        }`}
                      >
                        <span
                          className={`mt-[2px] flex h-[13px] w-[13px] shrink-0 items-center justify-center rounded-full border transition-colors ${
                            on ? 'border-brand bg-brand text-white' : 'border-[#CFD3DA] bg-white'
                          }`}
                        >
                          {on && <CheckIcon size={9} strokeWidth={3.2} />}
                        </span>
                        <span className="min-w-0">
                          <span
                            className={`block text-[12px] font-medium ${on ? 'text-brand' : 'text-ink'}`}
                          >
                            {item.label}
                          </span>
                          <span className="block text-[10.5px] leading-[15px] text-ink-mute">
                            {item.desc}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* 工具清单：合并模式下逐条标出会新增还是跳过 */}
              <div className="mt-3 overflow-hidden rounded-ctl border border-line">
                <div className="flex items-center gap-2 border-b border-line-soft bg-surface-sunken px-2.5 py-1.5">
                  <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-ink-faint">
                    工具清单
                  </span>
                  <span className="ml-auto font-mono text-[10px] text-ink-faint">
                    {target === 'create'
                      ? `${total} 个`
                      : `新增 ${stat.add} · 覆盖 ${stat.overwrite} · 跳过 ${stat.skip}`}
                  </span>
                </div>
                <div className="scroll-thin max-h-[146px] overflow-y-auto">
                  {parsed.tools.map((tool) => {
                    const state = fate.get(tool.id) ?? 'add'
                    return (
                      <div
                        key={tool.id}
                        className="flex items-center gap-2 px-2.5 py-[5px] even:bg-surface-sunken/40"
                      >
                        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-sub">
                          {tool.name}
                        </span>
                        <span className="w-[76px] shrink-0 truncate text-right text-[10.5px] text-ink-faint">
                          {tool.title || '—'}
                        </span>
                        {target === 'merge' && (
                          <Chip
                            tone={state === 'add' ? 'brand' : 'mute'}
                            className="w-[38px] shrink-0 justify-center"
                          >
                            {state === 'add' ? '新增' : state === 'overwrite' ? '覆盖' : '跳过'}
                          </Chip>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  )
}
