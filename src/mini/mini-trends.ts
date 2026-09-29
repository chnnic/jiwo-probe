import type { ProbePingSeries } from '../types'

export const MINI_RANGES = [
  { key: '1h', label: '1小时', bucketSec: 300 },
  { key: '6h', label: '6小时', bucketSec: 600 },
  { key: '24h', label: '24小时', bucketSec: 1800 },
] as const
export type MiniRange = typeof MINI_RANGES[number]['key']
export type MetricPoint = { t: number; value: number | null }
export type SystemSeries = Partial<Record<'cpu_pct' | 'mem_used' | 'mem_total' | 'upload_speed' | 'download_speed' | 'tcp_connections' | 'udp_connections', MetricPoint[]>>
export type TrendRow = { ts: number; [key: string]: number | null }
export const trendValue = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null

/** Align independent metrics by timestamp, never by array index. Missing is not zero. */
export function systemTrendRows(series: SystemSeries): TrendRow[] {
  const byTime = new Map<number, TrendRow>()
  for (const [metric, points] of Object.entries(series)) {
    for (const point of points || []) {
      if (!Number.isFinite(point.t) || point.t <= 0) continue
      const row = byTime.get(point.t) || { ts: point.t }
      row[metric] = trendValue(point.value)
      byTime.set(point.t, row)
    }
  }
  return [...byTime.values()].sort((a, b) => a.ts - b.ts).map(row => ({
    ts: row.ts, cpu: row.cpu_pct ?? null,
    mem: row.mem_used != null && row.mem_total != null && row.mem_total > 0 ? row.mem_used / row.mem_total * 100 : null,
    download: row.download_speed ?? null, upload: row.upload_speed ?? null,
    tcp: row.tcp_connections ?? null, udp: row.udp_connections ?? null,
  }))
}

/** Master-side bucket averages only. Missing buckets break lines, never become zero. */
export function connectionTrendRows(series: SystemSeries, bucketSec: number): TrendRow[] {
  const rows = systemTrendRows({ tcp_connections: series.tcp_connections, udp_connections: series.udp_connections })
    .map(({ ts, tcp, udp }) => ({ ts, tcp, udp }))
  if (!Number.isFinite(bucketSec) || bucketSec <= 0) return rows
  return rows.flatMap((row, index) => {
    const previous = rows[index - 1]
    return previous && row.ts - previous.ts > bucketSec
      ? [{ ts: previous.ts + bucketSec, tcp: null, udp: null }, row]
      : [row]
  })
}

// Display rounded counts while preserving the controller's original bucket averages.
export const formatConnectionAverage = (value: number) => value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })

/** Buckets end at the same instant; align shorter histories to the right. */
export function pingTrendRows(series: ProbePingSeries[], generatedAt: number, bucketSec: number, mode: 'latency' | 'loss'): TrendRow[] {
  if (!Number.isFinite(generatedAt) || generatedAt <= 0 || !Number.isFinite(bucketSec) || bucketSec <= 0) return []
  const length = Math.max(0, ...series.map(line => line.buckets.length))
  const end = generatedAt - generatedAt % bucketSec
  return Array.from({ length }, (_, index) => {
    const row: TrendRow = { ts: end - (length - 1 - index) * bucketSec }
    series.forEach((line, slot) => {
      const bucket = line.buckets[index - (length - line.buckets.length)]
      const value = trendValue(mode === 'loss' ? bucket?.loss : bucket?.ms)
      row[`line${slot}`] = mode === 'loss' && value !== null ? Math.min(100, value) : value
    })
    return row
  })
}
