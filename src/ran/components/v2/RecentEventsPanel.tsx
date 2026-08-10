/**
 * RecentEventsPanel — chronological list of node status transitions.
 *
 *   RECENT EVENTS                     [VIEW ALL →]
 *   ● 香港HKT KAZE  节点恢复在线           2m ago
 *   ● 广州腾讯      节点带宽恢复正常       7m ago
 *   ● 深圳无忧佛山  节点延迟恢复正常       12m ago
 *   ● 云悠香港      节点配置更新           18m ago
 *   ● 上海腾讯      节点异常已恢复         25m ago
 *
 * Empty state encourages first-run users: "Events appear here as nodes
 * transition state." The list is fed by useRecentEvents().
 */

import type { EventKind, NodeEvent } from '@/hooks/v2'
import { Etch } from '@/components/atoms/Etch'
import { contentFs } from '@/utils/fontScale'
import { PanelFooterLink } from './PanelFooterLink'

interface Props {
  events: NodeEvent[]
  title?: string
  /** Click handler for an event row */
  onEventClick?: (uuid: string) => void
  /** Optional footer "View All →" link config */
  footerLink?: { label: string; href?: string; onClick?: () => void }
  /** Max visible (default 5) */
  limit?: number
}

const KIND_DOT_COLOR: Record<EventKind, string> = {
  up: 'var(--signal-good)',
  down: 'var(--signal-bad)',
  degraded: 'var(--signal-warn)',
  recovered: 'var(--signal-good)',
}

function fmtAgo(t: number): string {
  const dt = Date.now() - t
  if (dt < 60_000) return 'just now'
  const m = Math.floor(dt / 60_000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function RecentEventsPanel({
  events,
  title = 'RECENT EVENTS',
  onEventClick,
  footerLink,
  limit = 5,
}: Props) {
  const visible = events.slice(0, limit)

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
      </div>

      {visible.length === 0 ? (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: contentFs(11),
            color: 'var(--fg-3)',
            padding: '12px 0',
            textAlign: 'center',
            letterSpacing: '0.04em',
          }}
        >
          Events appear here as nodes transition state.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visible.map((e, i) => (
            <div
              key={i + e.uuid + e.t}
              onClick={onEventClick ? () => onEventClick(e.uuid) : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                fontFamily: 'var(--font-mono)',
                fontSize: contentFs(11),
                cursor: onEventClick ? 'pointer' : 'default',
              }}
              onMouseEnter={(ev) => {
                if (onEventClick)
                  (ev.currentTarget as HTMLDivElement).style.background = 'rgba(160,104,32,0.04)'
              }}
              onMouseLeave={(ev) => {
                if (onEventClick)
                  (ev.currentTarget as HTMLDivElement).style.background = 'transparent'
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: KIND_DOT_COLOR[e.kind],
                  boxShadow: `0 0 3px ${KIND_DOT_COLOR[e.kind]}`,
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
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 160,
                }}
              >
                {e.name}
              </span>
              <span
                style={{
                  color: 'var(--fg-1)',
                  flex: 1,
                  minWidth: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {e.message}
              </span>
              <span
                style={{
                  color: 'var(--fg-3)',
                  fontSize: contentFs(10),
                  letterSpacing: '0.06em',
                  whiteSpace: 'nowrap',
                }}
              >
                {fmtAgo(e.t)}
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
