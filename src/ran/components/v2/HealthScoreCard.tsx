/**
 * HealthScoreCard — large card showing the cluster's overall health score.
 *
 *   CLUSTER HEALTH SCORE          [H01]
 *   87 /100         GOOD
 *   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *   ↑ 6 pts vs yesterday
 *
 * Score color follows the grade:
 *   excellent → good green
 *   good      → accent
 *   fair      → warn
 *   poor      → bad
 *
 * If `yesterdayScore` is provided, shows the delta in the footer with
 * an up/down arrow.
 *
 * The progress bar at the bottom is a 0-100 visualization of the score
 * itself — a quick "fullness" cue that complements the number.
 */

import type { ClusterHealth } from '@/hooks/v2'
import { Etch } from '@/components/atoms/Etch'
import { SerialPlate } from '@/components/atoms/SerialPlate'
import { contentFs } from '@/utils/fontScale'

interface Props {
  health: ClusterHealth
  /** Score 24h ago, used for the delta footer */
  yesterdayScore?: number
  /** Optional serial label (default "H01") */
  serial?: string
}

const GRADE_COLOR: Record<ClusterHealth['grade'], string> = {
  excellent: 'var(--signal-good)',
  good: 'var(--accent)',
  fair: 'var(--signal-warn)',
  poor: 'var(--signal-bad)',
}

const GRADE_LABEL: Record<ClusterHealth['grade'], string> = {
  excellent: 'EXCELLENT',
  good: 'GOOD',
  fair: 'FAIR',
  poor: 'POOR',
}

export function HealthScoreCard({
  health,
  yesterdayScore,
  serial = 'H01',
}: Props) {
  const color = GRADE_COLOR[health.grade]
  const delta =
    typeof yesterdayScore === 'number' ? health.score - yesterdayScore : undefined

  return (
    <div
      className="precision-card"
      style={{
        padding: '14px 18px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* head */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Etch>CLUSTER HEALTH SCORE</Etch>
        <SerialPlate>{serial}</SerialPlate>
      </div>

      {/* score + grade */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontVariantNumeric: 'tabular-nums',
              fontSize: contentFs(36),
              fontWeight: 500,
              lineHeight: 1,
              letterSpacing: '-0.02em',
              color,
            }}
          >
            {health.score}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: contentFs(14),
              color: 'var(--fg-2)',
            }}
          >
            /100
          </span>
        </div>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: contentFs(11),
            letterSpacing: '0.16em',
            fontWeight: 600,
            color,
          }}
        >
          {GRADE_LABEL[health.grade]}
        </span>
      </div>

      {/* progress bar — score as fill width */}
      <div
        style={{
          height: 4,
          background: 'var(--bg-inset)',
          border: '1px solid var(--edge-engrave)',
          borderRadius: 1,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: 'inset 0 1px 1px var(--edge-deep)',
          marginTop: 2,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${health.score}%`,
            background: color,
            boxShadow: `0 0 4px ${color}`,
            transition: 'width 0.4s ease',
          }}
        />
      </div>

      {/* delta footer */}
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: contentFs(10),
          color: 'var(--fg-3)',
          letterSpacing: '0.06em',
          marginTop: 2,
        }}
      >
        {typeof delta === 'number' ? (
          <>
            <span
              style={{
                color:
                  delta > 0
                    ? 'var(--signal-good)'
                    : delta < 0
                      ? 'var(--signal-bad)'
                      : 'var(--fg-3)',
                fontWeight: 500,
              }}
            >
              {delta > 0 ? '↑' : delta < 0 ? '↓' : '·'} {Math.abs(delta)} pts
            </span>{' '}
            vs yesterday
          </>
        ) : (
          <span style={{ opacity: 0.6 }}>collecting trend data…</span>
        )}
      </div>
    </div>
  )
}
