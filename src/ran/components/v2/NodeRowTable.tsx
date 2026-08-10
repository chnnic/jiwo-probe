/**
 * NodeRowTable — true tabular view of nodes, one row per node.
 *
 * Columns (responsive — some collapse on narrow screens):
 *   ● NODE     STATUS   CPU    RAM    DISK   ↑ TX    ↓ RX    PING   LOSS   UPTIME   EXPIRES
 *
 * Designed for power users who want to scan 30+ nodes at a glance and
 * spot outliers (e.g. "all but one are < 10% CPU, this row is 95%").
 *
 * Clicking a row calls onNodeClick(uuid).
 *
 * Sort: this component is presentational — callers sort the nodes array
 * before passing in.
 */

import type { KomariNode, KomariRecord } from '@/types/komari'
import { Etch } from '@/components/atoms/Etch'
import { contentFs } from '@/utils/fontScale'
import {
  daysUntil,
  formatBps,
  resolveRamPercent,
} from '@/utils/format'
import { useIsMobile } from '@/hooks/useMediaQuery'

interface Props {
  nodes: KomariNode[]
  records: Record<string, KomariRecord>
  onNodeClick?: (uuid: string) => void
  /** UUID currently highlighted (e.g. selected in side panel) */
  selectedUuid?: string
}

function pctCell(pct: number | undefined): {
  text: string
  color: string
} {
  if (typeof pct !== 'number' || !Number.isFinite(pct)) {
    return { text: '—', color: 'var(--fg-3)' }
  }
  const v = Math.round(pct)
  let color = 'var(--fg-1)'
  if (v > 85) color = 'var(--signal-bad)'
  else if (v > 60) color = 'var(--signal-warn)'
  return { text: `${v}%`, color }
}

function fmtUptimeShort(seconds?: number): string {
  if (!seconds || seconds <= 0) return '—'
  const d = Math.floor(seconds / 86400)
  if (d > 0) return `${d}d`
  const h = Math.floor(seconds / 3600)
  return `${h}h`
}

function fmtExpire(iso?: string): { date: string; color: string } {
  if (!iso) return { date: '—', color: 'var(--fg-3)' }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: '—', color: 'var(--fg-3)' }
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const days = daysUntil(iso)
  let color = 'var(--fg-1)'
  if (typeof days === 'number') {
    if (days < 7) color = 'var(--signal-bad)'
    else if (days < 30) color = 'var(--signal-warn)'
  }
  return { date: `${y}-${mo}-${day}`, color }
}

export function NodeRowTable({
  nodes,
  records,
  onNodeClick,
  selectedUuid,
}: Props) {
  const isMobile = useIsMobile()

  const cellPad = '8px 10px'
  const headStyle: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: contentFs(9),
    letterSpacing: '0.14em',
    color: 'var(--fg-3)',
    fontWeight: 500,
    padding: '8px 10px',
    borderBottom: '1px solid var(--edge-engrave)',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    background: 'var(--bg-1)',
  }
  const bodyCell: React.CSSProperties = {
    padding: cellPad,
    fontFamily: 'var(--font-mono)',
    fontVariantNumeric: 'tabular-nums',
    fontSize: contentFs(11),
    borderBottom: '1px solid var(--edge-engrave)',
    whiteSpace: 'nowrap',
  }

  return (
    <div
      className="precision-card"
      style={{
        padding: 0,
        overflow: 'hidden',
      }}
    >
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            minWidth: isMobile ? 720 : 'auto',
          }}
        >
          <thead>
            <tr>
              <th style={{ ...headStyle, minWidth: 180 }}>NODE</th>
              <th style={{ ...headStyle, width: 70 }}>STATUS</th>
              <th style={{ ...headStyle, width: 60, textAlign: 'right' }}>CPU</th>
              <th style={{ ...headStyle, width: 60, textAlign: 'right' }}>RAM</th>
              <th style={{ ...headStyle, width: 60, textAlign: 'right' }}>DISK</th>
              {!isMobile && (
                <>
                  <th style={{ ...headStyle, width: 90, textAlign: 'right' }}>
                    ↑ TX
                  </th>
                  <th style={{ ...headStyle, width: 90, textAlign: 'right' }}>
                    ↓ RX
                  </th>
                  <th style={{ ...headStyle, width: 60, textAlign: 'right' }}>
                    PING
                  </th>
                  <th style={{ ...headStyle, width: 60, textAlign: 'right' }}>
                    LOSS
                  </th>
                </>
              )}
              <th style={{ ...headStyle, width: 70, textAlign: 'right' }}>
                UPTIME
              </th>
              <th style={{ ...headStyle, width: 110, textAlign: 'right' }}>
                EXPIRES
              </th>
            </tr>
          </thead>
          <tbody>
            {nodes.length === 0 ? (
              <tr>
                <td
                  colSpan={11}
                  style={{
                    ...bodyCell,
                    textAlign: 'center',
                    color: 'var(--fg-3)',
                    padding: '40px 10px',
                  }}
                >
                  No nodes match the current filters.
                </td>
              </tr>
            ) : (
              nodes.map((n) => {
                const r = records[n.uuid]
                const online = !!r?.online
                const dotColor = !online
                  ? 'var(--signal-bad)'
                  : (r?.cpu ?? 0) > 80 || (r?.loss ?? 0) > 5
                    ? 'var(--signal-warn)'
                    : 'var(--signal-good)'
                const cpu = pctCell(r?.cpu)
                const memPct = resolveRamPercent(r?.memory_used, r?.memory_total)
                const ram = pctCell(memPct)
                const diskPct =
                  r?.disk_used && r?.disk_total && r.disk_total > 0
                    ? (r.disk_used / r.disk_total) * 100
                    : undefined
                const disk = pctCell(diskPct)
                const exp = fmtExpire(n.expired_at)
                const isSelected = selectedUuid === n.uuid

                return (
                  <tr
                    key={n.uuid}
                    onClick={onNodeClick ? () => onNodeClick(n.uuid) : undefined}
                    style={{
                      cursor: onNodeClick ? 'pointer' : 'default',
                      background: isSelected
                        ? 'rgba(160,104,32,0.08)'
                        : 'transparent',
                      opacity: online ? 1 : 0.7,
                    }}
                    onMouseEnter={(e) => {
                      if (onNodeClick && !isSelected)
                        (e.currentTarget as HTMLTableRowElement).style.background =
                          'rgba(160,104,32,0.04)'
                    }}
                    onMouseLeave={(e) => {
                      if (onNodeClick && !isSelected)
                        (e.currentTarget as HTMLTableRowElement).style.background =
                          'transparent'
                    }}
                  >
                    <td style={bodyCell}>
                      <span
                        style={{
                          display: 'inline-block',
                          width: 7,
                          height: 7,
                          marginRight: 8,
                          borderRadius: '50%',
                          background: dotColor,
                          verticalAlign: 'middle',
                          boxShadow: online ? `0 0 3px ${dotColor}` : undefined,
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
                        {n.name ?? n.uuid.slice(0, 8)}
                      </span>
                      {n.region && (
                        <span
                          style={{
                            marginLeft: 8,
                            padding: '1px 5px',
                            fontSize: contentFs(8.5),
                            letterSpacing: '0.1em',
                            color: 'var(--fg-3)',
                            border: '1px solid var(--edge-engrave)',
                            borderRadius: 1,
                          }}
                        >
                          {n.region}
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        ...bodyCell,
                        color: online ? 'var(--signal-good)' : 'var(--signal-bad)',
                        letterSpacing: '0.08em',
                      }}
                    >
                      {online ? 'online' : 'offline'}
                    </td>
                    <td style={{ ...bodyCell, color: cpu.color, textAlign: 'right' }}>
                      {cpu.text}
                    </td>
                    <td style={{ ...bodyCell, color: ram.color, textAlign: 'right' }}>
                      {ram.text}
                    </td>
                    <td style={{ ...bodyCell, color: disk.color, textAlign: 'right' }}>
                      {disk.text}
                    </td>
                    {!isMobile && (
                      <>
                        <td
                          style={{
                            ...bodyCell,
                            color: 'var(--accent)',
                            textAlign: 'right',
                          }}
                        >
                          {r?.network_tx ? formatBps(r.network_tx) : '—'}
                        </td>
                        <td
                          style={{
                            ...bodyCell,
                            color: 'var(--signal-good)',
                            textAlign: 'right',
                          }}
                        >
                          {r?.network_rx ? formatBps(r.network_rx) : '—'}
                        </td>
                        <td
                          style={{
                            ...bodyCell,
                            color:
                              typeof r?.ping === 'number' && r.ping > 200
                                ? 'var(--signal-warn)'
                                : 'var(--fg-1)',
                            textAlign: 'right',
                          }}
                        >
                          {typeof r?.ping === 'number' && r.ping > 0
                            ? `${Math.round(r.ping)}ms`
                            : '—'}
                        </td>
                        <td
                          style={{
                            ...bodyCell,
                            color:
                              typeof r?.loss === 'number' && r.loss > 5
                                ? 'var(--signal-bad)'
                                : 'var(--fg-1)',
                            textAlign: 'right',
                          }}
                        >
                          {typeof r?.loss === 'number'
                            ? `${r.loss.toFixed(1)}%`
                            : '—'}
                        </td>
                      </>
                    )}
                    <td
                      style={{ ...bodyCell, color: 'var(--fg-1)', textAlign: 'right' }}
                    >
                      {fmtUptimeShort(r?.uptime)}
                    </td>
                    <td
                      style={{ ...bodyCell, color: exp.color, textAlign: 'right' }}
                    >
                      {exp.date}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
