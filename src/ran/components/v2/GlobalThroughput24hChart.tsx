/**
 * GlobalThroughput24hChart — full-width area chart of cluster-wide network
 * throughput over 24h, with IN/OUT/BOTH view toggle.
 *
 * Data source: useGlobalHistory({ windowMs: 24h }).aggregate provides
 * netIn / netOut arrays bucketed across 60 slots.
 *
 * Visual:
 *   - Two stacked-ish areas (RX green, TX accent-amber). When mode='both' both
 *     render; otherwise just one.
 *   - X axis ticks at every 4th bucket
 *   - Right side: peak / latest readout per direction
 *
 * The chart is presentation-only — caller passes in series + totals.
 */

import { useState } from 'react'
import { Etch } from '@/components/atoms/Etch'
import { SerialPlate } from '@/components/atoms/SerialPlate'
import { TimeWindowSwitcher } from './TimeWindowSwitcher'
import { contentFs } from '@/utils/fontScale'
import { formatBytes, formatBps } from '@/utils/format'
import { useIsMobile } from '@/hooks/useMediaQuery'

export type ThroughputView = 'in' | 'out' | 'both'

interface Props {
  /** Bytes/sec series (one entry per bucket) */
  netIn: number[]
  netOut: number[]
  /** Cumulative totals for the legend, in bytes */
  totalIn?: number
  totalOut?: number
  /** Window label, e.g. "Last 24h" */
  windowLabel?: string
  title?: string
  serial?: string
  /**
   * Optional time-window switcher. When provided, a [24H | 3D | 7D | 30D]
   * segmented control renders next to the chart title and clicking it
   * calls onTimeWindowChange. Without these, the chart is fixed at
   * whatever data the parent passes.
   */
  timeWindow?: number
  onTimeWindowChange?: (hours: number) => void
}

function buildAreaPath(
  data: number[],
  width: number,
  height: number,
  max: number,
  padding: { l: number; r: number; t: number; b: number },
): string {
  if (data.length === 0 || max <= 0) return ''
  const plotW = width - padding.l - padding.r
  const plotH = height - padding.t - padding.b
  const dx = plotW / Math.max(1, data.length - 1)

  let d = `M ${padding.l} ${height - padding.b}`
  for (let i = 0; i < data.length; i++) {
    const x = padding.l + i * dx
    const y = height - padding.b - (data[i] / max) * plotH
    d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`
  }
  d += ` L ${padding.l + (data.length - 1) * dx} ${height - padding.b}`
  d += ' Z'
  return d
}

function buildLinePath(
  data: number[],
  width: number,
  height: number,
  max: number,
  padding: { l: number; r: number; t: number; b: number },
): string {
  if (data.length === 0 || max <= 0) return ''
  const plotW = width - padding.l - padding.r
  const plotH = height - padding.t - padding.b
  const dx = plotW / Math.max(1, data.length - 1)

  return data
    .map((v, i) => {
      const x = padding.l + i * dx
      const y = height - padding.b - (v / max) * plotH
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

export function GlobalThroughput24hChart({
  netIn,
  netOut,
  totalIn,
  totalOut,
  windowLabel = 'Last 24h',
  title = 'GLOBAL THROUGHPUT',
  serial = 'T01',
  timeWindow,
  onTimeWindowChange,
}: Props) {
  const [view, setView] = useState<ThroughputView>('both')
  const isMobile = useIsMobile()

  // Latest values for the readout
  const latestIn = netIn[netIn.length - 1] ?? 0
  const latestOut = netOut[netOut.length - 1] ?? 0
  const peakIn = netIn.reduce((m, v) => (v > m ? v : m), 0)
  const peakOut = netOut.reduce((m, v) => (v > m ? v : m), 0)

  // Joint max for shared Y axis
  const max = Math.max(
    1,
    view === 'in' ? peakIn : view === 'out' ? peakOut : Math.max(peakIn, peakOut),
  )

  const w = 800
  const h = isMobile ? 140 : 180
  const pad = { l: 0, r: 0, t: 8, b: 18 }

  const showIn = view === 'in' || view === 'both'
  const showOut = view === 'out' || view === 'both'

  return (
    <div className="precision-card" style={{ padding: '14px 18px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <Etch>{title} (IN / OUT)</Etch>
          <SerialPlate>{serial}</SerialPlate>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: contentFs(9),
              color: 'var(--fg-3)',
              letterSpacing: '0.08em',
            }}
          >
            {windowLabel}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {timeWindow !== undefined && onTimeWindowChange && (
            <TimeWindowSwitcher
              value={timeWindow}
              onChange={onTimeWindowChange}
            />
          )}
          <div
            style={{
              display: 'inline-flex',
              background: 'var(--bg-inset)',
              border: '1px solid var(--edge-engrave)',
              borderRadius: 4,
              padding: 2,
              boxShadow: 'inset 0 1px 0 var(--edge-deep)',
            }}
          >
            {(['in', 'out', 'both'] as ThroughputView[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                style={{
                  padding: '3px 9px',
                  background: view === v ? 'var(--bg-2)' : 'transparent',
                  border: 'none',
                  borderRadius: 2,
                  fontFamily: 'var(--font-mono)',
                  fontSize: contentFs(9),
                  letterSpacing: '0.12em',
                  color: view === v ? 'var(--accent-bright)' : 'var(--fg-3)',
                  cursor: 'pointer',
                  fontWeight: view === v ? 500 : 400,
                }}
              >
                {v.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 14,
          flexDirection: isMobile ? 'column' : 'row',
        }}
      >
        {/* Chart */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <svg
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="none"
            style={{ width: '100%', height: h, display: 'block' }}
          >
            <defs>
              <linearGradient id="rxFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--signal-good)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--signal-good)" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="txFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
              <pattern id="thGrid" width={w / 6} height={h / 4} patternUnits="userSpaceOnUse">
                <path
                  d={`M ${w / 6} 0 L 0 0 0 ${h / 4}`}
                  fill="none"
                  stroke="var(--edge-engrave)"
                  strokeWidth="0.5"
                  opacity="0.45"
                />
              </pattern>
            </defs>

            <rect x={pad.l} y={pad.t} width={w - pad.l - pad.r} height={h - pad.t - pad.b} fill="url(#thGrid)" />

            {/* Inbound (RX) — green */}
            {showIn && netIn.length > 0 && (
              <>
                <path d={buildAreaPath(netIn, w, h, max, pad)} fill="url(#rxFill)" />
                <path
                  d={buildLinePath(netIn, w, h, max, pad)}
                  fill="none"
                  stroke="var(--signal-good)"
                  strokeWidth="1.4"
                />
              </>
            )}

            {/* Outbound (TX) — accent */}
            {showOut && netOut.length > 0 && (
              <>
                <path d={buildAreaPath(netOut, w, h, max, pad)} fill="url(#txFill)" />
                <path
                  d={buildLinePath(netOut, w, h, max, pad)}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="1.4"
                />
              </>
            )}

            {/* X axis labels — adapt to the current time window */}
            {[0, 0.25, 0.5, 0.75, 1].map((t) => {
              const x = pad.l + t * (w - pad.l - pad.r)
              const windowHours = timeWindow ?? 24
              const hoursAgo = (1 - t) * windowHours
              let label: string
              if (hoursAgo < 0.01) {
                label = 'now'
              } else if (windowHours <= 24) {
                label = `-${Math.round(hoursAgo)}h`
              } else if (windowHours <= 168) {
                label = `-${(hoursAgo / 24).toFixed(0)}d`
              } else {
                label = `-${(hoursAgo / 24).toFixed(0)}d`
              }
              return (
                <text
                  key={t}
                  x={x}
                  y={h - 4}
                  textAnchor={t === 0 ? 'start' : t === 1 ? 'end' : 'middle'}
                  fontFamily="var(--font-mono)"
                  fontSize="9"
                  fill="var(--fg-3)"
                  letterSpacing="0.08em"
                >
                  {label}
                </text>
              )
            })}
          </svg>
        </div>

        {/* Side readout */}
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'row' : 'column',
            gap: 12,
            minWidth: isMobile ? 0 : 110,
            justifyContent: isMobile ? 'space-around' : 'center',
            paddingLeft: isMobile ? 0 : 8,
            borderLeft: isMobile ? 'none' : '1px solid var(--edge-engrave)',
          }}
        >
          {showIn && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  marginBottom: 2,
                }}
              >
                <span style={{ width: 8, height: 8, background: 'var(--signal-good)', borderRadius: '50%' }} />
                <Etch>INBOUND</Etch>
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: contentFs(14),
                  color: 'var(--fg-0)',
                  fontWeight: 500,
                }}
              >
                {totalIn !== undefined ? formatBytes(totalIn) : '—'}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: contentFs(9),
                  color: 'var(--fg-3)',
                  marginTop: 2,
                }}
              >
                live {formatBps(latestIn)}
              </div>
            </div>
          )}
          {showOut && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  marginBottom: 2,
                }}
              >
                <span style={{ width: 8, height: 8, background: 'var(--accent)', borderRadius: '50%' }} />
                <Etch>OUTBOUND</Etch>
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: contentFs(14),
                  color: 'var(--fg-0)',
                  fontWeight: 500,
                }}
              >
                {totalOut !== undefined ? formatBytes(totalOut) : '—'}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: contentFs(9),
                  color: 'var(--fg-3)',
                  marginTop: 2,
                }}
              >
                live {formatBps(latestOut)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
