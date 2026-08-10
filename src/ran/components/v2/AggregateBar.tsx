/**
 * AggregateBar — horizontal bar of summary metrics for the Nodes page top.
 *
 *   [▣] TOTAL       [●] ONLINE     [○] DEGRADED   [●] OFFLINE   [⏱] EXPIRING   [⚡] HIGH LOAD
 *       18              16             0              2              4              3
 *
 * Each cell: glyph + label (small etched) + big number. Cells are dividers
 * separated and share one precision-card frame, similar to HeroStats but
 * with smaller numbers and a icon-anchored layout.
 *
 * Designed to live ABOVE the filter bar on the Nodes page.
 */

import type { ReactNode } from 'react'
import type { AggregateStats } from '@/hooks/v2'
import { Etch } from '@/components/atoms/Etch'
import { contentFs } from '@/utils/fontScale'
import { useIsMobile, useIsNarrow } from '@/hooks/useMediaQuery'

interface Props {
  stats: AggregateStats
  /** Number of nodes flagged as "high load" — computed externally
   * (e.g. count of nodes with load1 > 4) */
  highLoadCount?: number
}

interface Cell {
  icon: ReactNode
  iconColor: string
  label: string
  value: number
  valueColor?: string
  emphasis?: boolean
}

function Glyph({ children, color }: { children: ReactNode; color: string }) {
  return (
    <span
      style={{
        width: 22,
        height: 22,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-1)',
        border: '1px solid var(--edge-engrave)',
        borderRadius: 3,
        fontSize: contentFs(12),
        color,
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      {children}
    </span>
  )
}

export function AggregateBar({ stats, highLoadCount = 0 }: Props) {
  const isMobile = useIsMobile()
  const isNarrow = useIsNarrow()

  const cells: Cell[] = [
    {
      icon: '▣',
      iconColor: 'var(--fg-2)',
      label: 'TOTAL',
      value: stats.total,
    },
    {
      icon: '●',
      iconColor: 'var(--signal-good)',
      label: 'ONLINE',
      value: stats.online,
      valueColor: 'var(--signal-good)',
    },
    {
      icon: '○',
      iconColor: 'var(--signal-warn)',
      label: 'DEGRADED',
      value: stats.degraded,
      valueColor: stats.degraded > 0 ? 'var(--signal-warn)' : undefined,
    },
    {
      icon: '●',
      iconColor: 'var(--signal-bad)',
      label: 'OFFLINE',
      value: stats.offline,
      valueColor: stats.offline > 0 ? 'var(--signal-bad)' : undefined,
      emphasis: stats.offline > 0,
    },
    {
      icon: '⏱',
      iconColor: 'var(--accent)',
      label: 'EXPIRING SOON',
      value: stats.expiringSoon,
      valueColor: stats.expiringSoon > 0 ? 'var(--accent)' : undefined,
    },
    {
      icon: '⚡',
      iconColor: 'var(--signal-warn)',
      label: 'HIGH LOAD',
      value: highLoadCount,
      valueColor: highLoadCount > 0 ? 'var(--signal-warn)' : undefined,
    },
  ]

  // Mobile: 3 columns × 2 rows. Narrow phone: 2 × 3.
  const cols = isNarrow ? 2 : isMobile ? 3 : cells.length

  return (
    <div
      className="precision-card"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        overflow: 'hidden',
      }}
      aria-label="cluster aggregate stats"
    >
      {cells.map((c, i) => {
        const isLastCol = (i + 1) % cols === 0
        const isLastRow = i >= cells.length - cols
        return (
          <div
            key={c.label}
            style={{
              padding: isMobile ? '8px 10px' : '10px 14px',
              borderRight: isLastCol ? 'none' : '1px solid var(--edge-engrave)',
              borderBottom: isLastRow ? 'none' : '1px solid var(--edge-engrave)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Glyph color={c.iconColor}>{c.icon}</Glyph>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                minWidth: 0,
              }}
            >
              <Etch>{c.label}</Etch>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: contentFs(20),
                  fontWeight: 500,
                  lineHeight: 1.1,
                  letterSpacing: '-0.01em',
                  color: c.valueColor ?? 'var(--fg-0)',
                }}
              >
                {c.value}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
