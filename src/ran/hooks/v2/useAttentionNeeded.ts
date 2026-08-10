/**
 * useAttentionNeeded — pick the top-N nodes that most need operator attention.
 *
 * Severity scoring (additive — higher = more urgent):
 *
 *   100  offline                                  (highest priority)
 *    60  ping > 500ms  | 30  ping > 200ms
 *    50  loss > 20%    | 25  loss > 5%
 *    40  cpu > 95%     | 20  cpu > 80%
 *    35  mem > 95%     | 18  mem > 85%
 *    30  load > 8      | 15  load > 4
 *    25  disk > 95%    | 12  disk > 85%
 *    20  expiring < 3d | 10  expiring < 7d  |  5  expiring < 14d
 *
 * Each node carries:
 *  - score (number)
 *  - reasons (string[]) — human-readable bullets, e.g. "高延迟 (308ms)"
 *  - severity ('critical' | 'warning' | 'info')
 *
 * The top-N by score (default 5) is returned. Nodes with score 0 are dropped,
 * so when the cluster is happy this can return fewer than N.
 */

import { useMemo } from 'react'
import type { KomariNode, KomariRecord } from '@/types/komari'
import { daysUntil, resolveRamPercent } from '@/utils/format'

export type AttentionSeverity = 'critical' | 'warning' | 'info'

export interface AttentionItem {
  node: KomariNode
  record?: KomariRecord
  score: number
  severity: AttentionSeverity
  reasons: string[]
  /** ISO timestamp of the strongest issue's "last seen" — for the LAST SEEN column */
  lastSeenISO?: string
}

interface Hit {
  score: number
  reason: string
}

function severityFromScore(score: number): AttentionSeverity {
  if (score >= 70) return 'critical'
  if (score >= 25) return 'warning'
  return 'info'
}

/**
 * Format a number for display in a reason string with appropriate precision.
 * 308 → "308", 0.7 → "0.7", 14.2 → "14.2"
 */
function fmt(v: number, decimals = 1): string {
  if (Math.abs(v) >= 100) return Math.round(v).toString()
  return v.toFixed(decimals).replace(/\.?0+$/, '')
}

function scoreNode(node: KomariNode, record: KomariRecord | undefined): {
  score: number
  reasons: string[]
} {
  const hits: Hit[] = []

  // Offline trumps everything else
  if (!record || !record.online) {
    return { score: 100, reasons: ['离线'] }
  }

  // CPU
  if (typeof record.cpu === 'number') {
    if (record.cpu > 95) hits.push({ score: 40, reason: `CPU 使用率高 (${fmt(record.cpu, 0)}%)` })
    else if (record.cpu > 80) hits.push({ score: 20, reason: `CPU 偏高 (${fmt(record.cpu, 0)}%)` })
  }

  // Memory
  const memPct = resolveRamPercent(record.memory_used, record.memory_total)
  if (typeof memPct === 'number') {
    if (memPct > 95) hits.push({ score: 35, reason: `内存接近满载 (${fmt(memPct, 0)}%)` })
    else if (memPct > 85) hits.push({ score: 18, reason: `内存偏高 (${fmt(memPct, 0)}%)` })
  }

  // Load
  if (typeof record.load1 === 'number') {
    if (record.load1 > 8) hits.push({ score: 30, reason: `负载过高 (load ${fmt(record.load1)})` })
    else if (record.load1 > 4) hits.push({ score: 15, reason: `负载偏高 (load ${fmt(record.load1)})` })
  }

  // Disk
  if (record.disk_used && record.disk_total && record.disk_total > 0) {
    const diskPct = (record.disk_used / record.disk_total) * 100
    if (diskPct > 95) hits.push({ score: 25, reason: `磁盘接近满 (${fmt(diskPct, 0)}%)` })
    else if (diskPct > 85) hits.push({ score: 12, reason: `磁盘偏满 (${fmt(diskPct, 0)}%)` })
  }

  // Ping latency
  if (typeof record.ping === 'number' && record.ping > 0) {
    if (record.ping > 500) hits.push({ score: 60, reason: `高延迟 (${fmt(record.ping, 0)}ms)` })
    else if (record.ping > 200) hits.push({ score: 30, reason: `延迟偏高 (${fmt(record.ping, 0)}ms)` })
  }

  // Packet loss (percent 0..100)
  if (typeof record.loss === 'number') {
    if (record.loss > 20) hits.push({ score: 50, reason: `高丢包率 (${fmt(record.loss)}%)` })
    else if (record.loss > 5) hits.push({ score: 25, reason: `丢包率偏高 (${fmt(record.loss)}%)` })
  }

  // Expiry
  const days = daysUntil(node.expired_at)
  if (typeof days === 'number' && days >= 0) {
    if (days < 3) hits.push({ score: 20, reason: `即将到期 (${days} 天)` })
    else if (days < 7) hits.push({ score: 10, reason: `即将到期 (${days} 天)` })
    else if (days < 14) hits.push({ score: 5, reason: `即将到期 (${days} 天)` })
  }

  // Sort reasons by severity (most severe first) for nicer display
  hits.sort((a, b) => b.score - a.score)

  return {
    score: hits.reduce((sum, h) => sum + h.score, 0),
    reasons: hits.map((h) => h.reason),
  }
}

export interface UseAttentionNeededOptions {
  /** Top N to return (default 5) */
  topN?: number
}

export function useAttentionNeeded(
  nodes: KomariNode[],
  records: Record<string, KomariRecord>,
  options: UseAttentionNeededOptions = {},
): AttentionItem[] {
  const topN = options.topN ?? 5

  return useMemo(() => {
    const items: AttentionItem[] = []

    for (const node of nodes) {
      const record = records[node.uuid]
      const { score, reasons } = scoreNode(node, record)
      if (score <= 0) continue

      items.push({
        node,
        record,
        score,
        severity: severityFromScore(score),
        reasons,
        lastSeenISO: record?.updated_at,
      })
    }

    items.sort((a, b) => b.score - a.score)
    return items.slice(0, topN)
  }, [nodes, records, topN])
}
