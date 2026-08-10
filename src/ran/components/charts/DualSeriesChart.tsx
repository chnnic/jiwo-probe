import { memo } from 'react'
import { useCallback } from 'react'
import { useElementWidth } from '@/hooks/useElementWidth'
import {
  ChartTooltipOverlay,
  formatTipTime,
  useChartTooltip,
  type TooltipPoint,
} from './ChartTooltip'

interface SeriesIn {
  data: number[]
  label?: string
  color: string
  /** Unique gradient id (avoid clashes when multiple charts on same page). */
  formatGradId: string
}

interface Props {
  series: SeriesIn[]
  width?: number
  height?: number
  yMin?: number
  yMax: number
  times?: number[]
  /** Optional fixed time domain; positions partial history inside the selected window. */
  xDomain?: readonly [number, number]
  /** Tooltip value formatter; defaults to bytes-short style. */
  formatValue?: (v: number) => string
  /** Y-axis label formatter; defaults to bytes-short style. */
  formatY?: (v: number) => string
}

function bytesShort(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0'
  const units = ['B', 'K', 'M', 'G', 'T']
  const idx = Math.min(Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024)), units.length - 1)
  const v = bytes / Math.pow(1024, idx)
  return `${v.toFixed(idx === 0 ? 0 : 1)}${units[idx]}`
}

/**
 * DualSeriesChart — area-fill chart with N overlaid series sharing one Y-axis,
 * a shared hover tooltip that picks the closest series at the cursor's X.
 *
 * Used for "↑ TX / ↓ RX" style network charts where you need both lines visible
 * but with a single, accurate tooltip (not the broken stacked-AreaChart trick).
 */
function DualSeriesChart_({
  series,
  width: initialWidth = 400,
  height = 150,
  yMin = 0,
  yMax,
  times,
  xDomain,
  formatValue,
  formatY,
}: Props) {
  const [wrapRef, w] = useElementWidth<HTMLDivElement>(initialWidth)

  const pad = { top: 12, right: 36, bottom: 18, left: 8 }
  const innerW = Math.max(0, w - pad.left - pad.right)
  const innerH = height - pad.top - pad.bottom
  const range = yMax - yMin || 1
  const len = series[0]?.data.length ?? 0
  const stepX = len > 1 ? innerW / (len - 1) : 0
  const useTimedX =
    Boolean(xDomain) &&
    xDomain![1] > xDomain![0] &&
    times?.length === len &&
    times.every(Number.isFinite)
  const pointXs = Array.from({ length: len }, (_, i) => {
    if (!useTimedX) return pad.left + i * stepX
    const fraction = (times![i] - xDomain![0]) / (xDomain![1] - xDomain![0])
    return pad.left + Math.max(0, Math.min(1, fraction)) * innerW
  })

  const fmtV = formatValue ?? ((v: number) => `${bytesShort(v)}/s`)
  const fmtY = formatY ?? bytesShort

  const resolve = useCallback(
    (svgX: number, svgY: number): TooltipPoint | null => {
      if (len === 0) return null
      let idx = 0
      let bestDx = Infinity
      for (let i = 0; i < pointXs.length; i++) {
        const dx = Math.abs(svgX - pointXs[i])
        if (dx < bestDx) {
          bestDx = dx
          idx = i
        }
      }
      const cx = pointXs[idx]
      // pick series whose Y is closest to cursor
      let bestSi = 0
      let bestDy = Infinity
      let bestY = pad.top + innerH
      let bestV = 0
      for (let si = 0; si < series.length; si++) {
        const v = series[si].data[idx] ?? 0
        const y =
          pad.top + innerH - ((Math.max(yMin, Math.min(yMax, v)) - yMin) / range) * innerH
        const dy = Math.abs(svgY - y)
        if (dy < bestDy) {
          bestDy = dy
          bestSi = si
          bestY = y
          bestV = v
        }
      }
      const s = series[bestSi]
      const t = times?.[idx]
      return {
        cx,
        cy: bestY,
        color: s.color,
        valueText: `${fmtV(bestV)}${s.label ? ` · ${s.label}` : ''}`,
        subText: t ? formatTipTime(t) : undefined,
      }
    },
    [len, pointXs, pad.top, innerH, yMin, yMax, range, series, times, fmtV],
  )

  const tooltip = useChartTooltip({
    width: w,
    height,
    innerLeft: pad.left,
    innerRight: pad.left + innerW,
    innerTop: pad.top,
    innerBottom: pad.top + innerH,
    resolve,
  })

  const setRefs = (el: HTMLDivElement | null) => {
    ;(wrapRef as { current: HTMLDivElement | null }).current = el
    ;(tooltip.wrapRef as { current: HTMLDivElement | null }).current = el
  }

  if (len === 0) {
    return (
      <div
        ref={wrapRef}
        style={{
          width: '100%',
          height,
          background: 'var(--bg-inset)',
          border: '1px solid var(--edge-engrave)',
          borderRadius: 2,
        }}
      />
    )
  }

  // Pre-compute paths for each series.
  const paths = series.map((s) => {
    const pts = s.data.map(
      (d, i) =>
        [
          pointXs[i],
          pad.top +
            innerH -
            ((Math.max(yMin, Math.min(yMax, d)) - yMin) / range) * innerH,
        ] as [number, number],
    )
    const line = pts
      .map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`))
      .join(' ')
    const fill = `${line} L${pts[pts.length - 1][0]},${pad.top + innerH} L${pts[0][0]},${pad.top + innerH} Z`
    return { line, fill, last: pts[pts.length - 1], color: s.color, gradId: s.formatGradId }
  })

  return (
    <div
      ref={setRefs}
      onMouseMove={tooltip.bind.onMouseMove}
      onMouseLeave={tooltip.bind.onMouseLeave}
      style={{ width: '100%', height, position: 'relative', cursor: 'crosshair' }}
    >
      <svg width={w} height={height} style={{ display: 'block' }}>
        {/* horizontal grid */}
        {Array.from({ length: 5 }, (_, i) => {
          const y = pad.top + (i / 4) * innerH
          const isEdge = i === 0 || i === 4
          return (
            <line
              key={`gy${i}`}
              x1={pad.left}
              x2={pad.left + innerW}
              y1={y}
              y2={y}
              stroke="var(--grid-line-strong)"
              strokeWidth={1}
              strokeDasharray={isEdge ? '0' : '2 3'}
              opacity={isEdge ? 1 : 0.6}
            />
          )
        })}
        {/* vertical grid */}
        {Array.from({ length: 7 }, (_, i) => (
          <line
            key={`gx${i}`}
            x1={pad.left + (i / 6) * innerW}
            x2={pad.left + (i / 6) * innerW}
            y1={pad.top}
            y2={pad.top + innerH}
            stroke="var(--grid-line)"
            strokeWidth={1}
          />
        ))}
        {/* gradients */}
        <defs>
          {paths.map((p) => (
            <linearGradient key={p.gradId} id={p.gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={p.color} stopOpacity="0.32" />
              <stop offset="100%" stopColor={p.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {/* fills first (back) */}
        {paths.map((p, i) => (
          <path key={`f${i}`} d={p.fill} fill={`url(#${p.gradId})`} />
        ))}
        {/* lines (front) */}
        {paths.map((p, i) => (
          <path
            key={`l${i}`}
            d={p.line}
            stroke={p.color}
            strokeWidth={1.4}
            fill="none"
            strokeLinejoin="round"
          />
        ))}
        {/* current dots */}
        {paths.map((p, i) => (
          <circle key={`d${i}`} cx={p.last[0]} cy={p.last[1]} r={2.5} fill={p.color} />
        ))}
        {/* y-axis labels */}
        {Array.from({ length: 5 }, (_, i) => {
          const v = yMax - (i / 4) * range
          const y = pad.top + (i / 4) * innerH
          return (
            <text
              key={`yt${i}`}
              x={pad.left + innerW + 5}
              y={y + 3}
              fontSize="9"
              fill="var(--fg-3)"
              fontFamily="var(--font-mono)"
              letterSpacing="0.1em"
            >
              {fmtY(v)}
            </text>
          )
        })}
      </svg>
      <ChartTooltipOverlay hover={tooltip.hover} width={w} height={height} />
    </div>
  )
}

export const DualSeriesChart = memo(DualSeriesChart_)
