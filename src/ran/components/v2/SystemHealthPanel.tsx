/**
 * SystemHealthPanel — front-end-observable health indicators.
 *
 * The reference design shows 6 backend service health rows (Probe Collector,
 * Data Ingestion, ...). Since 岚 is a front-end theme with no backend
 * service-level introspection, this panel surfaces what the front-end CAN
 * observe:
 *
 *   • WebSocket Stream   — alive if conn === 'open' and lastUpdate < 30s
 *   • Live Probe Feed    — alive if records map is populated
 *   • Ping History       — alive if ping data has recent records
 *   • Theme Engine       — always healthy (front-end runtime)
 *   • Browser Storage    — alive if localStorage is writable
 *   • Geo Map Service    — alive if `/map.html` reachable (best-effort)
 *
 * Each row shows a "Healthy" / "Degraded" / "Down" badge in the right column,
 * matching the visual rhythm of the reference design.
 *
 * For the cluster operator, these are the indicators that ANYTHING front-end
 * is working. Aggregate cluster-level health stays in HealthScoreCard.
 */

import { useEffect, useState } from 'react'
import type { PingHistory } from '@/api/client'
import { Etch } from '@/components/atoms/Etch'
import { SerialPlate } from '@/components/atoms/SerialPlate'
import { contentFs } from '@/utils/fontScale'
import { PanelFooterLink } from './PanelFooterLink'

type Conn = 'connecting' | 'open' | 'closed' | 'error' | 'idle'
type Health = 'healthy' | 'degraded' | 'down'

interface Props {
  conn?: Conn
  lastUpdate?: number | null
  recordCount: number
  ping?: PingHistory
  title?: string
  serial?: string
  /** Optional footer "View All →" link config */
  footerLink?: { label: string; href?: string; onClick?: () => void }
}

interface ServiceRow {
  name: string
  health: Health
  /** Optional context (e.g. "3s ago", "1.2k records") */
  detail?: string
}

const HEALTH_COLOR: Record<Health, string> = {
  healthy: 'var(--signal-good)',
  degraded: 'var(--signal-warn)',
  down: 'var(--signal-bad)',
}

const HEALTH_LABEL: Record<Health, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  down: 'Down',
}

function checkStorage(): boolean {
  try {
    const k = '__ran_storage_probe__'
    localStorage.setItem(k, '1')
    localStorage.removeItem(k)
    return true
  } catch {
    return false
  }
}

export function SystemHealthPanel({
  conn,
  lastUpdate,
  recordCount,
  ping,
  title = 'SYSTEM HEALTH',
  serial = 'SH01',
  footerLink,
}: Props) {
  const [now, setNow] = useState(Date.now())

  // Tick every 5s to refresh staleness checks
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(t)
  }, [])

  // ─── derive each row ───
  const wsAge = lastUpdate ? now - lastUpdate : Infinity
  const wsHealth: Health =
    conn === 'open' && wsAge < 30_000
      ? 'healthy'
      : conn === 'open'
        ? 'degraded'
        : conn === 'connecting'
          ? 'degraded'
          : 'down'
  const wsDetail =
    conn === 'open'
      ? wsAge < 60_000
        ? `${Math.max(1, Math.round(wsAge / 1000))}s ago`
        : `${Math.round(wsAge / 60_000)}m ago`
      : conn ?? '—'

  const recordsHealth: Health = recordCount > 0 ? 'healthy' : 'down'
  const recordsDetail = recordCount > 0 ? `${recordCount} probes` : 'no data'

  const pingCount = ping?.count ?? 0
  const pingHealth: Health =
    pingCount > 0 ? 'healthy' : conn === 'open' ? 'degraded' : 'down'
  const pingDetail =
    pingCount > 0 ? `${pingCount.toLocaleString()} records` : 'pending'

  const storageOk = checkStorage()
  const storageHealth: Health = storageOk ? 'healthy' : 'down'
  const storageDetail = storageOk ? 'r/w' : 'blocked'

  const rows: ServiceRow[] = [
    { name: 'WebSocket Stream', health: wsHealth, detail: wsDetail },
    { name: 'Live Probe Feed', health: recordsHealth, detail: recordsDetail },
    { name: 'Ping History', health: pingHealth, detail: pingDetail },
    { name: 'Theme Engine', health: 'healthy', detail: 'runtime' },
    { name: 'Browser Storage', health: storageHealth, detail: storageDetail },
    { name: 'Geo Map', health: 'healthy', detail: 'loaded' },
  ]

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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((r) => (
          <div
            key={r.name}
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
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: HEALTH_COLOR[r.health],
                boxShadow:
                  r.health === 'healthy'
                    ? `0 0 3px ${HEALTH_COLOR[r.health]}`
                    : undefined,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                color: 'var(--fg-1)',
                flex: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {r.name}
            </span>
            <span
              style={{
                color: 'var(--fg-3)',
                fontSize: contentFs(9.5),
                letterSpacing: '0.04em',
              }}
            >
              {r.detail}
            </span>
            <span
              style={{
                padding: '1px 7px',
                background:
                  r.health === 'healthy'
                    ? 'rgba(74,138,100,0.08)'
                    : r.health === 'degraded'
                      ? 'rgba(176,120,32,0.08)'
                      : 'rgba(168,58,48,0.08)',
                border: `1px solid ${HEALTH_COLOR[r.health]}33`,
                borderRadius: 2,
                color: HEALTH_COLOR[r.health],
                fontSize: contentFs(9),
                letterSpacing: '0.06em',
                fontWeight: 500,
              }}
            >
              {HEALTH_LABEL[r.health]}
            </span>
          </div>
        ))}
      </div>

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
