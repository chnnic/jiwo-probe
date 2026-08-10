/**
 * useAlertSummary — derive an alert summary from current node state.
 *
 * Komari has no native alerting system, so we generate alerts client-side
 * from instantaneous metrics. Each alert is one of:
 *   critical  — node offline, high loss > 20%, high latency > 500ms
 *   warning   — degraded conditions (cpu > 90%, mem > 90%, latency > 200ms,
 *               loss > 5%, load > 4), expiring < 7d
 *   info      — expiring 7-30d, minor issues
 *
 * Each node can generate at most ONE alert (the most severe).
 * Returns counts + top N actual alerts for display.
 */

import { useMemo } from 'react'
import type { KomariNode, KomariRecord } from '@/types/komari'
import { daysUntil, resolveRamPercent } from '@/utils/format'

export type AlertLevel = 'critical' | 'warning' | 'info'

export interface AlertItem {
  uuid: string
  name: string
  level: AlertLevel
  /** Short title — e.g. "节点离线" */
  title: string
  /** Optional extra context — e.g. "持续 10 分钟" */
  detail?: string
  /** ISO timestamp of relevant data point */
  timestampISO?: string
}

export interface AlertSummary {
  /** Counts by level */
  counts: {
    critical: number
    warning: number
    info: number
    total: number
  }
  /** Top N alerts, severity-sorted (default 5) */
  alerts: AlertItem[]
}

interface AlertCandidate {
  level: AlertLevel
  title: string
  detail?: string
  /** Internal severity score for sorting (higher = more severe) */
  score: number
}

function evalNode(node: KomariNode, record: KomariRecord | undefined): AlertCandidate | null {
  // Offline = critical
  if (!record || !record.online) {
    return { level: 'critical', title: '节点离线', detail: undefined, score: 100 }
  }

  // High packet loss
  if (typeof record.loss === 'number' && record.loss > 20) {
    return {
      level: 'critical',
      title: '高丢包率',
      detail: `丢包 ${record.loss.toFixed(1)}%`,
      score: 90,
    }
  }

  // High latency (critical)
  if (typeof record.ping === 'number' && record.ping > 500) {
    return {
      level: 'critical',
      title: '高延迟',
      detail: `延迟 ${Math.round(record.ping)}ms`,
      score: 85,
    }
  }

  // High CPU
  if (typeof record.cpu === 'number' && record.cpu > 95) {
    return {
      level: 'warning',
      title: 'CPU 使用率高',
      detail: `${Math.round(record.cpu)}%`,
      score: 60,
    }
  }

  // High memory
  const memPct = resolveRamPercent(record.memory_used, record.memory_total)
  if (typeof memPct === 'number' && memPct > 95) {
    return {
      level: 'warning',
      title: '内存接近满载',
      detail: `${Math.round(memPct)}%`,
      score: 55,
    }
  }

  // Moderate latency / loss
  if (typeof record.ping === 'number' && record.ping > 200) {
    return {
      level: 'warning',
      title: '延迟升高',
      detail: `${Math.round(record.ping)}ms`,
      score: 50,
    }
  }
  if (typeof record.loss === 'number' && record.loss > 5) {
    return {
      level: 'warning',
      title: '丢包率偏高',
      detail: `${record.loss.toFixed(1)}%`,
      score: 48,
    }
  }

  // High load
  if (typeof record.load1 === 'number' && record.load1 > 4) {
    return {
      level: 'warning',
      title: '负载偏高',
      detail: `load ${record.load1.toFixed(2)}`,
      score: 40,
    }
  }

  // Expiry warning
  const days = daysUntil(node.expired_at)
  if (typeof days === 'number' && days >= 0) {
    if (days < 7) {
      return {
        level: 'warning',
        title: '即将到期',
        detail: `${days} 天`,
        score: 45,
      }
    }
    if (days < 30) {
      return {
        level: 'info',
        title: '即将到期',
        detail: `${days} 天`,
        score: 20,
      }
    }
  }

  return null
}

export interface UseAlertSummaryOptions {
  topN?: number
}

export function useAlertSummary(
  nodes: KomariNode[],
  records: Record<string, KomariRecord>,
  options: UseAlertSummaryOptions = {},
): AlertSummary {
  const topN = options.topN ?? 5

  return useMemo(() => {
    const counts = { critical: 0, warning: 0, info: 0, total: 0 }
    const items: Array<AlertItem & { score: number }> = []

    for (const node of nodes) {
      const r = records[node.uuid]
      const c = evalNode(node, r)
      if (!c) continue

      counts[c.level] += 1
      counts.total += 1
      items.push({
        uuid: node.uuid,
        name: node.name ?? node.uuid.slice(0, 8),
        level: c.level,
        title: c.title,
        detail: c.detail,
        timestampISO: r?.updated_at,
        score: c.score,
      })
    }

    items.sort((a, b) => b.score - a.score)
    // strip internal `score` from public type
    const alerts: AlertItem[] = items.slice(0, topN).map((i) => ({
      uuid: i.uuid,
      name: i.name,
      level: i.level,
      title: i.title,
      detail: i.detail,
      timestampISO: i.timestampISO,
    }))

    return { counts, alerts }
  }, [nodes, records, topN])
}
