import type { ProbeServer } from '../types'

export interface TrafficDay { date: string; total?: number; upload?: number; download?: number }
const amount = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined

/** Date-only controller rows use the visitor's calendar; Worker estimates use UTC. */
export function trafficWeek(server: Pick<ProbeServer, 'daily_traffic' | 'daily_traffic_scope' | 'daily_traffic_estimated'>, now = new Date()) {
  const utc = server.daily_traffic_scope === 'probe_estimated_from_cumulative'
  const today = utc ? now.toISOString().slice(0, 10) : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const end = Date.parse(`${today}T00:00:00Z`)
  const rows = new Map((server.daily_traffic || []).map(row => [row.date, row]))
  const days: TrafficDay[] = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(end - (6 - index) * 86400000).toISOString().slice(0, 10)
    const row = rows.get(date)
    const upload = amount(row?.uplink), download = amount(row?.downlink)
    const total = amount(row?.total) ?? (upload !== undefined && download !== undefined ? upload + download : undefined)
    return { date, upload, download, total }
  })
  return { days, today: days[6], utc, estimated: !!server.daily_traffic_estimated }
}

/** Portal coordinates are viewport-based so card overflow/container queries cannot clip it. */
export function trafficPopoverPosition(anchor: { left: number; right: number; top: number; bottom: number }, width: number, height: number, viewportWidth: number, viewportHeight: number) {
  const margin = 12, gap = 8
  const below = anchor.bottom + gap
  const top = below + height <= viewportHeight - margin ? below : anchor.top - gap - height
  return {
    left: Math.max(margin, Math.min(anchor.right - width, viewportWidth - width - margin)),
    top: Math.max(margin, Math.min(top, viewportHeight - height - margin)),
  }
}
