/**
 * HealthTrend7DChart — 7-day health score trend line.
 *
 *   HEALTH TREND (7D)               [H02]
 *
 *   100 ─────────────────────────
 *    75 ─────●──●─●──●──●──●─●──●
 *    50 ─────────────────────────
 *    25 ─────────────────────────
 *
 *   May 9 · 10 · 11 · 12 · 13 · 14 · Today
 *
 * Driven by useHealthTrend(). When no data is collected yet, shows a
 * "collecting" placeholder.
 */

import { useLayoutEffect, useRef, useState } from 'react'
import type { TrendPoint } from '@/hooks/v2'
import { Etch } from '@/components/atoms/Etch'
import { SerialPlate } from '@/components/atoms/SerialPlate'
import { contentFs } from '@/utils/fontScale'
import { useIsMobile } from '@/hooks/useMediaQuery'

interface Props {
  points: TrendPoint[]
  /** Current score (used for the right-side big number) */
  currentScore?: number
  title?: string
  serial?: string
  /** Days window (default 7) */
  days?: number
}

export function HealthTrend7DChart({
  points,
  currentScore,
  title = 'HEALTH TREND (7D)',
  serial = 'H02',
  days = 7,
}: Props) {
  const isMobile = useIsMobile()

  // Measure container width so the SVG viewBox matches real pixel width.
  // The previous fixed viewBox (w=700) + preserveAspectRatio="none" caused
  // text labels (axis ticks, "0/25/50/75/100" rail) to be horizontally
  // squashed by 2-3x on the small dashboard card, rendering them as
  // unreadable vertical streaks. With a 1:1 viewBox-to-pixel mapping and
  // default aspect ratio, text glyphs render at their natural width.
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(700)
  useLayoutEffect(() => {
    if (!wrapperRef.current) return
    const el = wrapperRef.current
    // Synchronous initial measure before first paint, prevents a flash of
    // mis-scaled labels on the first frame.
    const initial = el.getBoundingClientRect().width
    if (initial > 0) setW(initial)
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width && width > 0) setW(width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const h = isMobile ? 110 : 140
  const pad = { l: 28, r: 14, t: 10, b: 22 }

  // Hovered point index (null when none); drives tooltip + dot emphasis.
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  // Window: [now - days, now]
  const now = Date.now()
  const windowStart = now - days * 24 * 60 * 60 * 1000
  const visible = points.filter((p) => p.t >= windowStart)

  const xFor = (t: number) => {
    const ratio = (t - windowStart) / (now - windowStart)
    return pad.l + ratio * (w - pad.l - pad.r)
  }
  const yFor = (score: number) => {
    return pad.t + (1 - score / 100) * (h - pad.t - pad.b)
  }

  // Build polyline
  const polylinePts = visible
    .map((p) => `${xFor(p.t).toFixed(1)},${yFor(p.score).toFixed(1)}`)
    .join(' ')

  // First / last delta
  const first = visible[0]
  const last = visible[visible.length - 1]
  const delta = first && last ? last.score - first.score : undefined

  return (
    <div className="precision-card" style={{ padding: '14px 18px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <Etch>{title}</Etch>
        <SerialPlate>{serial}</SerialPlate>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 16,
          flexDirection: isMobile ? 'column' : 'row',
        }}
      >
        <div ref={wrapperRef} style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <svg
            viewBox={`0 0 ${w} ${h}`}
            style={{ width: '100%', height: h, display: 'block' }}
          >
            {/* Horizontal grid lines — reduced to 0/50/100 only for legibility
                in narrow dashboard column. The full 0/25/50/75/100 rail was
                visually noisy and the intermediate labels added little. */}
            {[0, 50, 100].map((s) => (
              <g key={s}>
                <line
                  x1={pad.l}
                  y1={yFor(s)}
                  x2={w - pad.r}
                  y2={yFor(s)}
                  stroke="var(--edge-engrave)"
                  strokeWidth="0.5"
                  opacity={s === 0 || s === 100 ? 0.6 : 0.3}
                  strokeDasharray={s === 50 ? '2,3' : undefined}
                />
                <text
                  x={pad.l - 6}
                  y={yFor(s) + 3}
                  textAnchor="end"
                  fontFamily="var(--font-mono)"
                  fontSize="9"
                  fill="var(--fg-3)"
                  letterSpacing="0.08em"
                >
                  {s}
                </text>
              </g>
            ))}

            {visible.length >= 3 ? (
              <>
                <polyline
                  points={polylinePts}
                  fill="none"
                  stroke="var(--signal-good)"
                  strokeWidth="1.6"
                />
                {/* Data dots (visual) */}
                {visible.map((p, i) => (
                  <circle
                    key={`dot-${i}`}
                    cx={xFor(p.t)}
                    cy={yFor(p.score)}
                    r={hoverIdx === i ? 4 : 2.5}
                    fill="var(--signal-good)"
                    stroke={hoverIdx === i ? 'var(--bg-1)' : undefined}
                    strokeWidth={hoverIdx === i ? 1.5 : undefined}
                    style={{ transition: 'r 0.1s ease' }}
                  />
                ))}
                {/* Invisible hit areas — wider than dots so hover is easy */}
                {visible.map((p, i) => (
                  <circle
                    key={`hit-${i}`}
                    cx={xFor(p.t)}
                    cy={yFor(p.score)}
                    r={Math.max(10, ((w - pad.l - pad.r) / visible.length) / 2)}
                    fill="transparent"
                    style={{ cursor: 'crosshair' }}
                    onMouseEnter={() => setHoverIdx(i)}
                    onMouseLeave={() => setHoverIdx(null)}
                  />
                ))}
              </>
            ) : (
              // Fewer than 3 points → show a quiet "sampling…" caption
              // centered on the plot area, with a small dot to suggest
              // data is being captured. Avoid drawing a misleading
              // single line / orphan dot.
              <>
                <circle
                  cx={w / 2}
                  cy={h / 2 - 4}
                  r="3"
                  fill="var(--fg-3)"
                  opacity="0.45"
                />
                <text
                  x={w / 2}
                  y={h / 2 + 14}
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                  fontSize="10"
                  fill="var(--fg-3)"
                  letterSpacing="0.12em"
                  opacity="0.75"
                >
                  sampling 7-day trend…
                </text>
                <text
                  x={w / 2}
                  y={h / 2 + 28}
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                  fontSize="8.5"
                  fill="var(--fg-3)"
                  letterSpacing="0.06em"
                  opacity="0.55"
                >
                  {visible.length}/3 data points captured
                </text>
              </>
            )}

            {/* X axis: only the two endpoint labels (-7d / now) to keep the
                axis legible at narrow card widths. Intermediate day ticks
                pile into illegible streaks below ~400px. Per-point dates
                are surfaced via hover tooltip instead. */}
            <text
              x={pad.l}
              y={h - 5}
              textAnchor="start"
              fontFamily="var(--font-mono)"
              fontSize="9"
              fill="var(--fg-3)"
              letterSpacing="0.06em"
              opacity={visible.length >= 3 ? 0.85 : 0.35}
            >
              -{days}d
            </text>
            <text
              x={w - pad.r}
              y={h - 5}
              textAnchor="end"
              fontFamily="var(--font-mono)"
              fontSize="9"
              fill="var(--fg-3)"
              letterSpacing="0.06em"
              opacity={visible.length >= 3 ? 0.85 : 0.35}
            >
              now
            </text>
          </svg>

          {/* Hover tooltip — date + score for the focused data point. */}
          {hoverIdx !== null && visible[hoverIdx] && (() => {
            const p = visible[hoverIdx]
            // Position in SVG coordinate space → percentage along wrapper width.
            const xPctRaw = ((xFor(p.t) - pad.l) / (w - pad.l - pad.r)) * 100
            const xPct = Math.max(0, Math.min(100, xPctRaw))
            const yPct = (yFor(p.score) / h) * 100
            const pinRight = xPct > 65
            const d = new Date(p.t)
            const today = new Date()
            const isToday = d.toDateString() === today.toDateString()
            const dateLabel = isToday
              ? `today ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
              : `${d.getMonth() + 1}/${d.getDate()}`
            return (
              <div
                style={{
                  position: 'absolute',
                  left: `${xPct}%`,
                  top: `${yPct}%`,
                  transform: `translate(${pinRight ? 'calc(-100% - 10px)' : '10px'}, calc(-50% - 4px))`,
                  pointerEvents: 'none',
                  background: 'var(--bg-1, #2d2823)',
                  color: 'var(--fg-0)',
                  padding: '5px 8px',
                  borderRadius: 2,
                  border: '1px solid var(--edge-engrave)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: contentFs(10),
                  letterSpacing: '0.04em',
                  whiteSpace: 'nowrap',
                  zIndex: 10,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                }}
              >
                <div style={{ color: 'var(--fg-3)', fontSize: contentFs(9), marginBottom: 2 }}>
                  {dateLabel}
                </div>
                <div style={{ fontWeight: 500 }}>
                  <span style={{ color: 'var(--signal-good)' }}>{p.score}</span>
                  <span style={{ color: 'var(--fg-3)' }}> / 100</span>
                </div>
              </div>
            )
          })()}
        </div>

        {/* Right readout */}
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'row' : 'column',
            gap: 4,
            minWidth: isMobile ? 0 : 110,
            paddingLeft: isMobile ? 0 : 8,
            borderLeft: isMobile ? 'none' : '1px solid var(--edge-engrave)',
            justifyContent: isMobile ? 'space-between' : 'center',
            alignItems: isMobile ? 'baseline' : 'flex-end',
          }}
        >
          {typeof currentScore === 'number' && (
            <div>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: contentFs(32),
                  color: 'var(--fg-0)',
                  fontWeight: 500,
                  letterSpacing: '-0.02em',
                }}
              >
                {currentScore}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: contentFs(12),
                  color: 'var(--fg-2)',
                }}
              >
                /100
              </span>
            </div>
          )}
          {typeof delta === 'number' && visible.length >= 3 ? (
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: contentFs(10),
                color:
                  delta > 0 ? 'var(--signal-good)' : delta < 0 ? 'var(--signal-bad)' : 'var(--fg-3)',
                letterSpacing: '0.06em',
              }}
            >
              <span style={{ fontWeight: 500 }}>
                {delta > 0 ? '↑' : delta < 0 ? '↓' : '·'} {Math.abs(delta)} pts
              </span>{' '}
              <span style={{ color: 'var(--fg-3)' }}>vs {days}d ago</span>
            </div>
          ) : (
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: contentFs(10),
                color: 'var(--fg-3)',
                letterSpacing: '0.06em',
                opacity: 0.7,
              }}
            >
              sampling…
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
