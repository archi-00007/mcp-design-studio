import { useEffect, useRef, useState } from 'react'
import { StoreProvider, useStore } from './store'
import { Sidebar } from './components/Sidebar'
import { ExportProvider } from './components/ExportDialog'
import { ImportProvider } from './components/ImportDialog'
import { Workspace } from './views/Workspace'
import { ToolEditor } from './views/ToolEditor'
import { ServerSettings } from './views/ServerSettings'
import { ErrorBoundary } from './components/ErrorBoundary'

/** 1280 以下把侧栏收成图标栏，把宽度让给表格和编辑表单 */
const COMPACT_QUERY = '(max-width: 1279px)'

function Shell() {
  const { state } = useStore()
  const inEditor = state.view.kind === 'editor'
  const inSettings = state.view.kind === 'settings'

  const [collapsed, setCollapsed] = useState(() => window.matchMedia(COMPACT_QUERY).matches)
  // 用户手动切过之后就不再被断点覆盖，避免拖窗口时把用户的选择抢回去
  const manual = useRef(false)

  useEffect(() => {
    const mq = window.matchMedia(COMPACT_QUERY)
    const onChange = (e: MediaQueryListEvent) => {
      if (!manual.current) setCollapsed(e.matches)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return (
    <div className="flex h-full min-w-0 overflow-hidden bg-surface-sunken">
      {!inEditor && (
        <Sidebar
          collapsed={collapsed}
          onToggle={() => {
            manual.current = true
            setCollapsed((v) => !v)
          }}
        />
      )}
      {inEditor ? <ToolEditor /> : inSettings ? <ServerSettings /> : <Workspace />}
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <ExportProvider>
        <ImportProvider>
          <ErrorBoundary>
            <Shell />
          </ErrorBoundary>
        </ImportProvider>
      </ExportProvider>
    </StoreProvider>
  )
}
