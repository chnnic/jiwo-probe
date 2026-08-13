import { useEffect, useRef, useState } from 'react'
import type { ProbeAppearance, ProbePayload, ProbeServer, ThemeName } from './types'

const APPEARANCE_CACHE = 'mmwx-probe-appearance'
const DARK_OVERRIDE = 'mmwx-probe-dark-override'
const THEME_OVERRIDE = 'mmwx-probe-theme-override'

// ===== 日流量跨周期历史(浏览器本地缓存, 保留 90 天) =====
// 主控 daily_traffic 只含当前重置周期, 重置即清零 → 前端把每次 payload 合并进
// localStorage, 过重置日后流量趋势图仍保留历史(换设备/清缓存会丢, 零服务端依赖)。
const LOCAL_HIST_KEY = 'probe-daily-traffic-v1'
const LOCAL_HIST_DAYS = 90

type DailyHistory = Record<string, Record<string, [number, number, number]>>
type DailyRow = NonNullable<ProbeServer['daily_traffic']>[number]
export type EnrichedServer = ProbeServer & { cycle_daily_traffic?: DailyRow[] }

function loadLocalHistory(): DailyHistory | null {
  try {
    const raw = localStorage.getItem(LOCAL_HIST_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DailyHistory
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function persistLocalHistory(history: DailyHistory): void {
  const cutoff = new Date(Date.now() - LOCAL_HIST_DAYS * 86400 * 1000).toISOString().slice(0, 10)
  for (const name of Object.keys(history)) {
    for (const date of Object.keys(history[name])) {
      if (date < cutoff) delete history[name][date]
    }
    if (!Object.keys(history[name]).length) delete history[name]
  }
  try {
    localStorage.setItem(LOCAL_HIST_KEY, JSON.stringify(history))
  } catch {
    // 存储满/隐私模式忽略
  }
}

// 合并: 历史(按服务器名) 为底, payload 当天数据覆盖(最新值), 按日期排序。
// 附加 cycle_daily_traffic = payload 原始周期内数据(周期拆分比例用, 避免被 90 天历史污染)
function mergeDailyTraffic(servers: ProbeServer[], history: DailyHistory | null): EnrichedServer[] {
  if (!history || !Object.keys(history).length) return servers
  return servers.map((server) => {
    const name = server.name?.trim()
    if (!name) return server
    const byDate = new Map<string, { uplink: number; downlink: number; total: number }>()
    for (const [date, recs] of Object.entries(history)) {
      const rec = recs?.[name]
      if (rec) byDate.set(date, { uplink: rec[0], downlink: rec[1], total: rec[2] })
    }
    for (const row of server.daily_traffic || []) {
      if (row?.date) byDate.set(row.date, { uplink: row.uplink ?? 0, downlink: row.downlink ?? 0, total: row.total ?? 0 })
    }
    if (!byDate.size) return server
    const merged = [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, rec]) => ({ date, uplink: rec.uplink, downlink: rec.downlink, total: rec.total }))
    return { ...server, daily_traffic: merged, cycle_daily_traffic: server.daily_traffic || [] }
  })
}

// payload 到达时: 合并本地跨周期历史并写回
function enrichPayload(payload: ProbePayload): ProbePayload {
  if (!payload?.servers?.length) return payload
  const prev = loadLocalHistory()
  const next: DailyHistory = prev && typeof prev === 'object' ? JSON.parse(JSON.stringify(prev)) : {}
  for (const server of payload.servers) {
    const name = server.name?.trim()
    if (!name || !Array.isArray(server.daily_traffic)) continue
    next[name] = next[name] ?? {}
    for (const row of server.daily_traffic) {
      if (!row?.date) continue
      next[name][row.date] = [row.uplink ?? 0, row.downlink ?? 0, row.total ?? (row.uplink ?? 0) + (row.downlink ?? 0)]
    }
  }
  persistLocalHistory(next)
  return { ...payload, servers: mergeDailyTraffic(payload.servers, next) }
}

function normalizeTheme(value?: string): ThemeName {
  return value === 'anime' || value === 'flat' || value === 'glass' || value === 'lumina' ? value : 'pixel'
}

// 主控下发组合名 "Lumina-Gold" / "Lumina Gold" / "LUMINAGOLD" → lumina 主题 + 黑金配色
// "Glassmorphism Light/Dark" → glassmorphism 主题 + 白天/夜间模式
export function parseThemeName(raw: string): { theme: string; gold: boolean; light?: boolean } {
  const lower = raw.toLowerCase().replace(/[\s_-]/g, '')
  if (lower === 'luminagold') return { theme: 'lumina', gold: true }
  if (lower === 'glassmorphismlight') return { theme: 'glassmorphism', gold: false, light: true }
  if (lower === 'glassmorphismdark') return { theme: 'glassmorphism', gold: false, light: false }
  return { theme: isBuiltinTheme(raw.toLowerCase()) ? raw.toLowerCase() : raw, gold: false }
}

// 主控可能下发自定义主题名（theme-{name} 类）。内置 6 主题走主题系统（含 premium 整页主题）；
// 未知主题名照常挂 theme-{name} 类——站长可在自己的 CSS 里写 .theme-{name} 覆盖，
// 没写则回退到默认(pixel)样式。返回值 = 是否内置主题（供 UI 判断"跟随主控"时如何显示）。
export function isBuiltinTheme(value?: string): boolean {
  return value === 'pixel' || value === 'flat' || value === 'anime' || value === 'glass' || value === 'lumina' || value === 'premium' || value === 'luminagold' || value === 'ran' || value === 'glassmorphism'
}

export function applyAppearance(input?: ProbeAppearance) {
  const cached = (() => {
    try {
      return JSON.parse(localStorage.getItem(APPEARANCE_CACHE) || 'null') as ProbeAppearance | null
    } catch {
      return null
    }
  })()
  const appearance = input || cached || { theme: 'pixel', color_mode: 'light' }
  const themeOverride = localStorage.getItem(THEME_OVERRIDE) as ThemeName | null
  // 用户手动选择的内置主题优先；否则用主控下发的主题名。
  // 内置主题名大小写不敏感归一化（主控可能下发 Lumina/LUMINA → lumina）；
  // 自定义主题名原样保留挂 theme-{name}（站长 CSS 怎么写就怎么匹配）。
  const raw = themeOverride || appearance.theme || 'pixel'
  // 组合名解析: "lumina-gold" → lumina 主题 + gold 黑金配色（主控下发可直接指定黑金）
  const parsed = parseThemeName(raw)
  const theme = parsed.theme
  const root = document.documentElement
  // 清理所有 theme-* 类（含可能的自定义主题类），再挂当前主题
  for (const cls of [...root.classList]) {
    if (cls.startsWith('theme-')) root.classList.remove(cls)
  }
  // Ran 主题把 data-theme 挂在 body 上且卸载时不清理,
  // tokens.css 的全局 body{color:var(--fg-0)} 会污染切换后的主题文字色 → 这里兜底清掉
  document.body.removeAttribute('data-theme')
  root.classList.remove('dark')
  root.classList.remove('gold')
  root.classList.add(`theme-${theme}`)
  const darkOverride = localStorage.getItem(DARK_OVERRIDE)
  let dark: boolean
  if (darkOverride === 'gold' || (parsed.gold && !themeOverride && !darkOverride)) {
    // 黑金配色（lumina 第三配色）: 不挂 dark, 挂 gold。
    // 手动 override 为 gold，或主控下发组合名且用户从未手动干预（主题/配色都没选过）才进入。
    // 用户一旦手动切过配色（darkOverride 任意值），主控的 gold 不再强制，尊重用户选择。
    root.classList.add('gold')
    dark = false
  } else if (darkOverride === 'dark') {
    dark = true
  } else if (darkOverride === 'light') {
    dark = false
  } else {
    dark = appearance.color_mode === 'dark' ||
      (appearance.color_mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  }
  if (dark) root.classList.add('dark')
  // Glassmorphism 明暗下发: 写 master 缓存, GmApp 初始化时读取(用户手动切换优先)
  if (parsed.light !== undefined) {
    localStorage.setItem('gm-color-mode-master', parsed.light ? 'light' : 'dark')
  }
  root.dataset.themeReady = 'true'
  if (input) localStorage.setItem(APPEARANCE_CACHE, JSON.stringify(input))
}

export function getDarkOverride(): string | null {
  return localStorage.getItem(DARK_OVERRIDE)
}

export function setDarkOverride(mode: 'dark' | 'light' | 'gold' | null) {
  if (mode) {
    localStorage.setItem(DARK_OVERRIDE, mode)
  } else {
    localStorage.removeItem(DARK_OVERRIDE)
  }
  applyAppearance()
}

const THEME_CYCLE: ThemeName[] = ['pixel', 'flat', 'anime', 'glass', 'lumina']

export function getThemeOverride(): ThemeName | null {
  return localStorage.getItem(THEME_OVERRIDE) as ThemeName | null
}

// 当前生效主题: 用户手动 override 优先，否则主控下发的 theme（内置名归一化小写，自定义名原样）。
// 视图分支（如 theme==='lumina' 渲染 ServerCardLumina）应读这个，而不是只看 override。
export function getActiveTheme(): string {
  const override = getThemeOverride()
  if (override) return override
  try {
    const cached = JSON.parse(localStorage.getItem(APPEARANCE_CACHE) || 'null') as ProbeAppearance | null
    return parseThemeName(cached?.theme || 'pixel').theme
  } catch {
    return 'pixel'
  }
}

export function cycleTheme(): ThemeName | null {
  const current = getThemeOverride()
  if (!current) {
    localStorage.setItem(THEME_OVERRIDE, 'pixel')
    applyAppearance()
    return 'pixel'
  }
  const idx = THEME_CYCLE.indexOf(current)
  if (idx < 0 || idx >= THEME_CYCLE.length - 1) {
    localStorage.removeItem(THEME_OVERRIDE)
    applyAppearance()
    return null
  }
  const next = THEME_CYCLE[idx + 1]
  localStorage.setItem(THEME_OVERRIDE, next)
  applyAppearance()
  return next
}

export function setTheme(name: ThemeName | null): ThemeName | null {
  if (name) {
    localStorage.setItem(THEME_OVERRIDE, name)
  } else {
    localStorage.removeItem(THEME_OVERRIDE)
  }
  applyAppearance()
  return name
}

export function useProbe(): { data?: ProbePayload; error?: string } {
  const [data, setData] = useState<ProbePayload>()
  const [error, setError] = useState<string>()
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    let stopped = false
    let ws: WebSocket | undefined

    const accept = (payload: ProbePayload) => {
      if (stopped) return
      applyAppearance(payload.appearance)
      setData(enrichPayload(payload))
      setError(undefined)
      if (payload.title) document.title = payload.title
    }
    const poll = async () => {
      try {
        const response = await fetch('/api/probe', { cache: 'no-store' })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        accept(await response.json() as ProbePayload)
      } catch (cause) {
        if (!stopped) setError(cause instanceof Error ? cause.message : String(cause))
      }
    }
    const startPolling = () => {
      if (timer.current) return
      void poll()
      timer.current = window.setInterval(poll, 5000)
    }

    applyAppearance()
    // Keep polling as a fallback even when the WebSocket handshake succeeds.
    // Some proxies leave an idle WebSocket open without forwarding later frames,
    // which otherwise freezes realtime speed at the first snapshot.
    startPolling()
    try {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      ws = new WebSocket(`${protocol}//${location.host}/api/stream`)
      ws.onmessage = (event) => {
        try { accept(JSON.parse(event.data) as ProbePayload) } catch { /* wait for next frame */ }
      }
      ws.onerror = startPolling
      ws.onclose = startPolling
    } catch {
      startPolling()
    }

    return () => {
      stopped = true
      ws?.close()
      if (timer.current) window.clearInterval(timer.current)
      timer.current = undefined
    }
  }, [])

  return { data, error }
}
