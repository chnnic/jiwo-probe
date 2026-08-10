/**
 * AlertSummaryPanel — full panel showing alert counts + a list of recent alerts.
 *
 *   ALERT SUMMARY                          [AS01]
 *   ┌────────────┐ ┌────────────┐ ┌────────────┐
 *   │ 3 CRITICAL │ │ 2 WARNING  │ │ 8 INFO     │
 *   └────────────┘ └────────────┘ └────────────┘
 *   ● 深港PIX     节点离线        持续 10 分钟    1m ago
 *   ● 上海腾讯    节点带宽利用率高 超过 85% 阈值  6m ago
 *   ● POO 香港 T1 节点延迟升高    延迟 250ms     15m ago
 */

import type { AlertSummary } from '@/hooks/v2'
import { Etch } from '@/components/atoms/Etch'
import { SerialPlate } from '@/components/atoms/SerialPlate'
import { contentFs } from '@/utils/fontScale'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { PanelFooterLink } from './PanelFooterLink'

interface Props {
  summary: AlertSummary
  title?: string
  serial?: string
  /** Click handler for an alert row */
  onAlertClick?: (uuid: string) => void
  /** Optional footer "View All →" link config. Renders at the bottom of the panel. */
  footerLink?: { label: string; href?: string; onClick?: () => void }
}

const LEVEL_COLOR = {
  critical: 'var(--signal-bad)',
  warning: 'var(--signal-warn)',
  info: 'var(--accent)',
} as const

const LEVEL_BG = {
  critical: 'rgba(168,58,48,0.06)',
  warning: 'rgba(176,120,32,0.06)',
  info: 'rgba(160,104,32,0.06)',
} as const

const LEVEL_BORDER = {
  critical: 'rgba(168,58,48,0.25)',
  warning: 'rgba(176,120,32,0.25)',
  info: 'rgba(160,104,32,0.25)',
} as const

function fmtAgo(iso?: string): string {
  if (!iso) return ''
  const ts = new Date(iso).getTime()
  if (Number.isNaN(ts)) return ''
  const dt = Date.now() - ts
  if (dt < 60_000) return 'just now'
  const m = Math.floor(dt / 60_000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function AlertSummaryPanel({
  summary,
  title = 'ALERT SUMMARY',
  serial = 'AS01',
  onAlertClick,
  footerLink,
}: Props) {
  const isMobile = useIsMobile()

  return (
    <div
      className="precision-card"
      style={{
        padding: '14px 18px',
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 6,
          marginBottom: 12,
        }}
      >
        {(['critical', 'warning', 'info'] as const).map((lv) => (
          <div
            key={lv}
            style={{
              padding: isMobile ? '6px 8px' : '8px 10px',
              background: LEVEL_BG[lv],
              border: `1px solid ${LEVEL_BORDER[lv]}`,
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 9,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontVariantNumeric: 'tabular-nums',
                fontSize: contentFs(isMobile ? 16 : 20),
                fontWeight: 500,
                color: LEVEL_COLOR[lv],
                lineHeight: 1,
                minWidth: 20,
              }}
            >
              {summary.counts[lv]}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: contentFs(9),
                  letterSpacing: '0.12em',
                  color: LEVEL_COLOR[lv],
                  fontWeight: 600,
                }}
              >
                {lv.toUpperCase()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {summary.alerts.length === 0 ? (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: contentFs(11),
            color: 'var(--fg-3)',
            padding: '8px 0',
            textAlign: 'center',
          }}
        >
          No active alerts.
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 7,
            paddingTop: 10,
            borderTop: '1px solid var(--edge-engrave)',
          }}
        >
          {summary.alerts.map((a) => (
            <div
              key={a.uuid + a.title}
              onClick={onAlertClick ? () => onAlertClick(a.uuid) : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontFamily: 'var(--font-mono)',
                fontSize: contentFs(11),
                cursor: onAlertClick ? 'pointer' : 'default',
                padding: '2px 0',
              }}
              onMouseEnter={(e) => {
                if (onAlertClick)
                  (e.currentTarget as HTMLDivElement).style.background = 'rgba(160,104,32,0.04)'
              }}
              onMouseLeave={(e) => {
                if (onAlertClick)
                  (e.currentTarget as HTMLDivElement).style.background = 'transparent'
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: LEVEL_COLOR[a.level],
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  color: 'var(--fg-0)',
                  fontWeight: 500,
                  fontFamily: 'var(--font-sans)',
                  fontSize: contentFs(12),
                  whiteSpace: 'nowrap',
                }}
              >
                {a.name}
              </span>
              <span style={{ color: 'var(--fg-1)', whiteSpace: 'nowrap' }}>{a.title}</span>
              {a.detail && (
                <span
                  style={{
                    color: 'var(--fg-3)',
                    fontSize: contentFs(10),
                    whiteSpace: 'nowrap',
                  }}
                >
                  {a.detail}
                </span>
              )}
              <span style={{ flex: 1 }} />
              <span
                style={{
                  color: 'var(--fg-3)',
                  fontSize: contentFs(10),
                  letterSpacing: '0.06em',
                  whiteSpace: 'nowrap',
                }}
              >
                {fmtAgo(a.timestampISO)}
              </span>
            </div>
          ))}
        </div>
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
