/**
 * Specialized top-row summary cards — each composes SummaryStatCard with a
 * specific visual:
 *
 *   ActiveAlertsCard       — total alerts + breakdown subline + mini bar of 24h alert volume
 *   ThroughputSummaryCard  — big total bytes + sparkline + vs-yesterday delta
 *   AvgPacketLossCard      — loss % + sparkline + vs-yesterday
 *   ExpiringSoonCard       — count + donut visual + "View Details" link
 */

import type { AlertSummary, AggregateStats } from '@/hooks/v2'
import { SummaryStatCard } from './SummaryStatCard'
import { Sparkline } from '@/components/charts/Sparkline'
import { contentFs } from '@/utils/fontScale'
import { formatBytes } from '@/utils/format'

/**
 * EmptySpark — shown in place of a Sparkline when there aren't yet
 * enough data points (<2) to draw a line. Renders a single dim dot
 * with a "sampling…" caption so the card still has visual weight on
 * the right side, but doesn't pretend to have data.
 */
function EmptySpark({ color = 'var(--fg-3)' }: { color?: string }) {
  return (
    <div
      style={{
        width: 90,
        height: 36,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: color,
          opacity: 0.45,
        }}
      />
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: contentFs(8.5),
          letterSpacing: '0.1em',
          color: 'var(--fg-3)',
          opacity: 0.7,
        }}
      >
        sampling…
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// ActiveAlertsCard
// ─────────────────────────────────────────────────────────────────

interface ActiveAlertsProps {
  summary: AlertSummary
  /** Optional mini 24h alert volume series for the side mini-bar viz */
  volumeSeries?: number[]
  serial?: string
}

/**
 * Mini 24h alert volume — vertical bars colored by intensity.
 *
 * Series is 12 buckets of 2 hours each, from oldest (left) to newest
 * (right). Bar height scales with the peak alert count in each window;
 * color escalates from faint pink (low) → warn → bad as intensity
 * rises. When the entire series is 0 (e.g. first session, no alerts
 * have ever fired), bars render at their 2px baseline — a quiet
 * "all clear" pattern.
 */
function AlertVolumeBars({ series }: { series: number[] }) {
  const max = Math.max(1, ...series)
  return (
    <div
      style={{
        display: 'flex',
        gap: 1.5,
        alignItems: 'flex-end',
        height: 36,
        width: 90,
      }}
      aria-label="24h alert volume"
    >
      {series.map((v, i) => {
        const h = Math.max(2, (v / max) * 32)
        const color =
          v >= max * 0.7
            ? 'var(--signal-bad)'
            : v >= max * 0.35
              ? 'var(--signal-warn)'
              : 'rgba(168,58,48,0.35)'
        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: h,
              background: color,
              borderRadius: 0.5,
            }}
          />
        )
      })}
    </div>
  )
}

export function ActiveAlertsCard({
  summary,
  volumeSeries,
  serial = 'A01',
}: ActiveAlertsProps) {
  // Use the real 24h history. If no history has accumulated yet, the
  // series is all zeros — AlertVolumeBars renders tiny baseline bars
  // (height 2px) which read as "no alerts in this period" rather than
  // a placeholder.
  const series = volumeSeries ?? new Array(12).fill(0)

  const valueColor =
    summary.counts.critical > 0
      ? 'var(--signal-bad)'
      : summary.counts.warning > 0
        ? 'var(--signal-warn)'
        : 'var(--fg-0)'

  return (
    <SummaryStatCard
      label="ACTIVE ALERTS"
      serial={serial}
      value={summary.counts.total}
      valueColor={valueColor}
      visual={<AlertVolumeBars series={series} />}
      subline={
        <span>
          <span style={{ color: 'var(--signal-bad)' }}>
            {summary.counts.critical} Critical
          </span>
          {' · '}
          <span style={{ color: 'var(--signal-warn)' }}>
            {summary.counts.warning} Warning
          </span>
        </span>
      }
      footer={
        <a
          href="#/v2/overview"
          style={{
            display: 'inline-block',
            padding: '3px 9px',
            background: 'var(--bg-1)',
            border: '1px solid var(--edge-engrave)',
            borderRadius: 3,
            color: 'var(--fg-1)',
            textDecoration: 'none',
            fontSize: contentFs(9),
            letterSpacing: '0.14em',
            fontFamily: 'var(--font-mono)',
          }}
        >
          VIEW ALERTS
        </a>
      }
    />
  )
}

// ─────────────────────────────────────────────────────────────────
// ThroughputSummaryCard
// ─────────────────────────────────────────────────────────────────

interface ThroughputSummaryProps {
  /** Combined network total (bytes), e.g. totalNetUp + totalNetDown */
  totalBytes: number
  /** Sparkline of recent throughput */
  spark?: number[]
  /** % change vs yesterday — positive = up, negative = down */
  deltaPct?: number
  serial?: string
}

export function ThroughputSummaryCard({
  totalBytes,
  spark,
  deltaPct,
  serial = 'T01',
}: ThroughputSummaryProps) {
  const formatted = formatBytes(totalBytes, 1)
  // Split "85.4 TB" into number + unit
  const m = formatted.match(/^(.+?)\s*([A-Z]+)$/)
  const numStr = m ? m[1] : formatted
  const unitStr = m ? m[2] : ''

  return (
    <SummaryStatCard
      label="GLOBAL THROUGHPUT"
      serial={serial}
      value={numStr}
      unit={unitStr}
      visual={
        spark && spark.length > 1 ? (
          <div style={{ width: 90 }}>
            <Sparkline
              data={spark}
              color="var(--signal-good)"
              height={36}
              responsive
              thickness={1.4}
              fillOpacity={0.18}
            />
          </div>
        ) : (
          <EmptySpark color="var(--signal-good)" />
        )
      }
      footer={
        typeof deltaPct === 'number' ? (
          <span>
            <span
              style={{
                color:
                  deltaPct > 0
                    ? 'var(--signal-good)'
                    : deltaPct < 0
                      ? 'var(--signal-bad)'
                      : 'var(--fg-3)',
                fontWeight: 500,
              }}
            >
              {deltaPct > 0 ? '↑' : deltaPct < 0 ? '↓' : '·'}{' '}
              {Math.abs(deltaPct).toFixed(1)}%
            </span>{' '}
            vs yesterday
          </span>
        ) : (
          <span style={{ opacity: 0.6 }}>—</span>
        )
      }
    />
  )
}

// ─────────────────────────────────────────────────────────────────
// AvgPacketLossCard
// ─────────────────────────────────────────────────────────────────

interface AvgPacketLossProps {
  /** Average loss as a fraction 0..1 */
  avgLoss?: number
  spark?: number[]
  deltaPct?: number
  serial?: string
}

export function AvgPacketLossCard({
  avgLoss,
  spark,
  deltaPct,
  serial = 'L01',
}: AvgPacketLossProps) {
  const pct = typeof avgLoss === 'number' ? avgLoss * 100 : undefined
  const valueColor =
    typeof pct === 'number'
      ? pct > 5
        ? 'var(--signal-bad)'
        : pct > 1
          ? 'var(--signal-warn)'
          : 'var(--signal-good)'
      : 'var(--fg-0)'

  return (
    <SummaryStatCard
      label="AVG PACKET LOSS"
      serial={serial}
      value={typeof pct === 'number' ? pct.toFixed(2) : '—'}
      unit={typeof pct === 'number' ? '%' : undefined}
      valueColor={valueColor}
      visual={
        spark && spark.length > 1 ? (
          <div style={{ width: 90 }}>
            <Sparkline
              data={spark}
              color={
                typeof pct === 'number' && pct > 1
                  ? 'var(--signal-warn)'
                  : 'var(--signal-good)'
              }
              height={36}
              responsive
              thickness={1.4}
              fillOpacity={0.18}
            />
          </div>
        ) : (
          <EmptySpark
            color={
              typeof pct === 'number' && pct > 1
                ? 'var(--signal-warn)'
                : 'var(--signal-good)'
            }
          />
        )
      }
      footer={
        typeof deltaPct === 'number' ? (
          <span>
            <span
              style={{
                // For loss, DOWN is good
                color:
                  deltaPct < 0
                    ? 'var(--signal-good)'
                    : deltaPct > 0
                      ? 'var(--signal-bad)'
                      : 'var(--fg-3)',
                fontWeight: 500,
              }}
            >
              {deltaPct > 0 ? '↑' : deltaPct < 0 ? '↓' : '·'}{' '}
              {Math.abs(deltaPct).toFixed(2)}%
            </span>{' '}
            vs yesterday
          </span>
        ) : (
          <span style={{ opacity: 0.6 }}>steady</span>
        )
      }
    />
  )
}

// ─────────────────────────────────────────────────────────────────
// ExpiringSoonCard
// ─────────────────────────────────────────────────────────────────

interface ExpiringSoonProps {
  stats: AggregateStats
  /** Optional countdown threshold to show in subline (default 30) */
  withinDays?: number
  serial?: string
  onViewDetails?: () => void
}

/** Donut visual showing the ratio of expiring nodes to total. */
function MiniDonut({
  ratio,
  size = 38,
  color,
}: {
  ratio: number
  size?: number
  color: string
}) {
  const thickness = 5
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - ratio)

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--bg-inset)"
        strokeWidth={thickness}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={thickness}
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        strokeLinecap="round"
      />
    </svg>
  )
}

export function ExpiringSoonCard({
  stats,
  withinDays = 30,
  serial = 'E01',
  onViewDetails,
}: ExpiringSoonProps) {
  const ratio = stats.total > 0 ? stats.expiringSoon / stats.total : 0
  const valueColor =
    stats.expiringSoon > 0 ? 'var(--accent-bright)' : 'var(--fg-0)'

  return (
    <SummaryStatCard
      label="EXPIRING SOON"
      serial={serial}
      value={stats.expiringSoon}
      valueColor={valueColor}
      subline={
        <span>
          Within{' '}
          <span style={{ color: 'var(--fg-1)', fontWeight: 500 }}>
            {withinDays}d
          </span>{' '}
          window
        </span>
      }
      visual={<MiniDonut ratio={ratio} color="var(--accent-bright)" />}
      footer={
        onViewDetails ? (
          <button
            type="button"
            onClick={onViewDetails}
            style={{
              padding: '3px 9px',
              background: 'var(--bg-1)',
              border: '1px solid var(--edge-engrave)',
              borderRadius: 3,
              color: 'var(--fg-1)',
              fontSize: contentFs(9),
              letterSpacing: '0.14em',
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
            }}
          >
            VIEW DETAILS
          </button>
        ) : (
          <a
            href="#/billing"
            style={{
              display: 'inline-block',
              padding: '3px 9px',
              background: 'var(--bg-1)',
              border: '1px solid var(--edge-engrave)',
              borderRadius: 3,
              color: 'var(--fg-1)',
              textDecoration: 'none',
              fontSize: contentFs(9),
              letterSpacing: '0.14em',
              fontFamily: 'var(--font-mono)',
            }}
          >
            VIEW DETAILS
          </a>
        )
      }
    />
  )
}
