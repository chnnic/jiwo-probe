/**
 * Traffic quota — derived purely from Komari's own fields.
 *
 * MMWX owns the entire traffic pipeline; the theme only renders it. The
 * authoritative `traffic_used` value has already been calculated using the
 * server's configured accounting mode. Cumulative NIC counters are a separate
 * metric and must never be substituted for billing-period usage.
 *
 * We invent nothing: no parsing of the free-text `tags` label (users may
 * write anything there — it is decoration, not data), no local accumulation,
 * no guessing at the reset day. A limit of 0 means unlimited, and Komari's
 * own admin UI says as much ("设置为 0 B 禁用"), so we hide the bar entirely.
 */
import type { KomariNode, KomariRecord } from '@/types/komari'

export interface TrafficQuota {
  /** Bytes counted against the limit, per the node's comparison mode. */
  used: number
  /** Threshold in bytes (always > 0 here). */
  limit: number
  /** used / limit, clamped to [0, 1] for bar geometry. */
  ratio: number
  /** Uncapped percentage — may exceed 100 when over quota. */
  percent: number
  /** Whether usage came pre-calculated by MMWX or from the legacy fallback. */
  mode: 'reported' | 'max' | 'sum'
  /** Current-period split, when the API reports it. */
  up?: number
  down?: number
  /** Severity band, drives bar color. */
  level: 'ok' | 'warn' | 'crit'
  /** Billing period end (ISO), for showing days-until-reset. */
  periodEnd?: string
}

/**
 * Returns undefined when the node has no traffic threshold configured
 * (unlimited) or when the counters have not been reported yet — callers
 * render nothing in that case.
 */
export function computeTrafficQuota(
  node: KomariNode,
  record?: KomariRecord,
): TrafficQuota | undefined {
  const limit = node.traffic_limit ?? 0
  if (!Number.isFinite(limit) || limit <= 0) return undefined

  const reported = node.traffic_used
  let mode: TrafficQuota['mode']
  let used: number
  let up: number | undefined
  let down: number | undefined

  if (typeof reported === 'number' && Number.isFinite(reported) && reported >= 0) {
    mode = 'reported'
    used = reported
    up = typeof node.traffic_used_up === 'number' && Number.isFinite(node.traffic_used_up)
      ? node.traffic_used_up
      : undefined
    down = typeof node.traffic_used_down === 'number' && Number.isFinite(node.traffic_used_down)
      ? node.traffic_used_down
      : undefined
  } else {
    const cumulativeUp = record?.network_total_up
    const cumulativeDown = record?.network_total_down
    if (
      typeof cumulativeUp !== 'number' || !Number.isFinite(cumulativeUp) ||
      typeof cumulativeDown !== 'number' || !Number.isFinite(cumulativeDown)
    ) return undefined
    up = cumulativeUp
    down = cumulativeDown
    mode = node.traffic_limit_type === 'sum' ? 'sum' : 'max'
    used = mode === 'sum' ? cumulativeUp + cumulativeDown : Math.max(cumulativeUp, cumulativeDown)
  }

  const percent = (used / limit) * 100
  const ratio = Math.min(1, Math.max(0, used / limit))
  const level: TrafficQuota['level'] = percent >= 85 ? 'crit' : percent >= 60 ? 'warn' : 'ok'

  return { used, limit, ratio, percent, mode, up, down, level, periodEnd: node.period_end }
}

/** Bar fill color for a severity band. */
export function trafficColor(level: TrafficQuota['level']): string {
  if (level === 'crit') return 'var(--signal-bad)'
  if (level === 'warn') return 'var(--signal-warn)'
  return 'var(--signal-good)'
}

/**
 * Percent label, kept readable at both extremes: two decimals while the bar
 * is still a sliver (0.04% reads better than 0%), one below ten, none above.
 */
export function formatTrafficPercent(percent: number): string {
  if (percent > 0 && percent < 1) return `${percent.toFixed(2)}%`
  if (percent < 10) return `${percent.toFixed(1)}%`
  return `${percent.toFixed(0)}%`
}
