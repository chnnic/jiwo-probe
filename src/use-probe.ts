import { useEffect, useRef, useState } from 'react'
import type { ProbeAppearance, ProbePayload, ThemeName } from './types'

const APPEARANCE_CACHE = 'mmwx-probe-appearance'
const DARK_OVERRIDE = 'mmwx-probe-dark-override'
const THEME_OVERRIDE = 'mmwx-probe-theme-override'

function normalizeTheme(value?: string): ThemeName {
  return value === 'anime' || value === 'flat' || value === 'glass' || value === 'lumina' ? value : 'pixel'
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
  const theme = themeOverride || normalizeTheme(appearance.theme)
  const root = document.documentElement
  root.classList.remove('theme-pixel', 'theme-flat', 'theme-anime', 'theme-glass', 'theme-lumina', 'dark')
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
