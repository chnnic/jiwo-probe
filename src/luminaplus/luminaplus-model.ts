import type { ProbeServer } from '../types'
import { CYCLE_DAYS, CYCLE_MONTHS, expiryTimestamp, isPermanent } from '../renewal.ts'

export const LUMINA_PLUS_VIEWS = ['large', 'compact', 'mini', 'list'] as const
export type LuminaPlusView = typeof LUMINA_PLUS_VIEWS[number]
export function parseLuminaPlusView(value: unknown): LuminaPlusView {
  // The original three-mode implementation stored the large layout as "card".
  return LUMINA_PLUS_VIEWS.find(view => view === value) || 'large'
}

const nonnegative = (value?: number) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined

export type LiveSpeedSort = 'total' | 'upload' | 'download'

/** Keep original snapshot indices: a rank/filter position is not a server route. */
export function rankLiveSpeeds(servers: ProbeServer[], sort: LiveSpeedSort = 'total') {
  return servers.flatMap((server, index) => {
    if (!server.online) return []
    const upload = nonnegative(server.upload_speed), download = nonnegative(server.download_speed)
    const total = upload === undefined || download === undefined ? undefined : nonnegative(upload + download)
    const value = sort === 'upload' ? upload : sort === 'download' ? download : total
    return value === undefined ? [] : [{ server, index, upload, download, total, value }]
  }).sort((a, b) => b.value - a.value || a.index - b.index)
}

/** Period counters include offline nodes; billed usage is authoritative, never up + down or lifetime counters. */
export function rankPeriodTraffic(servers: ProbeServer[], sort: LiveSpeedSort = 'total') {
  return servers.flatMap((server, index) => {
    const upload = nonnegative(server.traffic_used_up), download = nonnegative(server.traffic_used_down)
    const total = nonnegative(server.traffic_used ?? server.traffic_used_total)
    const value = sort === 'upload' ? upload : sort === 'download' ? download : total
    return value === undefined ? [] : [{ server, index, upload, download, total, value }]
  }).sort((a, b) => b.value - a.value || a.index - b.index)
}

/** Small positive values retain one segment; unknown values never look like usage. */
export function filledSegments(percent?: number, count = 20): number {
  const value = nonnegative(percent)
  return value === undefined || value === 0 ? 0 : Math.ceil(Math.min(value, 100) / 100 * count)
}

export function loadMetric(server: Pick<ProbeServer, 'loadavg' | 'cpu_cores'>) {
  const token = server.loadavg?.trim().split(/\s+/)[0]
  const value = token && /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token) ? nonnegative(Number(token)) : undefined
  const cores = nonnegative(server.cpu_cores)
  return { value, percent: value !== undefined && cores !== undefined && cores > 0 ? value / cores * 100 : undefined }
}

/** Use the billed counter from the controller. Never re-add or double one-way traffic. */
export function quotaMetric(server: Pick<ProbeServer, 'traffic_limit' | 'traffic_used' | 'traffic_used_total'>) {
  const limit = nonnegative(server.traffic_limit)
  const used = nonnegative(server.traffic_used ?? server.traffic_used_total)
  return {
    limit, used, unlimited: limit === 0,
    remaining: limit !== undefined && limit > 0 && used !== undefined ? Math.max(0, limit - used) : undefined,
    percent: limit !== undefined && limit > 0 && used !== undefined ? used / limit * 100 : undefined,
    exceeded: limit !== undefined && limit > 0 && used !== undefined && used > limit,
  }
}

/** Reset date is the traffic period's end, never the subscription's expiry date. */
export function resetDays(periodEnd?: string, now = Date.now()): number | undefined {
  const end = periodEnd ? Date.parse(periodEnd) : NaN
  return Number.isFinite(end) && end >= now ? Math.ceil((end - now) / 86400000) : undefined
}

export function speedTone(bytesPerSecond?: number): 'idle' | 'low' | 'high' | 'max' | 'unknown' {
  const value = nonnegative(bytesPerSecond)
  if (value === undefined) return 'unknown'
  // Original LuminaPlus uses binary B/s → KB/s → MB/s → GB/s tiers.
  // Classify API bytes/s, not the displayed bits/bytes label, so changing units
  // never changes the color of the same physical speed.
  return value < 1024 ? 'idle' : value < 1024 ** 2 ? 'low' : value < 1024 ** 3 ? 'high' : 'max'
}

export const PULSE_POINTS = 18
export interface SpeedTrail { name?: string; upload: Array<number | undefined>; download: Array<number | undefined> }

/** Compact pulse shows total duplex speed only when both directions were reported. */
export function combinedSpeedTrail(trail?: SpeedTrail): Array<number | undefined> {
  if (!trail) return []
  return Array.from({ length: Math.max(trail.upload.length, trail.download.length) }, (_, index) => {
    const up = nonnegative(trail.upload[index]), down = nonnegative(trail.download[index])
    return up === undefined || down === undefined ? undefined : up + down
  })
}

/** Only received snapshots enter the trail; unreported/offline slots stay empty. */
export function nextSpeedTrails(servers: ProbeServer[], previous: SpeedTrail[] = []): SpeedTrail[] {
  return servers.map((server, index) => {
    const before = previous[index]?.name === server.name ? previous[index] : undefined
    const append = (key: 'upload' | 'download') => [...(before?.[key] || []), server.online ? nonnegative(server[`${key}_speed`]) : undefined].slice(-PULSE_POINTS)
    return { name: server.name, upload: append('upload'), download: append('download') }
  })
}

/** Log scale keeps small real activity visible without giving missing samples a value. */
export function pulseStrength(value?: number): number {
  const speed = nonnegative(value)
  return speed === undefined || speed === 0 ? 0 : Math.min(1, .25 + Math.log10(1 + speed / 1024) / 5)
}

export function regionKey(server: ProbeServer): string {
  return [server.region_country, server.region, server.region_name].map(value => value?.trim()).find(Boolean)?.toUpperCase() || '未知'
}

/** Controller-converted CNY takes precedence. Never invent an FX rate or add currencies. */
export function assetOverview(servers: ProbeServer[], now = Date.now()) {
  const currencies = new Map<string, { currency: string; monthly: number; remaining: number; priced: number; valued: number }>()
  let unpriced = 0
  for (const server of servers) {
    const converted = nonnegative(server.renewal_price_cny)
    const price = converted ?? nonnegative(server.renewal_price)
    const currency = converted !== undefined ? 'CNY' : server.renewal_currency?.trim().toUpperCase() || 'CNY'
    const months = CYCLE_MONTHS[server.renewal_cycle || 'month']
    if (price === undefined || !months) { unpriced++; continue }
    const group = currencies.get(currency) || { currency, monthly: 0, remaining: 0, priced: 0, valued: 0 }
    group.monthly += price / months
    group.priced++
    const end = expiryTimestamp(server)
    if (!isPermanent(server) && end !== undefined) {
      const days = CYCLE_DAYS[server.renewal_cycle || 'month']
      group.remaining += price / days * Math.max(0, Math.ceil((end - now) / 86400000))
      group.valued++
    }
    currencies.set(currency, group)
  }
  return { groups: [...currencies.values()].sort((a, b) => a.currency === b.currency ? 0 : a.currency === 'CNY' ? -1 : b.currency === 'CNY' ? 1 : a.currency.localeCompare(b.currency)), unpriced }
}
