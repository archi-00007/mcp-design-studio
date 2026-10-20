import React, { useEffect, useRef, useState } from 'react'
import { XIcon } from './Icons'

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'quiet'
type BtnSize = 'sm' | 'md' | 'lg'

const VARIANT: Record<BtnVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-hover border border-transparent shadow-sm',
  secondary: 'bg-white text-ink border border-line hover:border-ink-faint hover:bg-surface-hover',
  ghost: 'bg-transparent text-ink-sub border border-transparent hover:bg-surface-sunken hover:text-ink',
  quiet: 'bg-brand-soft text-brand border border-transparent hover:bg-brand-line/60',
}

const SIZE: Record<BtnSize, string> = {
  sm: 'h-7 px-2.5 text-[12px] gap-1 rounded-md',
  md: 'h-8 px-3 text-[13px] gap-1.5 rounded-ctl',
  lg: 'h-9 px-4 text-[13px] gap-2 rounded-ctl',
}

export function Btn({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Chip({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'brand' | 'mute'
  className?: string
}) {
  const TONE = {
    neutral: 'bg-surface-sunken text-ink-sub border-line',
    brand: 'bg-brand-soft text-brand border-brand-line',
    mute: 'bg-transparent text-ink-mute border-line',
  }
  return (
    <span
      className={`inline-flex h-[17px] items-center rounded-[4px] border px-1.5 text-[9.5px] font-medium leading-none tracking-[0.02em] ${TONE[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

/** 分区标题：编辑器表单里的小节头 */
export function SectionTitle({
  children,
  hint,
  right,
}: {
  children: React.ReactNode
  hint?: string
  right?: React.ReactNode
}) {
  return (
    <div className="mb-3 flex items-baseline gap-2">
      <h3 className="text-[13px] font-semibold text-ink">{children}</h3>
      {hint && <span className="text-[11.5px] text-ink-mute">{hint}</span>}
      <div className="ml-auto">{right}</div>
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 520,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
  width?: number
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#16181D]/25" onClick={onClose} />
      <div
        className="relative flex max-h-[86vh] w-full flex-col overflow-hidden rounded-card border border-line bg-white shadow-modal"
        style={{ maxWidth: width }}
      >
        <div className="flex items-start gap-3 border-b border-line-soft px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
            {subtitle && <p className="mt-1 text-[12px] leading-[17px] text-ink-mute">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-mute transition-colors hover:bg-surface-sunken hover:text-ink"
          >
            <XIcon size={14} />
          </button>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-line-soft bg-surface-sunken/60 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/** 点击外部收起 */
export function useClickOutside<T extends HTMLElement>(active: boolean, onOut: () => void) {
  const ref = useRef<T | null>(null)
  useEffect(() => {
    if (!active) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOut()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [active, onOut])
  return ref
}

/** 跟随断点变化的 matchMedia；用于宽屏/窄屏走两套布局的地方 */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    setMatches(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])

  return matches
}

export function Field({
  label,
  hint,
  children,
  required,
}: {
  label: string
  hint?: string
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="text-[12px] font-medium text-ink-sub">{label}</span>
        {required && <span className="text-[11px] text-ink-faint">必填</span>}
        {hint && <span className="ml-auto text-[11px] text-ink-faint">{hint}</span>}
      </div>
      {children}
    </label>
  )
}

export const inputCls =
  'w-full rounded-ctl border border-line bg-white px-2.5 py-[7px] text-[12.5px] text-ink transition-colors placeholder:text-ink-faint hover:border-[#D5D9E0] focus-ring'
