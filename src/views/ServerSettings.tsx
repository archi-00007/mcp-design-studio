import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { buildServerJson } from '../lib/model'
import { highlight } from '../lib/highlight'
import type { ServerDoc, Transport } from '../types'
import { ChevronRightIcon, CodeIcon, ExportIcon, ImportIcon, InfoIcon } from '../components/Icons'
import { Btn, Chip, Field, SectionTitle, inputCls } from '../components/ui'
import { useExport } from '../components/ExportDialog'
import { useImport } from '../components/ImportDialog'

const TRANSPORTS: { key: Transport; label: string; note: string }[] = [
  { key: 'streamable-http', label: 'streamable-http', note: 'HTTP 长连接，面向远端服务' },
  { key: 'stdio', label: 'stdio', note: '本地进程，走标准输入输出' },
]

const DESC_LIMIT = 160

export function ServerSettings() {
  const { dispatch, activeServer } = useStore()
  const { openDialog } = useExport()
  const { openDialog: openImport } = useImport()
  const [nameDraft, setNameDraft] = useState(activeServer.name)
  const [copied, setCopied] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const timer = useRef<number | null>(null)

  // 切换 Server、或在别处（侧栏重命名）改了名字时同步草稿；正在输入时不打断光标
  useEffect(() => {
    if (nameRef.current && document.activeElement === nameRef.current) return
    setNameDraft(activeServer.name)
  }, [activeServer.id, activeServer.name])

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
    },
    [],
  )

  const patch = (p: Partial<ServerDoc>) =>
    dispatch({ type: 'server/update', id: activeServer.id, patch: p })

  /** 预览只读存储值：表单写入后立即反映，空名这类临时非法态不会污染清单 */
  const previewJson = useMemo(() => JSON.stringify(buildServerJson(activeServer), null, 2), [activeServer])
  const previewHtml = useMemo(() => highlight(previewJson), [previewJson])

  const back = () => dispatch({ type: 'nav', view: { kind: 'workspace' } })
  const toolCount = activeServer.tools.length
  const nameEmpty = !nameDraft.trim()

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-surface-sunken">
      {/* 顶栏：面包屑（一级标题 › 当前位置）+ 右侧动作组，高度与按钮规格同工具列表页 */}
      <header className="flex h-[52px] shrink-0 items-center gap-1.5 border-b border-line bg-white px-5">
        <h1 className="text-[14px] font-semibold tracking-[-0.01em] text-ink">{activeServer.name}</h1>
        <ChevronRightIcon size={12} className="text-ink-faint" />
        <span className="text-[13.5px] text-ink-sub">Server 设置</span>

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

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1120px] items-start gap-6 px-6 py-5">
          {/* 左：表单 */}
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-start gap-1.5 rounded-ctl border border-line bg-white px-3 py-2">
              <InfoIcon size={12} className="mt-[1px] shrink-0 text-ink-faint" />
              <p className="text-[11.5px] leading-[16px] text-ink-mute">
                Server 在这里是一份本地设计文档：不连接远端，改动即时写入浏览器本地存储，交付靠导出 IR。
              </p>
            </div>

            {/* 基本信息 */}
            <section className="rounded-card border border-line bg-white p-4">
              <SectionTitle hint="写入清单根节点的 name 与 description">基本信息</SectionTitle>

              <div className="space-y-3">
                <Field label="Server 名称" hint="必填">
                  <input
                    ref={nameRef}
                    value={nameDraft}
                    onChange={(e) => {
                      const v = e.target.value
                      setNameDraft(v)
                      if (v.trim()) patch({ name: v.trim() })
                    }}
                    onBlur={() => setNameDraft(activeServer.name)}
                    placeholder="例如：订单中心"
                    className={`${inputCls} ${nameEmpty ? 'border-[#C0483E]' : ''}`}
                  />
                </Field>
                {nameEmpty && (
                  <p className="-mt-1.5 text-[11px] text-[#C0483E]">名称不能为空，离开输入框会恢复上一个值。</p>
                )}

                <Field label="描述" hint={`${activeServer.description.length}/${DESC_LIMIT}`}>
                  <textarea
                    value={activeServer.description}
                    maxLength={DESC_LIMIT}
                    onChange={(e) => patch({ description: e.target.value })}
                    rows={3}
                    placeholder="这个 Server 提供哪一类能力，面向什么场景。"
                    className={`${inputCls} resize-none leading-[19px]`}
                  />
                </Field>

                <div className="flex items-center gap-2 rounded-ctl border border-line-soft bg-surface-sunken px-2.5 py-2">
                  <span className="text-[11.5px] text-ink-mute">包含工具</span>
                  <span className="font-mono text-[12px] text-ink">{toolCount}</span>
                  <span className="text-[10.5px] text-ink-faint">个</span>
                  <button
                    type="button"
                    onClick={back}
                    className="ml-auto text-[11.5px] text-brand transition-opacity hover:opacity-75"
                  >
                    在工具列表中查看 ›
                  </button>
                </div>
              </div>
            </section>

            {/* 传输与协议 */}
            <section className="rounded-card border border-line bg-white p-4">
              <SectionTitle hint="写入清单的 transport 与 protocolVersion">传输与协议</SectionTitle>

              <div className="grid grid-cols-2 gap-2">
                {TRANSPORTS.map((t) => {
                  const on = activeServer.transport === t.key
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => patch({ transport: t.key })}
                      className={`flex h-[46px] flex-col justify-center gap-0.5 rounded-ctl border px-2.5 text-left transition-colors ${
                        on ? 'border-brand-line bg-brand-soft' : 'border-line bg-white hover:border-[#D5D9E0]'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${on ? 'bg-brand' : 'bg-[#D3D7DE]'}`}
                        />
                        <span
                          className={`font-mono text-[11.5px] ${on ? 'font-medium text-brand' : 'text-ink-sub'}`}
                        >
                          {t.label}
                        </span>
                      </span>
                      <span className={`truncate pl-3 text-[10px] ${on ? 'text-brand/70' : 'text-ink-faint'}`}>
                        {t.note}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-3 space-y-2 border-t border-line-soft pt-3">
                <div className="flex items-center gap-2">
                  <span className="w-[76px] shrink-0 text-[11.5px] text-ink-mute">协议版本</span>
                  <span className="font-mono text-[12px] text-ink">{activeServer.protocolVersion}</span>
                  <Chip tone="brand">当前基线</Chip>
                  <span className="ml-auto text-[10.5px] text-ink-faint">锁定</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-[76px] shrink-0 text-[11.5px] text-ink-mute">能力声明</span>
                  <span className="font-mono text-[12px] text-ink">tools</span>
                  <span className="ml-auto text-[10.5px] text-ink-faint">不写 resources / prompts</span>
                </div>
              </div>

              <p className="mt-2.5 rounded-ctl bg-surface-sunken px-2.5 py-2 text-[10.5px] leading-[15px] text-ink-mute">
                版本锁定为 2025-06-18：字段基线依赖 outputSchema，该能力从 2025-06-18 起提供。新的协议版本发布后会在
                这里可选。
              </p>
            </section>
          </div>

          {/* 右：清单预览 */}
          <aside className="sticky top-5 w-[360px] shrink-0 overflow-hidden rounded-card border border-line bg-white shadow-card">
            <div className="flex h-[44px] items-center gap-2 border-b border-line px-3.5">
              <span className="text-[12.5px] font-semibold text-ink">预览</span>
              <Chip tone="brand">server.json</Chip>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(previewJson)
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

            <div className="scroll-thin max-h-[calc(100vh-248px)] min-h-[240px] overflow-auto px-3.5 py-3">
              <pre
                className="whitespace-pre-wrap break-words font-mono text-[10.5px] leading-[16px] text-ink-sub"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>

            <div className="flex items-center gap-1.5 border-t border-line-soft px-3.5 py-2.5 text-[10.5px] text-ink-mute">
              <CodeIcon size={11} />
              清单摘要 · tools 只列名称，完整定义随导出 IR 生成
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
