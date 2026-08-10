/**
 * NodesPageActionBar — top-right action buttons for the Nodes page:
 *
 *   [⬇ Export]  [↻ Refresh]  [☰ Bulk Actions]
 *
 * Behavior:
 *   - Export    — exports current filtered nodes to a CSV download. Runs
 *                 entirely client-side; no backend involvement.
 *   - Refresh   — calls onRefresh() if provided. Visual-only if not.
 *   - Bulk Actions — opens a dropdown with placeholder operations. Since
 *                    Komari is a probe-display-only system and 岚 is a
 *                    front-end theme, "bulk" actions are limited to
 *                    front-end operations (copy IPs / names list,
 *                    select-all-for-comparison).
 *
 * Each button degrades gracefully — buttons that the front-end can't
 * actually perform are present but show a disabled tooltip explaining why.
 */

import { useEffect, useRef, useState } from 'react'
import type { KomariNode, KomariRecord } from '@/types/komari'
import { contentFs } from '@/utils/fontScale'

interface Props {
  /** Nodes currently visible (after filters) — used by Export */
  visibleNodes: KomariNode[]
  records: Record<string, KomariRecord>
  /** Refresh handler — typically triggers a re-fetch. Visual-only if undefined. */
  onRefresh?: () => void
}

function downloadCSV(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function escapeCSV(v: string | number | undefined | null): string {
  if (v === undefined || v === null) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function nodesToCSV(
  nodes: KomariNode[],
  records: Record<string, KomariRecord>,
): string {
  const headers = [
    'uuid',
    'name',
    'region',
    'group',
    'os',
    'cpu_cores',
    'cpu_threads',
    'kernel',
    'online',
    'cpu_pct',
    'ram_pct',
    'disk_pct',
    'tx_bps',
    'rx_bps',
    'ping_ms',
    'loss_pct',
    'uptime_s',
    'period_start',
    'period_end',
    'period_used_up',
    'period_used_down',
    'period_used_total',
    'period_billed_used',
    'traffic_limit',
    'cumulative_up',
    'cumulative_down',
    'expired_at',
  ]
  const lines = [headers.join(',')]
  for (const n of nodes) {
    const r = records[n.uuid]
    const memPct =
      r?.memory_used && r?.memory_total && r.memory_total > 0
        ? Math.round((r.memory_used / r.memory_total) * 100)
        : ''
    const diskPct =
      r?.disk_used && r?.disk_total && r.disk_total > 0
        ? Math.round((r.disk_used / r.disk_total) * 100)
        : ''
    lines.push(
      [
        escapeCSV(n.uuid),
        escapeCSV(n.name),
        escapeCSV(n.region),
        escapeCSV(n.group),
        escapeCSV(n.os),
        escapeCSV(n.cpu_cores),
        escapeCSV(n.cpu_threads),
        escapeCSV(n.kernel),
        escapeCSV(r?.online ? '1' : '0'),
        escapeCSV(r?.cpu !== undefined ? Math.round(r.cpu) : ''),
        escapeCSV(memPct),
        escapeCSV(diskPct),
        escapeCSV(r?.network_tx ?? ''),
        escapeCSV(r?.network_rx ?? ''),
        escapeCSV(r?.ping !== undefined ? Math.round(r.ping) : ''),
        escapeCSV(r?.loss !== undefined ? r.loss.toFixed(2) : ''),
        escapeCSV(r?.uptime ?? ''),
        escapeCSV(n.period_start),
        escapeCSV(n.period_end),
        escapeCSV(n.traffic_used_up),
        escapeCSV(n.traffic_used_down),
        escapeCSV(n.traffic_used_total),
        escapeCSV(n.traffic_used),
        escapeCSV(n.traffic_limit),
        escapeCSV(r?.network_total_up),
        escapeCSV(r?.network_total_down),
        escapeCSV(n.expired_at),
      ].join(','),
    )
  }
  return lines.join('\n')
}

function btnBase(): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '5px 10px',
    background: 'var(--bg-1)',
    border: '1px solid var(--edge-engrave)',
    borderRadius: 3,
    boxShadow: 'inset 0 1px 0 var(--edge-deep)',
    fontFamily: 'var(--font-mono)',
    fontSize: contentFs(10),
    letterSpacing: '0.1em',
    color: 'var(--fg-1)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }
}

export function NodesPageActionBar({
  visibleNodes,
  records,
  onRefresh,
}: Props) {
  const [bulkOpen, setBulkOpen] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const bulkRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!bulkOpen) return
    const click = (e: MouseEvent) => {
      if (!bulkRef.current?.contains(e.target as Node)) setBulkOpen(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBulkOpen(false)
    }
    window.addEventListener('mousedown', click)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('mousedown', click)
      window.removeEventListener('keydown', esc)
    }
  }, [bulkOpen])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 1500)
    return () => clearTimeout(t)
  }, [toast])

  const handleExport = () => {
    const ts = new Date()
    const date = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, '0')}${String(ts.getDate()).padStart(2, '0')}-${String(ts.getHours()).padStart(2, '0')}${String(ts.getMinutes()).padStart(2, '0')}`
    const csv = nodesToCSV(visibleNodes, records)
    downloadCSV(`ran-nodes-${date}.csv`, csv)
    setToast(`Exported ${visibleNodes.length} nodes`)
  }

  const handleRefresh = () => {
    setSpinning(true)
    onRefresh?.()
    setToast('Refreshed')
    setTimeout(() => setSpinning(false), 600)
  }

  const copyNames = () => {
    navigator.clipboard.writeText(
      visibleNodes.map((n) => n.name ?? n.uuid).join('\n'),
    )
    setToast(`Copied ${visibleNodes.length} names`)
    setBulkOpen(false)
  }

  const copyIPs = () => {
    const ips = visibleNodes
      .map((n) => (n as { ip?: string }).ip)
      .filter(Boolean) as string[]
    navigator.clipboard.writeText(ips.join('\n'))
    setToast(`Copied ${ips.length} IPs`)
    setBulkOpen(false)
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        gap: 6,
        position: 'relative',
      }}
    >
      <button type="button" onClick={handleExport} style={btnBase()}>
        <span>⬇</span>
        <span>EXPORT</span>
      </button>

      <button
        type="button"
        onClick={handleRefresh}
        style={btnBase()}
        title="Refresh data"
      >
        <span
          style={{
            display: 'inline-block',
            transition: 'transform 0.6s ease',
            transform: spinning ? 'rotate(360deg)' : 'rotate(0deg)',
          }}
        >
          ↻
        </span>
        <span>REFRESH</span>
      </button>

      <div ref={bulkRef} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setBulkOpen((s) => !s)}
          style={btnBase()}
        >
          <span>☰</span>
          <span>BULK</span>
          <span style={{ fontSize: contentFs(8), opacity: 0.6, marginLeft: 2 }}>
            ▼
          </span>
        </button>

        {bulkOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              right: 0,
              minWidth: 200,
              background: 'var(--bg-1)',
              border: '1px solid var(--edge-engrave)',
              borderRadius: 4,
              boxShadow: '0 4px 12px rgba(50,40,25,0.18)',
              zIndex: 50,
              padding: 3,
            }}
          >
            <BulkItem onClick={copyNames}>Copy node names</BulkItem>
            <BulkItem onClick={copyIPs}>Copy node IPs</BulkItem>
            <BulkItem
              disabled
              tooltip="Komari has no front-end edit API"
              onClick={() => {}}
            >
              Restart selected…
            </BulkItem>
            <BulkItem
              disabled
              tooltip="Komari has no front-end edit API"
              onClick={() => {}}
            >
              Update tags…
            </BulkItem>
          </div>
        )}
      </div>

      {toast && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            padding: '4px 9px',
            background: 'var(--bg-0)',
            border: '1px solid var(--accent)',
            borderRadius: 3,
            color: 'var(--accent-bright)',
            fontFamily: 'var(--font-mono)',
            fontSize: contentFs(10),
            letterSpacing: '0.06em',
            zIndex: 60,
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 6px rgba(50,40,25,0.12)',
          }}
        >
          ✓ {toast}
        </div>
      )}
    </div>
  )
}

function BulkItem({
  children,
  onClick,
  disabled,
  tooltip,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  tooltip?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '5px 9px',
        background: 'transparent',
        border: 'none',
        borderRadius: 2,
        fontFamily: 'var(--font-mono)',
        fontSize: contentFs(11),
        color: disabled ? 'var(--fg-3)' : 'var(--fg-1)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        letterSpacing: '0.04em',
        opacity: disabled ? 0.6 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled)
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-2)'
      }}
      onMouseLeave={(e) => {
        if (!disabled)
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
      }}
    >
      {children}
    </button>
  )
}
