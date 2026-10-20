import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { Btn, Modal, inputCls } from './ui'

/**
 * 删除 Server 的唯一入口。Sidebar 的 ⋯ 菜单与 Server 设置页共用，
 * 两处行为必须一致：输入名称才能确认。
 */
export function DeleteServerDialog({
  serverId,
  onClose,
}: {
  serverId: string | null
  onClose: () => void
}) {
  const { state, dispatch } = useStore()
  const [confirmName, setConfirmName] = useState('')

  const target = state.servers.find((s) => s.id === serverId) ?? null

  useEffect(() => {
    if (serverId) setConfirmName('')
  }, [serverId])

  return (
    <Modal
      open={!!target}
      onClose={onClose}
      title={`删除「${target?.name ?? ''}」`}
      subtitle={
        target && target.tools.length > 0
          ? `该 Server 下的 ${target.tools.length} 个工具会一并删除，此操作不可撤销。`
          : '该 Server 下没有工具。删除后不可恢复。'
      }
      width={440}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            取消
          </Btn>
          <Btn
            variant="primary"
            disabled={!target || confirmName.trim() !== target.name || state.servers.length === 1}
            onClick={() => {
              if (!target) return
              dispatch({ type: 'server/delete', id: target.id })
              onClose()
            }}
          >
            确认删除
          </Btn>
        </>
      }
    >
      <label className="block">
        <div className="mb-1.5 text-[12px] font-medium text-ink-sub">
          输入 <span className="font-semibold text-ink">{target?.name}</span> 以确认
        </div>
        <input
          autoFocus
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
          placeholder={target?.name}
          className={inputCls}
        />
      </label>
      {state.servers.length === 1 && (
        <p className="mt-3 rounded-ctl border border-line bg-surface-sunken px-2.5 py-2 text-[11.5px] text-ink-mute">
          至少保留一个 Server。可以先新建一个，再删除当前这个。
        </p>
      )}
    </Modal>
  )
}
