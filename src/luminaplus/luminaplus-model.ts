import type { ProbeServer } from '../types'

export type LuminaPlusView = 'card' | 'compact' | 'list'
export function parseLuminaPlusView(value: unknown): LuminaPlusView {
  return value === 'compact' || value === 'list' ? value : 'card'
}

const nonnegative = (value?: number) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined

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
