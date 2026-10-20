import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import { SEED_SERVER, SEED_TIMES, SEED_TITLES, RETIRED_SEED_SERVER_IDS } from './seed'
import { cloneFields, normalizeFields } from './lib/model'
import { normalizeTimestamp, now } from './lib/time'
import type { ServerDoc, Tool, Transport, View } from './types'

/**
 * v2：schema 字段从扁平列表改为可嵌套的树（children / isItems）。
 * 结构不兼容旧草稿，换 key 让旧数据留在原地不动，需要时可从 v1 捞回。
 */
export const STORAGE_KEY = 'mcp-design-studio:v2'

export interface State {
  servers: ServerDoc[]
  activeServerId: string
  view: View
  /** 记住最近打开的工具，供侧栏「工具列表」入口回到原位 */
  lastToolId: string | null
  /** 仅本次会话有效：从编辑器返回列表时，定位到该工具所在的页 */
  focusToolId: string | null
}

type Action =
  | { type: 'server/select'; id: string }
  | { type: 'server/create'; name: string }
  | { type: 'server/update'; id: string; patch: Partial<ServerDoc> }
  | { type: 'server/delete'; id: string }
  | { type: 'tool/create' }
  | { type: 'tool/duplicate'; toolId: string }
  | { type: 'tool/patch'; toolId: string; patch: Partial<Tool>; silent?: boolean }
  | { type: 'tool/delete'; toolId: string }
  /** 把 toolId 插到 beforeId 之前；beforeId 为 null 表示挪到末尾。顺序本身就是工具的自定义排序。 */
  | { type: 'tool/move'; toolId: string; beforeId: string | null }
  | {
      type: 'import'
      /** create：作为新 Server 独立存在；merge：并进当前 Server */
      target: 'create' | 'merge'
      name: string
      description: string
      transport: Transport
      protocolVersion: string
      tools: Tool[]
      conflict: 'skip' | 'overwrite'
    }
  | { type: 'nav'; view: View }

/** 时间工具放在 lib/time，store 转出一份，调用方不必关心来源 */
export { now } from './lib/time'

let uid = 0
function newId(prefix: string): string {
  uid += 1
  return `${prefix}-${Date.now().toString(36)}${uid}`
}

/** 新建工具时给出的空壳，字段与设计稿的表单区一一对应 */
export function makeEmptyTool(index: number): Tool {
  return {
    id: newId('t'),
    name: `new_tool_${index}`,
    title: '未命名工具',
    description: '',
    internalNotes: '',
    input: [],
    output: [],
    requestExamples: [],
    responseExamples: [],
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    createdAt: now(),
    updatedAt: now(),
  }
}

const initialState: State = {
  servers: [SEED_SERVER],
  activeServerId: SEED_SERVER.id,
  view: { kind: 'workspace' },
  lastToolId: 't-update-order-status',
  focusToolId: null,
}

function activeServerOf(state: State): ServerDoc | undefined {
  return state.servers.find((s) => s.id === state.activeServerId)
}

function mapActiveTool(
  state: State,
  toolId: string,
  fn: (t: Tool) => Tool,
  touch = true,
): ServerDoc[] {
  return state.servers.map((s) =>
    s.id !== state.activeServerId
      ? s
      : {
          ...s,
          tools: s.tools.map((t) =>
            t.id === toolId ? { ...fn(t), ...(touch ? { updatedAt: now() } : {}) } : t,
          ),
        },
  )
}

/** 复制出来的名字撞车时退让：x_copy → x_copy2 → x_copy3 */
function uniqueToolName(tools: Tool[], base: string): string {
  const taken = new Set(tools.map((t) => t.name.trim()))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}${n}`)) n += 1
  return `${base}${n}`
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'server/select':
      return {
        ...state,
        activeServerId: action.id,
        // 在设置页切换 Server 时留在设置页，其余情况回列表
        view: state.view.kind === 'settings' ? { kind: 'settings' } : { kind: 'workspace' },
        lastToolId: null,
        focusToolId: null,
      }

    case 'server/create': {
      const server: ServerDoc = {
        id: newId('srv'),
        name: action.name.trim() || '未命名 Server',
        description: '',
        transport: 'streamable-http',
        protocolVersion: '2025-06-18',
        tools: [],
      }
      return {
        ...state,
        servers: [...state.servers, server],
        activeServerId: server.id,
        view: { kind: 'workspace' },
        lastToolId: null,
        focusToolId: null,
      }
    }

    case 'server/update':
      return {
        ...state,
        servers: state.servers.map((s) => (s.id === action.id ? { ...s, ...action.patch } : s)),
      }

    case 'server/delete': {
      const rest = state.servers.filter((s) => s.id !== action.id)
      if (!rest.length) return state
      const stillActive = rest.some((s) => s.id === state.activeServerId)
      return {
        ...state,
        servers: rest,
        activeServerId: stillActive ? state.activeServerId : rest[0].id,
        view: stillActive ? state.view : { kind: 'workspace' },
        lastToolId: stillActive ? state.lastToolId : null,
        focusToolId: null,
      }
    }

    case 'tool/create': {
      const server = activeServerOf(state)
      if (!server) return state
      const tool = makeEmptyTool(server.tools.length + 1)
      return {
        ...state,
        servers: state.servers.map((s) => (s.id === server.id ? { ...s, tools: [...s.tools, tool] } : s)),
        view: { kind: 'editor', toolId: tool.id },
        lastToolId: tool.id,
      }
    }

    case 'tool/duplicate': {
      const server = activeServerOf(state)
      if (!server) return state
      const source = server.tools.find((t) => t.id === action.toolId)
      if (!source) return state
      const copy: Tool = {
        ...source,
        id: newId('t'),
        // 英文名在 MCP 里是唯一标识，重名就加数字后缀，避免连点两次复制撞名
        name: uniqueToolName(server.tools, `${source.name.trim()}_copy`),
        input: cloneFields(source.input),
        output: cloneFields(source.output),
        requestExamples: [...(source.requestExamples ?? [])],
        responseExamples: [...(source.responseExamples ?? [])],
        annotations: { ...source.annotations },
        createdAt: now(),
        updatedAt: now(),
      }
      return {
        ...state,
        servers: state.servers.map((s) => (s.id === server.id ? { ...s, tools: [...s.tools, copy] } : s)),
        view: { kind: 'editor', toolId: copy.id },
        lastToolId: copy.id,
        focusToolId: null,
      }
    }

    case 'tool/patch':
      return {
        ...state,
        servers: mapActiveTool(
          state,
          action.toolId,
          (t) => ({ ...t, ...action.patch }),
          !action.silent,
        ),
      }

    case 'tool/delete': {
      const restTools = state.servers.map((s) =>
        s.id === state.activeServerId ? { ...s, tools: s.tools.filter((t) => t.id !== action.toolId) } : s,
      )
      const inEditor = state.view.kind === 'editor' && state.view.toolId === action.toolId
      return {
        ...state,
        servers: restTools,
        view: inEditor ? { kind: 'workspace' } : state.view,
        lastToolId: state.lastToolId === action.toolId ? null : state.lastToolId,
      }
    }

    case 'tool/move': {
      const server = activeServerOf(state)
      if (!server) return state
      if (action.toolId === action.beforeId) return state
      const moved = server.tools.find((t) => t.id === action.toolId)
      if (!moved) return state

      const rest = server.tools.filter((t) => t.id !== action.toolId)
      const to = action.beforeId ? rest.findIndex((t) => t.id === action.beforeId) : rest.length
      if (to < 0) return state
      const next = [...rest.slice(0, to), moved, ...rest.slice(to)]

      // 顺序没变就不落盘：把一行拖回原位不该产生一次写盘与一次无意义的渲染
      if (next.every((t, i) => t.id === server.tools[i].id)) return state
      return {
        ...state,
        servers: state.servers.map((s) => (s.id === server.id ? { ...s, tools: next } : s)),
      }
    }

    case 'import': {
      if (action.target === 'create') {
        const server: ServerDoc = {
          id: newId('srv'),
          name: action.name.trim() || '导入的 Server',
          description: action.description,
          transport: action.transport,
          protocolVersion: action.protocolVersion,
          tools: action.tools,
        }
        return {
          ...state,
          servers: [...state.servers, server],
          activeServerId: server.id,
          view: { kind: 'workspace' },
          lastToolId: null,
          focusToolId: null,
        }
      }

      const current = activeServerOf(state)
      if (!current) return state

      // 同名判定用英文名（trim 后），这是工具在 MCP 里的唯一标识
      const at = new Map(current.tools.map((t, i) => [t.name.trim(), i]))
      const tools = [...current.tools]
      for (const tool of action.tools) {
        const index = at.get(tool.name.trim())
        if (index === undefined) {
          at.set(tool.name.trim(), tools.length)
          tools.push(tool)
        } else if (action.conflict === 'overwrite') {
          tools[index] = tool
        }
      }

      return {
        ...state,
        servers: state.servers.map((s) => (s.id === current.id ? { ...s, tools } : s)),
        view: { kind: 'workspace' },
        focusToolId: null,
      }
    }

    case 'nav':
      return {
        ...state,
        view: action.view,
        lastToolId: action.view.kind === 'editor' ? action.view.toolId : state.lastToolId,
        focusToolId: action.view.kind === 'workspace' ? state.lastToolId : state.focusToolId,
      }

    default:
      return state
  }
}

/** 从 hash 还原当前视图，保证刷新后停在原处 */
function viewFromHash(toolExists: (id: string) => boolean): View {
  const hash = location.hash
  if (hash === '#/s') return { kind: 'settings' }
  if (hash.startsWith('#/t/')) {
    const id = decodeURIComponent(hash.slice(4))
    if (toolExists(id)) return { kind: 'editor', toolId: id }
  }
  return { kind: 'workspace' }
}

function hydrate(): State {
  let servers: ServerDoc[] = initialState.servers
  let activeServerId = initialState.activeServerId
  let lastToolId: string | null = initialState.lastToolId

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as Partial<State>
      if (saved.servers?.length) {
        /**
         * 早期版本种子里还带三个演示 Server（商品中心 / 客服工作台 / 财务对账）。
         * 老浏览器的 localStorage 里存着它们，不按 id 清掉的话，改了种子也看不到效果。
         * 只认这三个固定 id，用户自建的 Server 不受影响。
         */
        const kept = saved.servers.filter((s) => !RETIRED_SEED_SERVER_IDS.includes(s.id))
        const restored = kept.length ? kept : initialState.servers
        servers = restored.map((server) => ({
          ...server,
          tools: server.tools.map((tool) => ({
            ...tool,
            createdAt: normalizeTimestamp(tool.createdAt, SEED_TIMES[tool.id]?.createdAt),
            updatedAt: normalizeTimestamp(tool.updatedAt, SEED_TIMES[tool.id]?.updatedAt),
            input: normalizeFields(tool.input, SEED_TITLES),
            output: normalizeFields(tool.output, SEED_TITLES),
            // 示例是后加的字段，早期草稿里没有，读进来补空数组
            requestExamples: tool.requestExamples ?? [],
            responseExamples: tool.responseExamples ?? [],
            // 内部说明同样是后加的，早期草稿没有
            internalNotes: tool.internalNotes ?? '',
          })),
        }))
        activeServerId = restored.some((s) => s.id === saved.activeServerId)
          ? (saved.activeServerId as string)
          : restored[0].id
        lastToolId = saved.lastToolId ?? null
      }
    }
  } catch {
    /* 存储损坏时回落到种子数据 */
  }

  const server = servers.find((s) => s.id === activeServerId) ?? servers[0]
  const view = viewFromHash((id) => server.tools.some((t) => t.id === id))

  return {
    servers,
    activeServerId: server.id,
    view,
    lastToolId: view.kind === 'editor' ? view.toolId : lastToolId,
    focusToolId: null,
  }
}

interface StoreValue {
  state: State
  dispatch: React.Dispatch<Action>
  activeServer: ServerDoc
  activeTool: Tool | null
}

const StoreCtx = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, hydrate)

  /**
   * 落盘：输入时每个字符都会 dispatch，逐字同步序列化整份文档会让大 Server 卡顿。
   * 攒 300ms 再写；页面隐藏或卸载时立即 flush，避免最后那一拍编辑丢在关页瞬间。
   */
  const pending = useRef<{
    servers: ServerDoc[]
    activeServerId: string
    lastToolId: string | null
  } | null>(null)

  useEffect(() => {
    pending.current = {
      servers: state.servers,
      activeServerId: state.activeServerId,
      lastToolId: state.lastToolId,
    }
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pending.current))
      } catch {
        /* 配额满时静默降级，不阻断编辑 */
      }
    }, 300)
    return () => window.clearTimeout(timer)
  }, [state.servers, state.activeServerId, state.lastToolId])

  useEffect(() => {
    const flush = () => {
      if (!pending.current) return
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pending.current))
      } catch {
        /* 同上次写盘：配额满不影响正在编辑的内容 */
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  useEffect(() => {
    const hash =
      state.view.kind === 'editor'
        ? `#/t/${encodeURIComponent(state.view.toolId)}`
        : state.view.kind === 'settings'
          ? '#/s'
          : '#/'
    if (location.hash !== hash) history.replaceState(null, '', hash)
  }, [state.view])

  const value = useMemo<StoreValue>(() => {
    const activeServer = state.servers.find((s) => s.id === state.activeServerId) ?? state.servers[0]
    const toolId = state.view.kind === 'editor' ? state.view.toolId : null
    const activeTool = toolId ? (activeServer.tools.find((t) => t.id === toolId) ?? null) : null
    return { state, dispatch, activeServer, activeTool }
  }, [state])

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
