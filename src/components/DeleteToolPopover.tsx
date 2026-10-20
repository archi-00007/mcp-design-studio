import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Tool } from '../types'
import { Btn } from './ui'

/**
 * 表格行内删除的确认浮层。
 *
 * 不用「单元格原地换成 确认/取消」的原因有两个：
 * 1. 单元格内容尺寸变化会让整行跳动，视觉上很跳；
 * 2. 确认按钮会落在原来「删除」的位置，用户连点两下就直接删了，没有防护。
 * 浮层贴着操作列弹出，确认按钮不在原点击位置，避免连点误删。
 * 文案只保留一句后果提示，字段数等细节交给列表本身，浮层不做信息堆叠。
 */
export function DeleteToolPopover({
  tool,
  anchor,
  onCancel,
  onConfirm,
}: {
  tool: Tool
  anchor: DOMRect
  onCancel: () => void
  onConfirm: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const W = el.offsetWidth
    const H = el.offsetHeight
    const gap = 8
    const edge = 12
    const left = Math.max(edge, Math.min(anchor.right - W, window.innerWidth - W - edge))
    const below = anchor.bottom + gap
    const top = below + H > window.innerHeight - edge ? Math.max(edge, anchor.top - gap - H) : below
    setPos({ left, top })
  }, [anchor])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [onCancel])

  // 表格内部滚动时，锚点已漂移，直接收起比跟着飘更稳
  useEffect(() => {
    const onScroll = () => onCancel()
    window.addEventListener('scroll', onScroll, true)
    return () => window.removeEventListener('scroll', onScroll, true)
  }, [onCancel])

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`删除 ${tool.name}`}
      className="pop-in fixed z-50 w-[196px] rounded-[10px] border border-line bg-white p-2.5 shadow-pop"
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
    >
      <p className="px-0.5 text-[11.5px] leading-[17px] text-ink-sub">删除后无法撤销，是否确认</p>
      <div className="mt-2.5 flex items-center justify-end gap-1.5">
        <Btn variant="secondary" size="sm" onClick={onCancel}>
          取消
        </Btn>
        <Btn variant="primary" size="sm" onClick={onConfirm}>
          删除
        </Btn>
      </div>
    </div>
  )
}
