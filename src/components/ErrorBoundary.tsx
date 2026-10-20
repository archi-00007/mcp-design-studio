import { Component, type ErrorInfo, type ReactNode } from 'react'
import { STORAGE_KEY } from '../store'

/**
 * 渲染异常兜底。单文件版是发给非开发者的，崩了不能只剩一片白：
 * 至少说清楚发生了什么，并给一条把本地草稿抢救出来的出路。
 */

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[MCP Design Studio] 渲染异常', error, info.componentStack)
  }

  /** 直接读 localStorage 原文：此时 store 可能已经崩了，不能再依赖它 */
  private rescue = () => {
    let text = ''
    try {
      text = localStorage.getItem(STORAGE_KEY) ?? ''
    } catch {
      text = ''
    }
    if (!text) {
      window.alert('本地没有可导出的草稿。')
      return
    }
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `mcp-design-studio-backup-${stamp}.json`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex h-full items-center justify-center bg-surface-sunken p-6">
        <div className="w-full max-w-[480px] rounded-card border border-line bg-white p-5 shadow-card">
          <h1 className="text-[14px] font-semibold text-ink">页面出错了</h1>
          <p className="mt-2 text-[12px] leading-[19px] text-ink-sub">
            这是渲染异常，不是数据丢失。可以先导出本地草稿，再刷新页面重试。
          </p>
          <pre className="scroll-thin mt-3 max-h-[120px] overflow-auto rounded-ctl bg-surface-sunken px-2.5 py-2 font-mono text-[10.5px] leading-[16px] text-ink-mute">
            {error.message || String(error)}
          </pre>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={this.rescue}
              className="h-8 rounded-ctl border border-brand bg-brand px-3 text-[13px] font-medium text-white transition-colors hover:bg-brand-hover"
            >
              导出本地草稿
            </button>
            <button
              type="button"
              onClick={() => location.reload()}
              className="h-8 rounded-ctl border border-line bg-white px-3 text-[13px] text-ink transition-colors hover:border-ink-faint"
            >
              刷新页面
            </button>
          </div>
          <p className="mt-3 text-[10.5px] leading-[15px] text-ink-faint">
            导出的文件是完整的本地存储快照，可在修好后从「导入」接回来。
          </p>
        </div>
      </div>
    )
  }
}
