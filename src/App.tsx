import { StoreProvider, useStore } from './store'
import { Sidebar } from './components/Sidebar'
import { ExportProvider } from './components/ExportDialog'
import { ImportProvider } from './components/ImportDialog'
import { Workspace } from './views/Workspace'
import { ToolEditor } from './views/ToolEditor'
import { ServerSettings } from './views/ServerSettings'

function Shell() {
  const { state } = useStore()
  const inEditor = state.view.kind === 'editor'
  const inSettings = state.view.kind === 'settings'

  return (
    <div className="flex h-full min-w-[1280px] overflow-hidden bg-surface-sunken">
      {!inEditor && <Sidebar />}
      {inEditor ? <ToolEditor /> : inSettings ? <ServerSettings /> : <Workspace />}
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <ExportProvider>
        <ImportProvider>
          <Shell />
        </ImportProvider>
      </ExportProvider>
    </StoreProvider>
  )
}
