/**
 * AttentionNeededTable — table of nodes that most need operator attention.
 *
 *  NODE              STATUS    ISSUE                  IMPACT      LAST SEEN
 *  ─────────────────────────────────────────────────────────────────────────
 *  ● 深圳无忧佛山     online    高延迟 & 丢包率         ▓▓▓▓▓ High  09:42
 *  ● 上海腾讯         online    带宽利用率 95%+         ▓▓▓▓░ High  09:41
 *  ● 深港HEPIX        online    CPU 使用率高           ▓▓▓░░ Med   09:40
 *  ● 香港HKT KAZE     online    负载持续偏高           ▓▓▓░░ Med   09:39
 *  ● 广州腾讯         online    —                      ▓░░░░ Low   09:39
 *
 * Driven by useAttentionNeeded().
 *
 * Clicking a row opens that node in NodeDetailDrawer (via onNodeClick prop).
 */

import type { AttentionItem } from '@/hooks/v2'
import { Etch } from '@/components/atoms/Etch'
import { SerialPlate } from '@/components/atoms/SerialPlate'
import { contentFs } from '@/utils/fontScale'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { PanelFooterLink } from './PanelFooterLink'

interface Props {
  items: AttentionItem[]
  title?: string
  serial?: string
  /** Click handler for a row — typically opens a detail drawer */
  onNodeClick?: (uuid: string) => void
  /** Optional footer "View All →" link config */
  footerLink?: { label: string; href?: string; onClick?: () => void }
}

/** Render the IMPACT column as a 5-block bar based on severity score. */
function ImpactBar({ score }: { score: number }) {
  // map score to 1-5 blocks
  const filled = score >= 80 ? 5 : score >= 50 ? 4 : score >= 30 ? 3 : score >= 15 ? 2 : 1
  const color = filled >= 4 ? 'var(--signal-bad)' : filled >= 3 ? 'var(--signal-warn)' : 'var(--accent)'

  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 8,
            height: 8,
            background: i < filled ? color : 'var(--bg-inset)',
            border: '1px solid var(--edge-engrave)',
            borderRadius: 1,
            boxShadow: i < filled ? `0 0 2px ${color}` : 'inset 0 1px 1px var(--edge-deep)',
          }}
        />
      ))}
    </div>
  )
}

function severityLabel(score: number): string {
  if (score >= 80) return 'CRITICAL'
  if (score >= 50) return 'HIGH'
  if (score >= 30) return 'MED'
  if (score >= 15) return 'LOW'
  return 'INFO'
}

function fmtTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

export function AttentionNeededTable({
  items,
  title = 'ATTENTION NEEDED · TOP 5 NODES',
  serial = 'A01',
  onNodeClick,
  footerLink,
}: Props) {
  const isMobile = useIsMobile()

  return (
    <div
      className="precision-card"
      style={{
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
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

      {items.length === 0 ? (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: contentFs(11),
            color: 'var(--fg-3)',
            padding: '12px 0',
            textAlign: 'center',
          }}
        >
          ✓ All nodes nominal — no attention required.
        </div>
      ) : (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontFamily: 'var(--font-mono)',
            fontVariantNumeric: 'tabular-nums',
            fontSize: contentFs(11),
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  padding: '6px 8px 6px 0',
                  fontFamily: 'var(--font-mono)',
                  fontSize: contentFs(9),
                  letterSpacing: '0.14em',
                  color: 'var(--fg-3)',
                  fontWeight: 500,
                  borderBottom: '1px solid var(--edge-engrave)',
                }}
              >
                NODE
              </th>
              {!isMobile && (
                <th
                  style={{
                    textAlign: 'left',
                    padding: '6px 8px',
                    fontSize: contentFs(9),
                    letterSpacing: '0.14em',
                    color: 'var(--fg-3)',
                    fontWeight: 500,
                    borderBottom: '1px solid var(--edge-engrave)',
                    width: 70,
                  }}
                >
                  STATUS
                </th>
              )}
              <th
                style={{
                  textAlign: 'left',
                  padding: '6px 8px',
                  fontSize: contentFs(9),
                  letterSpacing: '0.14em',
                  color: 'var(--fg-3)',
                  fontWeight: 500,
                  borderBottom: '1px solid var(--edge-engrave)',
                }}
              >
                ISSUE
              </th>
              <th
                style={{
                  textAlign: 'left',
                  padding: '6px 8px',
                  fontSize: contentFs(9),
                  letterSpacing: '0.14em',
                  color: 'var(--fg-3)',
                  fontWeight: 500,
                  borderBottom: '1px solid var(--edge-engrave)',
                  width: 110,
                }}
              >
                IMPACT
              </th>
              {!isMobile && (
                <th
                  style={{
                    textAlign: 'right',
                    padding: '6px 0 6px 8px',
                    fontSize: contentFs(9),
                    letterSpacing: '0.14em',
                    color: 'var(--fg-3)',
                    fontWeight: 500,
                    borderBottom: '1px solid var(--edge-engrave)',
                    width: 60,
                  }}
                >
                  LAST SEEN
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const isOnline = !!it.record?.online
              const sevColor =
                it.severity === 'critical'
                  ? 'var(--signal-bad)'
                  : it.severity === 'warning'
                    ? 'var(--signal-warn)'
                    : 'var(--accent)'
              return (
                <tr
                  key={it.node.uuid}
                  onClick={onNodeClick ? () => onNodeClick(it.node.uuid) : undefined}
                  style={{
                    cursor: onNodeClick ? 'pointer' : 'default',
                    borderBottom: '1px solid var(--edge-engrave)',
                  }}
                  onMouseEnter={(e) => {
                    if (onNodeClick) (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(160,104,32,0.04)'
                  }}
                  onMouseLeave={(e) => {
                    if (onNodeClick) (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'
                  }}
                >
                  <td style={{ padding: '8px 8px 8px 0', whiteSpace: 'nowrap' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 6,
                        height: 6,
                        marginRight: 7,
                        borderRadius: '50%',
                        background: sevColor,
                        verticalAlign: 'middle',
                      }}
                    />
                    <span
                      style={{
                        color: 'var(--fg-0)',
                        fontWeight: 500,
                        fontFamily: 'var(--font-sans)',
                        fontSize: contentFs(12),
                      }}
                    >
                      {it.node.name ?? it.node.uuid.slice(0, 8)}
                    </span>
                  </td>
                  {!isMobile && (
                    <td
                      style={{
                        padding: '8px',
                        color: isOnline ? 'var(--signal-good)' : 'var(--signal-bad)',
                        fontSize: contentFs(10),
                        letterSpacing: '0.08em',
                      }}
                    >
                      {isOnline ? 'online' : 'offline'}
                    </td>
                  )}
                  <td
                    style={{
                      padding: '8px',
                      color: 'var(--fg-1)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 240,
                    }}
                    title={it.reasons.join(' · ')}
                  >
                    {it.reasons[0] ?? '—'}
                    {it.reasons.length > 1 && (
                      <span style={{ color: 'var(--fg-3)' }}> +{it.reasons.length - 1}</span>
                    )}
                  </td>
                  <td style={{ padding: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ImpactBar score={it.score} />
                      <span style={{ color: sevColor, fontSize: contentFs(10), letterSpacing: '0.08em' }}>
                        {severityLabel(it.score)}
                      </span>
                    </div>
                  </td>
                  {!isMobile && (
                    <td
                      style={{
                        padding: '8px 0 8px 8px',
                        textAlign: 'right',
                        color: 'var(--fg-2)',
                      }}
                    >
                      {fmtTime(it.lastSeenISO)}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {footerLink && (
        <PanelFooterLink
          label={footerLink.label}
          href={footerLink.href}
          onClick={footerLink.onClick}
        />
      )}
    </div>
  )
}
