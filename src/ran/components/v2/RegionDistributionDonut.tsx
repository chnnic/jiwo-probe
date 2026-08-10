/**
 * RegionDistributionDonut — multi-slice donut chart showing region split,
 * plus a labeled legend to the right.
 *
 * Layout:
 *   ╭───╮   深圳   8  (44.4%)
 *   │ 5 │   香港   3  (16.7%)
 *   ╰───╯   ...
 *
 * Geometry: each slice is rendered as a stroked SVG arc using
 * stroke-dasharray. Stroke caps are butt (default) so adjacent slices butt
 * up cleanly with no rounding at boundaries.
 */

import type { RegionSlice } from '@/hooks/v2'
import { Etch } from '@/components/atoms/Etch'
import { SerialPlate } from '@/components/atoms/SerialPlate'
import { contentFs } from '@/utils/fontScale'
import { useIsMobile } from '@/hooks/useMediaQuery'

interface Props {
  slices: RegionSlice[]
  /** Header title (default "REGION DISTRIBUTION") */
  title?: string
  /** Serial code (default "R01") */
  serial?: string
  /** Donut size in px (default 120) */
  size?: number
}

export function RegionDistributionDonut({
  slices,
  title = 'REGION DISTRIBUTION',
  serial = 'R01',
  size = 120,
}: Props) {
  const isMobile = useIsMobile()
  const total = slices.reduce((s, x) => s + x.count, 0)

  const thickness = 14
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r

  // Pre-compute dash offsets so slices butt against each other in order.
  let cumulative = 0
  const segments = slices.map((slc) => {
    const length = slc.ratio * c
    const offset = -cumulative
    cumulative += length
    return { ...slc, length, offset }
  })

  return (
    <div className="precision-card" style={{ padding: '14px 18px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <Etch>{title}</Etch>
        <SerialPlate>{serial}</SerialPlate>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: 'center',
          gap: isMobile ? 12 : 18,
        }}
      >
        {/* Donut */}
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {/* Track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="var(--bg-inset)"
              strokeWidth={thickness}
            />
            {/* Slices */}
            {segments.map((seg, i) => (
              <circle
                key={seg.name + i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={thickness}
                strokeDasharray={`${seg.length} ${c - seg.length}`}
                strokeDashoffset={seg.offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            ))}
          </svg>
          {/* Center */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontVariantNumeric: 'tabular-nums',
                fontSize: contentFs(28),
                fontWeight: 500,
                color: 'var(--fg-0)',
                letterSpacing: '-0.02em',
                lineHeight: 1,
              }}
            >
              {total}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: contentFs(8.5),
                letterSpacing: '0.14em',
                color: 'var(--fg-3)',
              }}
            >
              NODES
            </span>
          </div>
        </div>

        {/* Legend */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
            minWidth: 0,
            width: isMobile ? '100%' : 'auto',
          }}
        >
          {segments.map((seg) => (
            <div
              key={seg.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontFamily: 'var(--font-mono)',
                fontSize: contentFs(11),
              }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  background: seg.color,
                  borderRadius: 1,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  flex: 1,
                  color: 'var(--fg-1)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {seg.name}
              </span>
              <span
                style={{
                  color: 'var(--fg-0)',
                  fontWeight: 500,
                  fontVariantNumeric: 'tabular-nums',
                  minWidth: 22,
                  textAlign: 'right',
                }}
              >
                {seg.count}
              </span>
              <span
                style={{
                  color: 'var(--fg-3)',
                  fontSize: contentFs(10),
                  minWidth: 48,
                  textAlign: 'right',
                }}
              >
                ({(seg.ratio * 100).toFixed(1)}%)
              </span>
            </div>
          ))}
          {slices.length === 0 && (
            <div
              style={{
                color: 'var(--fg-3)',
                fontFamily: 'var(--font-mono)',
                fontSize: contentFs(11),
              }}
            >
              No region data
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
