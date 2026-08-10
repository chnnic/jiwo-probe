/**
 * SystemStatusFooter — small "System Operational" status pill, intended to
 * sit at the bottom of the sidebar on v2 pages.
 *
 * Visual:
 *   ┌──────────────────────────┐
 *   │ ● System Operational     │
 *   │   All core services up   │
 *   │   Last updated: 09:42:13 │
 *   │   UTC+8                  │
 *   └──────────────────────────┘
 *
 * Render mode: by default it renders inline (so callers can position with
 * flex/grid). For absolute-bottom-of-sidebar use, wrap in a positioned div.
 *
 * Determining "operational":
 *   - All-good: conn === 'open' AND lastUpdate is recent (< 30s)
 *   - Degraded: conn === 'connecting' OR lastUpdate stale (30-120s)
 *   - Down:     anything else
 */

import { useEffect, useState } from 'react'
import { Etch } from '@/components/atoms/Etch'
import { contentFs } from '@/utils/fontScale'

type Conn = 'connecting' | 'open' | 'closed' | 'error' | 'idle'
type Status = 'operational' | 'degraded' | 'down'

interface Props {
  conn?: Conn
  lastUpdate?: number | null
  /** Optional override label */
  label?: string
}

const STATUS_COLOR: Record<Status, string> = {
  operational: 'var(--signal-good)',
  degraded: 'var(--signal-warn)',
  down: 'var(--signal-bad)',
}

const STATUS_LABEL: Record<Status, string> = {
  operational: 'System Operational',
  degraded: 'Degraded',
  down: 'Disconnected',
}

const STATUS_SUB: Record<Status, string> = {
  operational: 'All core services running',
  degraded: 'Reconnecting…',
  down: 'No live data',
}

function fmtClock(ms: number): string {
  const d = new Date(ms)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

function fmtUtcOffset(): string {
  // Browser timezone offset, e.g. "UTC+8" or "UTC-5"
  const offsetMin = -new Date().getTimezoneOffset()
  const sign = offsetMin >= 0 ? '+' : '-'
  const hours = Math.floor(Math.abs(offsetMin) / 60)
  const mins = Math.abs(offsetMin) % 60
  return mins === 0
    ? `UTC${sign}${hours}`
    : `UTC${sign}${hours}:${String(mins).padStart(2, '0')}`
}

export function SystemStatusFooter({ conn, lastUpdate }: Props) {
  const [now, setNow] = useState(Date.now())

  // Tick every 5s for the clock
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(t)
  }, [])

  const wsAge = lastUpdate ? now - lastUpdate : Infinity
  const status: Status =
    conn === 'open' && wsAge < 30_000
      ? 'operational'
      : (conn === 'open' && wsAge < 120_000) || conn === 'connecting'
        ? 'degraded'
        : 'down'

  const color = STATUS_COLOR[status]

  return (
    <div
      className="precision-card"
      style={{
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        fontFamily: 'var(--font-mono)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: color,
            boxShadow: status === 'operational' ? `0 0 4px ${color}` : undefined,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: contentFs(11),
            color: 'var(--fg-0)',
            fontWeight: 500,
          }}
        >
          {STATUS_LABEL[status]}
        </span>
      </div>

      <div
        style={{
          fontSize: contentFs(9.5),
          color: 'var(--fg-3)',
          letterSpacing: '0.04em',
          paddingLeft: 14,
        }}
      >
        {STATUS_SUB[status]}
      </div>

      <div
        style={{
          marginTop: 4,
          paddingLeft: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        <Etch>Last updated</Etch>
        <span
          style={{
            fontSize: contentFs(10),
            color: 'var(--fg-1)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {lastUpdate ? fmtClock(lastUpdate) : '—'}
        </span>
        <span
          style={{
            fontSize: contentFs(9),
            color: 'var(--fg-3)',
            letterSpacing: '0.06em',
          }}
        >
          {fmtUtcOffset()}
        </span>
      </div>

      <a
        href="./#/overview"
        title="Return to Ran overview"
        style={{
          marginTop: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '7px 10px',
          background: 'var(--bg-1)',
          border: '1px solid var(--edge-engrave)',
          borderRadius: 2,
          boxShadow: 'inset 0 1px 0 var(--edge-bright), inset 0 -1px 0 var(--edge-deep)',
          fontFamily: 'var(--font-mono)',
          fontSize: contentFs(9.5),
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--fg-1)',
          textDecoration: 'none',
          transition: 'color 0.15s, background 0.15s, border-color 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--accent-bright)'
          e.currentTarget.style.background = 'var(--bg-2)'
          e.currentTarget.style.borderColor = 'var(--edge-mid)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--fg-1)'
          e.currentTarget.style.background = 'var(--bg-1)'
          e.currentTarget.style.borderColor = 'var(--edge-engrave)'
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 8, color: 'var(--accent)', letterSpacing: '0.2em', fontWeight: 700 }}>
            ◇
          </span>
          <span style={{ fontWeight: 600 }}>RAN · OVERVIEW</span>
        </span>
        <span style={{ fontSize: contentFs(10), lineHeight: 1, color: 'var(--fg-3)', fontFamily: 'var(--font-sans)' }}>
          →
        </span>
      </a>
    </div>
  )
}
