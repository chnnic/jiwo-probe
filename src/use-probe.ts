import { useEffect, useRef, useState } from 'react'
import type { ProbeAppearance, ProbePayload, ThemeName } from './types'

const APPEARANCE_CACHE = 'mmwx-probe-appearance'
const DARK_OVERRIDE = 'mmwx-probe-dark-override'
const THEME_OVERRIDE = 'mmwx-probe-theme-override'

function normalizeTheme(value?: string): ThemeName {
  return value === 'anime' || value === 'flat' || value === 'glass' || value === 'lumina' ? value : 'pixel'
}

// 主控可能下发自定义主题名（theme-{name} 类）。内置 5 主题走主题系统；
// 未知主题名照常挂 theme-{name} 类——站长可在自己的 CSS 里写 .theme-{name} 覆盖，
// 没写则回退到默认(pixel)样式。返回值 = 是否内置主题（供 UI 判断"跟随主控"时如何显示）。
export function isBuiltinTheme(value?: string): boolean {
  return value === 'pixel' || value === 'flat' || value === 'anime' || value === 'glass' || value === 'lumina'
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
  const lower = raw.toLowerCase()
  const theme = isBuiltinTheme(lower) ? lower : raw
  const root = document.documentElement
  // 清理所有 theme-* 类（含可能的自定义主题类），再挂当前主题
  for (const cls of [...root.classList]) {
    if (cls.startsWith('theme-')) root.classList.remove(cls)
  }
  root.classList.remove('dark')
  root.classList.add(`theme-${theme}`)
  const darkOverride = localStorage.getItem(DARK_OVERRIDE)
  let dark: boolean
  if (darkOverride === 'dark') {
    dark = true
  } else if (darkOverride === 'light') {
    dark = false
  } else {
    dark = appearance.color_mode === 'dark' ||
      (appearance.color_mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  }
  if (dark) root.classList.add('dark')
  root.dataset.themeReady = 'true'
  if (input) localStorage.setItem(APPEARANCE_CACHE, JSON.stringify(input))
}

export function getDarkOverride(): string | null {
  return localStorage.getItem(DARK_OVERRIDE)
}

export function setDarkOverride(mode: 'dark' | 'light' | null) {
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
    const raw = cached?.theme || 'pixel'
    const lower = raw.toLowerCase()
    return isBuiltinTheme(lower) ? lower : raw
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
      setData(payload)
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
