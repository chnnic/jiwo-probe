/**
 * useAggregateStats — cluster-wide aggregate metrics for v2 Overview & Nodes.
 *
 * Reads live nodes + records from useKomari and derives:
 *  - total / online / offline / degraded counts
 *  - average CPU / memory / disk / load / ping / loss (across online nodes only)
 *  - aggregate throughput (sum of network_tx / network_rx)
 *  - expiring-soon count (nodes with billing expiry within `expiringWithinDays`)
 *
 * Degraded definition (per v2 spec):
 *   ONLINE node with ANY of:
 *     - CPU > 90%
 *     - RAM > 90%
 *     - latency > 200ms
 *     - packet loss > 5%
 *   (CPU-sustained-5min check belongs in useDegradedDetection — this hook
 *    uses the instantaneous snapshot.)
 *
 * All derivations are memoized on the input refs, so consumers can call
 * this anywhere without performance worry.
 */

import { useMemo } from 'react'
import type { KomariNode, KomariRecord } from '@/types/komari'
import { daysUntil, resolveRamPercent } from '@/utils/format'

export interface AggregateStats {
  /** Node counts */
  total: number
  online: number
  offline: number
  degraded: number
  /** Percentage of nodes online (0..1) */
  onlineRatio: number
  /** Percentage of online nodes that are degraded (0..1) */
  degradedRatio: number

  /** Averages across online nodes (undefined if zero online) */
  avgCpu?: number       // 0..100
  avgMem?: number       // 0..100
  avgDisk?: number      // 0..100
  avgLoad?: number      // raw load1 average
  avgPing?: number      // ms
  avgLoss?: number      // 0..1 (fraction, NOT percent)

  /** Sum of instantaneous bandwidth across online nodes (bytes/s) */
  totalTx: number
  totalRx: number

  /** Sum of cumulative since-boot bytes across all known nodes */
  totalNetUp: number
  totalNetDown: number

  /** Count of nodes whose billing expires within the configured window */
  expiringSoon: number
}

export interface UseAggregateStatsOptions {
  /** Days threshold for "expiring soon" (default 30) */
  expiringWithinDays?: number
}

/** Quick check: is this online record currently in a "degraded" state? */
export function isRecordDegraded(rec: KomariRecord | undefined): boolean {
  if (!rec || !rec.online) return false
  if (typeof rec.cpu === 'number' && rec.cpu > 90) return true
  const memPct = resolveRamPercent(rec.memory_used, rec.memory_total)
  if (typeof memPct === 'number' && memPct > 90) return true
  if (typeof rec.ping === 'number' && rec.ping > 200) return true
  // loss field is a percent (0..100), threshold 5%
  if (typeof rec.loss === 'number' && rec.loss > 5) return true
  return false
}

/**
 * Average a numeric field across an array of records, ignoring missing values.
 * Returns undefined if no record has the field.
 */
function avgField<T>(items: T[], pick: (r: T) => number | undefined): number | undefined {
  let sum = 0
  let n = 0
  for (const item of items) {
    const v = pick(item)
    if (typeof v === 'number' && Number.isFinite(v)) {
      sum += v
      n += 1
    }
  }
  if (n === 0) return undefined
  return sum / n
}

/** Sum a numeric field, ignoring missing values. */
function sumField<T>(items: T[], pick: (r: T) => number | undefined): number {
  let sum = 0
  for (const item of items) {
    const v = pick(item)
    if (typeof v === 'number' && Number.isFinite(v)) sum += v
  }
  return sum
}

export function useAggregateStats(
  nodes: KomariNode[],
  records: Record<string, KomariRecord>,
  options: UseAggregateStatsOptions = {},
): AggregateStats {
  const expiringWithinDays = options.expiringWithinDays ?? 30

  return useMemo(() => {
    const total = nodes.length
    const onlineRecs: KomariRecord[] = []
    let offline = 0
    let degraded = 0

    for (const n of nodes) {
      const r = records[n.uuid]
      if (r?.online) {
        onlineRecs.push(r)
        if (isRecordDegraded(r)) degraded += 1
      } else {
        offline += 1
      }
    }

    const online = onlineRecs.length
    const onlineRatio = total > 0 ? online / total : 0
    const degradedRatio = online > 0 ? degraded / online : 0

    // Compute avg CPU/MEM/DISK/load/ping/loss over online nodes only
    const avgCpu = avgField(onlineRecs, (r) => r.cpu)
    const avgMem = avgField(onlineRecs, (r) =>
      resolveRamPercent(r.memory_used, r.memory_total),
    )
    const avgDisk = avgField(onlineRecs, (r) => {
      if (!r.disk_used || !r.disk_total || r.disk_total <= 0) return undefined
      return (r.disk_used / r.disk_total) * 100
    })
    const avgLoad = avgField(onlineRecs, (r) => r.load1)
    const avgPing = avgField(onlineRecs, (r) => r.ping)
    // loss in our normalized record is percent (0..100); we expose as fraction
    const avgLossPct = avgField(onlineRecs, (r) => r.loss)
    const avgLoss = typeof avgLossPct === 'number' ? avgLossPct / 100 : undefined

    const totalTx = sumField(onlineRecs, (r) => r.network_tx)
    const totalRx = sumField(onlineRecs, (r) => r.network_rx)

    // Cumulative is sensible to sum across ALL records (online or stale),
    // because totals don't reset on disconnect — they reset only on agent reboot.
    const allRecs = Object.values(records)
    const totalNetUp = sumField(allRecs, (r) => r.network_total_up)
    const totalNetDown = sumField(allRecs, (r) => r.network_total_down)

    // Expiring soon — uses expired_at from node metadata (NOT records)
    let expiringSoon = 0
    for (const n of nodes) {
      const days = daysUntil(n.expired_at)
      if (typeof days === 'number' && days >= 0 && days <= expiringWithinDays) {
        expiringSoon += 1
      }
    }

    return {
      total,
      online,
      offline,
      degraded,
      onlineRatio,
      degradedRatio,
      avgCpu,
      avgMem,
      avgDisk,
      avgLoad,
      avgPing,
      avgLoss,
      totalTx,
      totalRx,
      totalNetUp,
      totalNetDown,
      expiringSoon,
    }
  }, [nodes, records, expiringWithinDays])
}
