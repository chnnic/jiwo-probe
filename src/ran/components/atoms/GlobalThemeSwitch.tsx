import { useEffect, useRef, useState } from 'react'
import { getActiveTheme, setTheme } from '../../../use-probe'

/**
 * GlobalThemeSwitch — Ran 界面右上角的「全部主题」切换器(本地定制)。
 *
 * 经典界面的 7 个顶层主题: 像素/扁平/动漫/玻璃/Lumina/Premium/岚·Ran。
 * 选择后写 localStorage override + applyAppearance 挂 class,
 * main.tsx 的 MutationObserver 监听 documentElement class 变化 → 整页切换界面。
 * 选择「岚 · Ran」时保留用户上次在 Ran 内选过的变体(ran.theme 缓存, 如 ran-sakura)。
 */

const GLOBAL_THEMES = [
  { value: 'pixel', label: '像素' },
  { value: 'flat', label: '扁平' },
  { value: 'anime', label: '动漫' },
  { value: 'glass', label: '玻璃' },
  { value: 'lumina', label: 'Lumina' },
  { value: 'premium', label: 'Premium' },
  { value: 'ran', label: '岚 · Ran' },
] as const

function activeBase(): string {
  const t = getActiveTheme()
  return /^ran(-|$)/i.test(t) ? 'ran' : t
}

export function GlobalThemeSwitch() {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const current = activeBase()
  const currentLabel = GLOBAL_THEMES.find((o) => o.value === current)?.label || current

  // Click-outside + ESC to close.
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (value: string) => {
    if (value === 'ran') {
      // 保留用户上次在 Ran 里选过的变体(ran.theme 缓存), 否则用默认 'ran'
      let saved: string | null = null
      try {
        saved = localStorage.getItem('ran.theme')
      } catch {
        /* ignore */
      }
      setTheme((saved && /^ran-/.test(saved) ? saved : 'ran') as typeof value & never)
    } else {
      setTheme(value as never)
    }
    setOpen(false)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="切换全部主题"
        title={`全部主题: ${currentLabel}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          padding: '4px 9px 4px 7px',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          fontWeight: 500,
          color: 'var(--fg-1)',
          background: open ? 'var(--bg-3)' : 'var(--bg-inset)',
          border: '1px solid var(--edge-engrave)',
          borderRadius: 4,
          cursor: 'pointer',
          boxShadow: 'inset 0 1px 0 var(--edge-deep), inset 0 -1px 0 var(--edge-bright)',
          transition: 'background 120ms',
        }}
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          aria-hidden="true"
          style={{ flexShrink: 0, opacity: 0.85 }}
        >
          <circle cx="4" cy="4" r="2.6" />
          <circle cx="10" cy="4.5" r="1.8" opacity="0.7" />
          <circle cx="7" cy="10" r="2.2" opacity="0.5" />
        </svg>
        <span style={{ maxWidth: 84, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentLabel}
        </span>
        <span
          aria-hidden="true"
          style={{ fontSize: 8, opacity: 0.6, marginLeft: 1, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 120ms' }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="全部主题"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: 172,
            background: 'var(--bg-1)',
            border: '1px solid var(--edge-mid)',
            borderRadius: 4,
            boxShadow: '0 1px 0 var(--edge-bright) inset, 0 4px 14px rgba(0,0,0,0.18)',
            padding: 3,
            zIndex: 30,
          }}
        >
          {GLOBAL_THEMES.map((opt) => {
            const active = opt.value === current
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => pick(opt.value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '7px 9px',
                  border: 'none',
                  background: active ? 'var(--bg-3)' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  borderRadius: 3,
                  borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                  transition: 'background 100ms',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  color: 'var(--fg-1)',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = 'var(--bg-2)'
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = 'transparent'
                }}
              >
                <span style={{ flex: 1 }}>{opt.label}</span>
                {active && <span style={{ color: 'var(--accent)', fontSize: 10 }}>●</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
