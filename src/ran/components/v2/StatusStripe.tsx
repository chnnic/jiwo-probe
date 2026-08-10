/**
 * StatusStripe — slim horizontal strip showing cluster-level live status.
 *
 * Displays at the top of Overview / Nodes:
 *   ● LIVE  ●16 ONLINE  ●2 OFFLINE  ○1 DEGRADED  ⓘ5 REGIONS  ▲3 ALERTS
 *   AVG LAT 36ms · SYNC 3s ago
 *
 * Compact, monospace, dot-separated. Values are pulled from the AggregateStats
 * derivation. Sync timestamp shows seconds-since-update (auto-refresh via a
 * small ticking timer).
 */

import { useEffect, useState } from 'react'
import type { AggregateStats } from '@/hooks/v2'
import { contentFs } from '@/utils/fontScale'
import { useIsMobile } from '@/hooks/useMediaQuery'

interface Props {
  stats: AggregateStats
  /** Number of pending alerts (from useAlertSummary.counts.total) */
  alertCount?: number
  /** Number of regions (from useRegionDistribution.length) */
  regionCount?: number
  /** Connection live? Drives the leading green dot */
  isLive?: boolean
  /** Last WS update timestamp (ms) — drives the "SYNC Xs ago" tail */
  lastUpdate?: number | null
}

function formatSyncAgo(ms: number): string {
  if (ms < 1000) return 'just now'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  return `${h}h ago`
}

function formatLatency(avgPing: number | undefined): string {
  if (typeof avgPing !== 'number' || !Number.isFinite(avgPing)) return '—'
  if (avgPing < 10) return avgPing.toFixed(1) + 'ms'
  return Math.round(avgPing) + 'ms'
}

export function StatusStripe({
  stats,
  alertCount = 0,
  regionCount,
  isLive,
  lastUpdate,
}: Props) {
  const [now, setNow] = useState(Date.now())
  const isMobile = useIsMobile()

  // Tick every second to refresh the "SYNC Xs ago" text
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const syncAgo = lastUpdate ? formatSyncAgo(now - lastUpdate) : '—'

  // On mobile we hide the secondary metrics (avg lat / sync) to keep the strip
  // from wrapping awkwardly. Critical counts always render.
  const items: Array<{
    icon?: string
    iconColor?: string
    label: string
    value?: string | number
    valueColor?: string
    muted?: boolean
  }> = [
    isLive
      ? { icon: '●', iconColor: 'var(--signal-good)', label: 'LIVE' }
      : { icon: '○', iconColor: 'var(--fg-3)', label: 'OFFLINE' },
    {
      icon: '●',
      iconColor: 'var(--signal-good)',
      label: 'ONLINE',
      value: stats.online,
      valueColor: 'var(--signal-good)',
    },
    {
      icon: '●',
      iconColor: 'var(--signal-bad)',
      label: 'OFFLINE',
      value: stats.offline,
      valueColor: stats.offline > 0 ? 'var(--signal-bad)' : undefined,
    },
    {
      icon: '○',
      iconColor: 'var(--signal-warn)',
      label: 'DEGRADED',
      value: stats.degraded,
      valueColor: stats.degraded > 0 ? 'var(--signal-warn)' : undefined,
    },
  ]

  if (typeof regionCount === 'number') {
    items.push({
      label: 'REGIONS',
      value: regionCount,
    })
  }

  items.push({
    icon: '▲',
    iconColor: alertCount > 0 ? 'var(--signal-warn)' : 'var(--fg-3)',
    label: 'ALERTS',
    value: alertCount,
    valueColor: alertCount > 0 ? 'var(--signal-warn)' : undefined,
  })

  if (!isMobile) {
    items.push({
      label: 'AVG LAT',
      value: formatLatency(stats.avgPing),
      muted: true,
    })
    items.push({
      label: 'SYNC',
      value: syncAgo,
      muted: true,
    })
  }

  return (
    <div
      className="precision-card"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: isMobile ? 12 : 22,
        padding: isMobile ? '8px 12px' : '10px 18px',
      }}
      aria-label="cluster status"
    >
      {items.map((it, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: 'var(--font-mono)',
            fontVariantNumeric: 'tabular-nums',
            fontSize: contentFs(isMobile ? 10 : 11),
            letterSpacing: '0.08em',
            color: it.muted ? 'var(--fg-3)' : 'var(--fg-1)',
            whiteSpace: 'nowrap',
          }}
        >
          {it.icon && (
            <span
              style={{
                color: it.iconColor ?? 'currentColor',
                fontSize: contentFs(isMobile ? 10 : 11),
                lineHeight: 1,
                filter:
                  it.iconColor === 'var(--signal-good)' && isLive
                    ? 'drop-shadow(0 0 3px var(--signal-good))'
                    : undefined,
              }}
            >
              {it.icon}
            </span>
          )}
          {it.value !== undefined && (
            <span
              style={{
                fontWeight: 500,
                color: it.valueColor ?? 'var(--fg-0)',
              }}
            >
              {it.value}
            </span>
          )}
          <span>{it.label}</span>
        </div>
      ))}
    </div>
  )
}
