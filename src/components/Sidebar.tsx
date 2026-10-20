import { useState } from 'react'
import { useStore } from '../store'
import {
  BoxIcon,
  ChevronDownIcon,
  ListIcon,
  MoreIcon,
  PencilIcon,
  PlusIcon,
  SettingsIcon,
  TrashIcon,
} from './Icons'
import { Btn, Chip, Modal, inputCls, useClickOutside } from './ui'
import { DeleteServerDialog } from './DeleteServerDialog'

interface NavItem {
  key: string
  label: string
  icon: React.ReactNode
  count?: number
  active?: boolean
  soon?: boolean
  onClick?: () => void
}

export function Sidebar() {
  const { state, dispatch, activeServer } = useStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [rowMenu, setRowMenu] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ mode: 'create' | 'rename'; id?: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const menuRef = useClickOutside<HTMLDivElement>(menuOpen, () => {
    setMenuOpen(false)
    setRowMenu(null)
  })

  const toolCount = activeServer.tools.length

  // 一级导航只放真正的页面目的地；导入 / 导出是页面级上下文动作，留在 Workspace 顶栏。
  const navItems: NavItem[] = [
    {
      key: 'tools',
      label: '工具列表',
      icon: <ListIcon size={15} />,
      count: toolCount,
      active: state.view.kind === 'workspace' || state.view.kind === 'editor',
      onClick: () => dispatch({ type: 'nav', view: { kind: 'workspace' } }),
    },
    {
      key: 'settings',
      label: 'Server 设置',
      icon: <SettingsIcon size={15} />,
      active: state.view.kind === 'settings',
      onClick: () => dispatch({ type: 'nav', view: { kind: 'settings' } }),
    },
  ]

  return (
    <aside className="flex w-[244px] shrink-0 flex-col border-r border-line bg-white">
      {/* 品牌 */}
      <div className="flex h-[52px] shrink-0 items-center gap-2 px-3.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-brand text-white">
          <BoxIcon size={14} strokeWidth={1.7} />
        </div>
        <span className="text-[12.5px] font-semibold tracking-[-0.01em] text-ink">MCP Design Studio</span>
        <Chip tone="mute" className="ml-auto">
          v0.1
        </Chip>
      </div>

      {/* Server 切换 */}
      <div className="relative shrink-0 px-2.5 pb-2" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className={`flex w-full items-center gap-1.5 rounded-ctl border px-2.5 py-2 text-left transition-colors ${
            menuOpen ? 'border-brand-line bg-brand-soft/50' : 'border-line bg-white hover:border-ink-faint'
          }`}
        >
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold leading-[17px] text-ink">{activeServer.name}</div>
            <div className="mt-0.5 text-[10.5px] leading-none text-ink-mute">{toolCount} 个工具</div>
          </div>
          <ChevronDownIcon
            size={14}
            className={`ml-auto shrink-0 text-ink-mute transition-transform ${menuOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {menuOpen && (
          <div className="absolute left-2.5 right-2.5 top-[calc(100%-2px)] z-30 overflow-visible rounded-[10px] border border-line bg-white shadow-pop">
            <div className="px-2.5 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.06em] text-ink-faint">
              切换 Server
            </div>

            <div className="pb-1">
              {state.servers.map((s) => {
                const current = s.id === activeServer.id
                return (
                  <div key={s.id} className="group relative flex items-center">
                    <button
                      type="button"
                      onClick={() => {
                        dispatch({ type: 'server/select', id: s.id })
                        setMenuOpen(false)
                        setRowMenu(null)
                      }}
                      className={`flex min-w-0 flex-1 items-center gap-1.5 py-[7px] pl-2.5 pr-1 text-left transition-colors ${
                        current ? 'bg-brand-soft/60' : 'hover:bg-surface-sunken'
                      }`}
                    >
                      <span
                        className={`truncate text-[12.5px] leading-none ${
                          current ? 'font-semibold text-ink' : 'text-ink-sub'
                        }`}
                      >
                        {s.name}
                      </span>
                      <Chip>Server</Chip>
                      <span className="ml-auto shrink-0 pr-1 font-mono text-[10.5px] text-ink-mute">
                        {s.tools.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setRowMenu((v) => (v === s.id ? null : s.id))
                      }}
                      className={`mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] text-ink-mute transition-opacity hover:bg-white ${
                        rowMenu === s.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                      title="更多"
                    >
                      <MoreIcon size={13} />
                    </button>

                    {rowMenu === s.id && (
                      <div className="absolute right-1 top-[calc(100%-2px)] z-40 w-[128px] overflow-hidden rounded-[8px] border border-line bg-white py-1 shadow-pop">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing({ mode: 'rename', id: s.id, name: s.name })
                            setRowMenu(null)
                            setMenuOpen(false)
                          }}
                          className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-[12px] text-ink-sub hover:bg-surface-sunken"
                        >
                          <PencilIcon size={12} />
                          重命名
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleting(s.id)
                            setRowMenu(null)
                            setMenuOpen(false)
                          }}
                          className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-[12px] text-ink-sub hover:bg-surface-sunken"
                        >
                          <TrashIcon size={12} />
                          删除
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="h-px bg-line-soft" />
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                setEditing({ mode: 'create', name: '' })
              }}
              className="flex w-full items-center gap-1.5 px-2.5 py-2 text-left text-[12.5px] text-brand transition-colors hover:bg-brand-soft/60"
            >
              <PlusIcon size={13} />
              新建 Server
            </button>
          </div>
        )}
      </div>

      <div className="mx-2.5 h-px shrink-0 bg-line-soft" />

      {/* 导航 */}
      <nav className="shrink-0 px-2.5 py-2">
        <div className="px-2.5 pb-1 text-[10px] font-medium uppercase tracking-[0.06em] text-ink-faint">设计</div>
        {navItems.map((item) => (
          <button
            key={item.key}
            type="button"
            disabled={item.soon}
            onClick={item.onClick}
            title={item.soon ? '即将支持' : undefined}
            className={`flex w-full items-center gap-2 rounded-ctl px-2.5 py-[7px] text-left text-[12.5px] transition-colors ${
              item.active
                ? 'bg-brand-soft font-medium text-brand'
                : item.soon
                  ? 'cursor-not-allowed text-ink-faint'
                  : 'text-ink-sub hover:bg-surface-sunken hover:text-ink'
            }`}
          >
            <span className={item.active ? 'text-brand' : 'text-ink-mute'}>{item.icon}</span>
            {item.label}
            {item.count !== undefined && (
              <span className={`ml-auto font-mono text-[10.5px] ${item.active ? 'text-brand' : 'text-ink-faint'}`}>
                {item.count}
              </span>
            )}
            {item.soon && (
              <span className="ml-auto rounded-[3px] border border-line px-1 py-[1px] text-[9px] text-ink-faint">
                待接
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="flex-1" />

      {/* 字段基线 */}
      <div className="shrink-0 p-2.5">
        <div className="rounded-[10px] border border-line-soft bg-surface-sunken px-2.5 py-2">
          <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-ink-faint">字段基线</div>
          <div className="mt-1 font-mono text-[11.5px] font-medium text-ink-sub">mcpdesc v0.8.0</div>
          <div className="mt-0.5 text-[10.5px] leading-[15px] text-ink-mute">MCP 2025-06-18 · 仅 tools</div>
        </div>
      </div>

      {/* 新建 / 重命名 */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.mode === 'create' ? '新建 Server' : '重命名 Server'}
        subtitle={
          editing?.mode === 'create'
            ? 'Server 在这里是一份本地设计文档，不会连接远端。'
            : '只改显示名，导出清单里的 name 会同步更新。'
        }
        width={420}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setEditing(null)}>
              取消
            </Btn>
            <Btn
              variant="primary"
              disabled={!editing?.name.trim()}
              onClick={() => {
                if (!editing) return
                if (editing.mode === 'create') dispatch({ type: 'server/create', name: editing.name })
                else if (editing.id)
                  dispatch({ type: 'server/update', id: editing.id, patch: { name: editing.name.trim() } })
                setEditing(null)
              }}
            >
              {editing?.mode === 'create' ? '创建' : '保存'}
            </Btn>
          </>
        }
      >
        <label className="block">
          <div className="mb-1.5 text-[12px] font-medium text-ink-sub">Server 名称</div>
          <input
            autoFocus
            value={editing?.name ?? ''}
            onChange={(e) => setEditing((s) => (s ? { ...s, name: e.target.value } : s))}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || !editing?.name.trim()) return
              if (editing.mode === 'create') dispatch({ type: 'server/create', name: editing.name })
              else if (editing.id)
                dispatch({ type: 'server/update', id: editing.id, patch: { name: editing.name.trim() } })
              setEditing(null)
            }}
            placeholder="例如：订单中心"
            className={inputCls}
          />
        </label>
      </Modal>

      {/* 删除确认：与 Server 设置页共用同一实现 */}
      <DeleteServerDialog serverId={deleting} onClose={() => setDeleting(null)} />
    </aside>
  )
}
