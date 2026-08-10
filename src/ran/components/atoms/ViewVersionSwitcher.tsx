/**
 * useViewVersion / ViewVersionSwitcher — choose between v1 (classic) and
 * v2 (modern dashboard) page layouts.
 *
 * Resolution priority (highest → lowest):
 *   1. localStorage `ran.viewVersion`  — user picked it explicitly
 *   2. config.theme_settings.default_view — site admin's default in Komari
 *   3. 'v2'                             — built-in default
 *
 * Once the user clicks the switcher their preference is persisted, and the
 * backend default no longer applies (same pattern as default_theme).
 *
 * Hash-route override: visiting #/v1/overview or #/v2/overview forces that
 * view for the duration of the visit, but doesn't change the persisted
 * preference. That way you can share a link to a specific version without
 * stickying it to your own preference.
 */

import { useCallback, useEffect, useState } from 'react'
import { contentFs } from '@/utils/fontScale'
import { Etch } from '@/components/atoms/Etch'

export type ViewVersion = 'v1' | 'v2'

const STORAGE_KEY = 'ran.viewVersion'
const USER_SET_KEY = 'ran.viewVersion.user'
const DEFAULT: ViewVersion = 'v2'

function isValidVersion(v: unknown): v is ViewVersion {
  return v === 'v1' || v === 'v2'
}

function loadFromLocalStorage(): ViewVersion | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (isValidVersion(v)) return v
  } catch {
    /* ignore */
  }
  return null
}

function saveToLocalStorage(v: ViewVersion): void {
  try {
    localStorage.setItem(STORAGE_KEY, v)
    localStorage.setItem(USER_SET_KEY, '1')
  } catch {
    /* ignore */
  }
}

/**
 * Hook: returns the current resolved view version + a setter.
 *
 * Pass the backend default (`config.theme_settings.default_view`) as the
 * argument; the hook applies it only if the user has never explicitly
 * picked a version.
 */
export function useViewVersion(
  backendDefault?: unknown,
): [ViewVersion, (v: ViewVersion) => void] {
  const [version, setVersion] = useState<ViewVersion>(
    () => loadFromLocalStorage() ?? DEFAULT,
  )

  // Apply backend default only if user has never set it.
  useEffect(() => {
    try {
      if (localStorage.getItem(USER_SET_KEY)) return
    } catch {
      return
    }
    if (isValidVersion(backendDefault)) setVersion(backendDefault)
  }, [backendDefault])

  // Cross-tab sync
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      if (isValidVersion(e.newValue)) setVersion(e.newValue)
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const set = useCallback((v: ViewVersion) => {
    setVersion(v)
    saveToLocalStorage(v)
  }, [])

  return [version, set]
}

interface SwitcherProps {
  value: ViewVersion
  onChange: (v: ViewVersion) => void
  /** Compact mode for tight Topbar fits */
  size?: 'sm' | 'md'
}

/**
 * ViewVersionSwitcher — segmented [v1 | v2] toggle, matches the visual
 * language of the Segmented atom used for theme/view modes.
 */
export function ViewVersionSwitcher({
  value,
  onChange,
  size = 'sm',
}: SwitcherProps) {
  const fontSize = size === 'sm' ? 9 : 10
  const padX = size === 'sm' ? 7 : 9
  const padY = size === 'sm' ? 3 : 4

  return (
    <div
      title={`Layout: ${value === 'v2' ? 'Modern dashboard' : 'Classic grid'}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
      }}
    >
      <Etch>LAYOUT</Etch>
      <div
        style={{
          display: 'inline-flex',
          background: 'var(--bg-inset)',
          border: '1px solid var(--edge-engrave)',
          borderRadius: 4,
          padding: 1,
          boxShadow: 'inset 0 1px 0 var(--edge-deep)',
        }}
      >
        {(['v1', 'v2'] as ViewVersion[]).map((v) => {
          const active = value === v
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              style={{
                padding: `${padY}px ${padX}px`,
                background: active ? 'var(--bg-2)' : 'transparent',
                border: 'none',
                borderRadius: 2,
                fontFamily: 'var(--font-mono)',
                fontSize: contentFs(fontSize),
                letterSpacing: '0.14em',
                color: active ? 'var(--accent-bright)' : 'var(--fg-3)',
                fontWeight: active ? 500 : 400,
                cursor: 'pointer',
                boxShadow: active ? 'inset 0 1px 0 var(--bg-1)' : 'none',
              }}
            >
              {v.toUpperCase()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
