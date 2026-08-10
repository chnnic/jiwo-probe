/**
 * NodeDetailDrawer — slide-in panel from the right showing a node's
 * key metrics without leaving the Nodes page.
 *
 * Behavior:
 *  - Click node card / row → drawer opens with that node's data
 *  - Click outside (overlay) or press Esc → drawer closes
 *  - "View Details" link → navigates to the full Hub page for deeper dives
 *  - "Copy SSH" → copies "ssh user@ip" to clipboard (no actual SSH connect)
 *
 * Content (top to bottom):
 *  - Header: name, region badge, status dot, close X
 *  - Subline: OS · cores · ram
 *  - IP block (copyable)
 *  - Provider / Group / Tags row
 *  - 3 progress bars: CPU / RAM / DISK
 *  - 2 spark lines: Inbound / Outbound network
 *  - Uptime + Expires
 *  - Footer buttons: View Details, Copy SSH
 *
 * The drawer is fixed-position with a translateX animation. Width is
 * responsive — on mobile it takes 90vw, on desktop a comfortable 380px.
 */

import { useEffect, useState } from 'react'
import type { KomariNode, KomariRecord } from '@/types/komari'
import { Etch } from '@/components/atoms/Etch'
import { contentFs } from '@/utils/fontScale'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { formatBytes, formatBps, resolveRamPercent, daysUntil } from '@/utils/format'
import { hashFor, navigate } from '@/router/route'

interface Props {
  node: KomariNode | null
  record?: KomariRecord
  onClose: () => void
}

function fmtUptimeShort(seconds?: number): string {
  if (!seconds || seconds <= 0) return '—'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  if (d > 0) return `${d}d ${h}h`
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

function fmtIsoDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function ProgressRow({
  label,
  pct,
  detail,
  color,
}: {
  label: string
  pct: number | undefined
  detail?: string
  color?: string
}) {
  const valid = typeof pct === 'number' && Number.isFinite(pct)
  const fillColor = color ?? (valid && pct > 85 ? 'var(--signal-bad)' : valid && pct > 60 ? 'var(--signal-warn)' : 'var(--accent)')
  const displayPct = valid ? Math.min(100, Math.max(0, pct)).toFixed(0) : '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <Etch>{label}</Etch>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: contentFs(13),
            fontWeight: 500,
            color: 'var(--fg-0)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {displayPct}
          {valid && <span style={{ fontSize: contentFs(10), color: 'var(--fg-2)' }}>%</span>}
        </span>
      </div>
      <div
        style={{
          height: 6,
          background: 'var(--bg-inset)',
          border: '1px solid var(--edge-engrave)',
          borderRadius: 1,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: 'inset 0 1px 1px var(--edge-deep)',
        }}
      >
        {valid && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${Math.min(100, Math.max(0, pct))}%`,
              background: fillColor,
              boxShadow: `0 0 3px ${fillColor}`,
              transition: 'width 0.3s ease',
            }}
          />
        )}
      </div>
      {detail && (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: contentFs(10),
            color: 'var(--fg-3)',
          }}
        >
          {detail}
        </div>
      )}
    </div>
  )
}

function CopyableLine({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    if (!navigator?.clipboard?.writeText) return
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '6px 10px',
        background: 'var(--bg-inset)',
        border: '1px solid var(--edge-engrave)',
        borderRadius: 2,
        boxShadow: 'inset 0 1px 0 var(--edge-deep)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Etch>{label}</Etch>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: contentFs(12),
            color: 'var(--fg-0)',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {value || '—'}
        </span>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        disabled={!value}
        style={{
          padding: '3px 7px',
          background: 'var(--bg-2)',
          border: '1px solid var(--edge-engrave)',
          borderRadius: 2,
          fontFamily: 'var(--font-mono)',
          fontSize: contentFs(9),
          letterSpacing: '0.14em',
          color: copied ? 'var(--signal-good)' : 'var(--fg-2)',
          cursor: value ? 'pointer' : 'not-allowed',
          flexShrink: 0,
        }}
      >
        {copied ? 'COPIED' : 'COPY'}
      </button>
    </div>
  )
}

export function NodeDetailDrawer({ node, record, onClose }: Props) {
  const isMobile = useIsMobile()
  const [mounted, setMounted] = useState(false)

  // Lock body scroll while open
  useEffect(() => {
    if (!node) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setMounted(true)
    return () => {
      document.body.style.overflow = prev
      setMounted(false)
    }
  }, [node])

  // Esc to close
  useEffect(() => {
    if (!node) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [node, onClose])

  if (!node) return null

  const isOnline = !!record?.online
  const memPct = resolveRamPercent(record?.memory_used, record?.memory_total)
  const diskPct =
    record?.disk_used && record?.disk_total && record.disk_total > 0
      ? (record.disk_used / record.disk_total) * 100
      : undefined
  const daysToExpire = daysUntil(node.expired_at)
  const expColor =
    typeof daysToExpire === 'number'
      ? daysToExpire < 7
        ? 'var(--signal-bad)'
        : daysToExpire < 30
          ? 'var(--signal-warn)'
          : 'var(--fg-1)'
      : 'var(--fg-3)'

  // Resolve IP — try a few common shapes; fall back to placeholder
  const ip = (node as { ipv4?: string; ipv6?: string }).ipv4
    ?? (node as { ip?: string }).ip
    ?? ''

  const width = isMobile ? '90vw' : 380

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(20,17,11,0.32)',
          backdropFilter: 'blur(2px)',
          zIndex: 100,
          opacity: mounted ? 1 : 0,
          transition: 'opacity 0.2s ease',
        }}
        aria-hidden="true"
      />
      {/* Drawer */}
      <aside
        role="dialog"
        aria-label={`Node ${node.name ?? node.uuid}`}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width,
          maxWidth: '95vw',
          background: 'var(--bg-1)',
          borderLeft: '1px solid var(--edge-engrave)',
          boxShadow: '-6px 0 20px rgba(50,40,25,0.18)',
          zIndex: 101,
          display: 'flex',
          flexDirection: 'column',
          transform: mounted ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.24s ease',
        }}
      >
        {/* Header */}
        <header
          style={{
            padding: '14px 16px 12px',
            borderBottom: '1px solid var(--edge-engrave)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: isOnline ? 'var(--signal-good)' : 'var(--signal-bad)',
                  boxShadow: isOnline ? '0 0 4px var(--signal-good)' : undefined,
                  flexShrink: 0,
                }}
              />
              <h3
                style={{
                  margin: 0,
                  fontSize: contentFs(15),
                  fontWeight: 600,
                  color: 'var(--fg-0)',
                  letterSpacing: '-0.01em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {node.name ?? node.uuid.slice(0, 8)}
              </h3>
              {node.region && (
                <span
                  style={{
                    padding: '1px 5px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: contentFs(9),
                    letterSpacing: '0.12em',
                    color: 'var(--accent-bright)',
                    background: 'var(--bg-2)',
                    border: '1px solid var(--edge-engrave)',
                    borderRadius: 2,
                    flexShrink: 0,
                  }}
                >
                  {node.region}
                </span>
              )}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: contentFs(10),
                color: 'var(--fg-3)',
                letterSpacing: '0.06em',
              }}
            >
              {[
                node.os,
                node.cpu_cores ? `${node.cpu_cores} cores` : null,
                record?.memory_total ? `${formatBytes(record.memory_total)} RAM` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            style={{
              width: 26,
              height: 26,
              padding: 0,
              background: 'var(--bg-2)',
              border: '1px solid var(--edge-engrave)',
              borderRadius: 3,
              fontSize: contentFs(13),
              color: 'var(--fg-2)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </header>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {ip && <CopyableLine label="IP ADDRESS" value={ip} />}

          {(node.region || node.group || (node.tags && node.tags.length > 0)) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {node.group && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    fontFamily: 'var(--font-mono)',
                    fontSize: contentFs(11),
                  }}
                >
                  <Etch>GROUP</Etch>
                  <span style={{ color: 'var(--fg-1)' }}>{node.group}</span>
                </div>
              )}
              {node.region && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    fontFamily: 'var(--font-mono)',
                    fontSize: contentFs(11),
                  }}
                >
                  <Etch>REGION</Etch>
                  <span style={{ color: 'var(--fg-1)' }}>{node.region}</span>
                </div>
              )}
            </div>
          )}

          {/* Live metrics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <ProgressRow
              label="CPU"
              pct={record?.cpu}
              detail={node.cpu_name ?? undefined}
            />
            <ProgressRow
              label="MEMORY"
              pct={memPct}
              detail={
                record?.memory_used !== undefined && record?.memory_total
                  ? `${formatBytes(record.memory_used)} / ${formatBytes(record.memory_total)}`
                  : undefined
              }
            />
            <ProgressRow
              label="DISK"
              pct={diskPct}
              detail={
                record?.disk_used !== undefined && record?.disk_total
                  ? `${formatBytes(record.disk_used)} / ${formatBytes(record.disk_total)}`
                  : undefined
              }
            />
          </div>

          {/* Network */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Etch>NETWORK</Etch>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
                fontFamily: 'var(--font-mono)',
              }}
            >
              <div
                style={{
                  padding: '8px 10px',
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--edge-engrave)',
                  borderRadius: 2,
                }}
              >
                <div
                  style={{
                    fontSize: contentFs(9),
                    letterSpacing: '0.14em',
                    color: 'var(--accent-bright)',
                    marginBottom: 2,
                  }}
                >
                  ↑ TX
                </div>
                <div
                  style={{
                    fontSize: contentFs(13),
                    color: 'var(--fg-0)',
                    fontWeight: 500,
                  }}
                >
                  {record?.network_tx ? formatBps(record.network_tx) : '—'}
                </div>
                <div style={{ fontSize: contentFs(9), color: 'var(--fg-3)', marginTop: 2 }}>
                  total {record?.network_total_up ? formatBytes(record.network_total_up) : '—'}
                </div>
              </div>
              <div
                style={{
                  padding: '8px 10px',
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--edge-engrave)',
                  borderRadius: 2,
                }}
              >
                <div
                  style={{
                    fontSize: contentFs(9),
                    letterSpacing: '0.14em',
                    color: 'var(--signal-good)',
                    marginBottom: 2,
                  }}
                >
                  ↓ RX
                </div>
                <div
                  style={{
                    fontSize: contentFs(13),
                    color: 'var(--fg-0)',
                    fontWeight: 500,
                  }}
                >
                  {record?.network_rx ? formatBps(record.network_rx) : '—'}
                </div>
                <div style={{ fontSize: contentFs(9), color: 'var(--fg-3)', marginTop: 2 }}>
                  total {record?.network_total_down ? formatBytes(record.network_total_down) : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Latency / loss */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
              fontFamily: 'var(--font-mono)',
            }}
          >
            <div>
              <Etch>LATENCY</Etch>
              <div
                style={{
                  fontSize: contentFs(13),
                  color:
                    typeof record?.ping === 'number'
                      ? record.ping > 200
                        ? 'var(--signal-warn)'
                        : 'var(--fg-0)'
                      : 'var(--fg-3)',
                  fontWeight: 500,
                  marginTop: 2,
                }}
              >
                {typeof record?.ping === 'number' && record.ping > 0
                  ? `${Math.round(record.ping)}ms`
                  : '—'}
              </div>
            </div>
            <div>
              <Etch>PACKET LOSS</Etch>
              <div
                style={{
                  fontSize: contentFs(13),
                  color:
                    typeof record?.loss === 'number' && record.loss > 5
                      ? 'var(--signal-bad)'
                      : 'var(--fg-0)',
                  fontWeight: 500,
                  marginTop: 2,
                }}
              >
                {typeof record?.loss === 'number'
                  ? `${record.loss.toFixed(1)}%`
                  : '—'}
              </div>
            </div>
          </div>

          {/* Uptime / Expiry */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
              fontFamily: 'var(--font-mono)',
              paddingTop: 8,
              borderTop: '1px solid var(--edge-engrave)',
            }}
          >
            <div>
              <Etch>UPTIME</Etch>
              <div
                style={{
                  fontSize: contentFs(12),
                  color: 'var(--fg-1)',
                  marginTop: 2,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmtUptimeShort(record?.uptime)}
              </div>
            </div>
            <div>
              <Etch>EXPIRES</Etch>
              <div
                style={{
                  fontSize: contentFs(12),
                  color: expColor,
                  marginTop: 2,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmtIsoDate(node.expired_at)}{' '}
                {typeof daysToExpire === 'number' && (
                  <span style={{ color: 'var(--fg-3)' }}>({daysToExpire}d)</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <footer
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--edge-engrave)',
            background: 'var(--bg-2)',
            display: 'flex',
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={() => {
              onClose()
              navigate({ name: 'hub', uuid: node.uuid })
            }}
            style={{
              flex: 1,
              padding: '7px 10px',
              background: 'var(--accent)',
              border: '1px solid var(--accent)',
              borderRadius: 3,
              fontFamily: 'var(--font-mono)',
              fontSize: contentFs(10),
              letterSpacing: '0.12em',
              color: 'var(--bg-4)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            VIEW DETAILS →
          </button>
          <a
            href={`./index.html${hashFor({ name: 'nodes', uuid: node.uuid })}`}
            style={{
              padding: '7px 10px',
              background: 'var(--bg-1)',
              border: '1px solid var(--edge-engrave)',
              borderRadius: 3,
              fontFamily: 'var(--font-mono)',
              fontSize: contentFs(10),
              letterSpacing: '0.12em',
              color: 'var(--fg-1)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            FULL PAGE
          </a>
        </footer>
      </aside>
    </>
  )
}
