import type { ProbePingSeries } from './types'

export type HistoryRange = '1h' | '6h' | '24h'
export interface HistoryPoint { x: number; y: number | null }
export interface MetricPoint { t: number; value: number | null }
export type SystemHistory = Partial<Record<'cpu_pct' | 'mem_used' | 'mem_total' | 'upload_speed' | 'download_speed' | 'tcp_connections' | 'udp_connections', MetricPoint[]>>
export interface PingHistory {
  series?: ProbePingSeries
  all_series?: ProbePingSeries[]
  generated_at?: number
  bucket_sec?: number
}

export function historyValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

export function metricPoints(points: MetricPoint[] = []): HistoryPoint[] {
  return points
    .filter((point) => Number.isFinite(point.t) && point.t > 0)
    .map((point) => ({ x: point.t * 1000, y: historyValue(point.value) }))
    .sort((a, b) => a.x - b.x)
}

export function memoryPoints(history: SystemHistory): HistoryPoint[] {
  const totals = new Map((history.mem_total || []).map((point) => [point.t * 1000, historyValue(point.value)]))
  return metricPoints(history.mem_used).map((point) => {
    const total = totals.get(point.x)
    return { x: point.x, y: point.y !== null && total != null && total > 0 ? point.y / total * 100 : null }
  })
}

export function pingPoints(series: ProbePingSeries, mode: 'latency' | 'loss', payload: PingHistory, range: HistoryRange, receivedAt: number): HistoryPoint[] {
  const fallbackBucket = range === '1h' ? 300 : range === '6h' ? 600 : 1800
  const bucket = typeof payload.bucket_sec === 'number' && payload.bucket_sec > 0 && Number.isFinite(payload.bucket_sec) ? payload.bucket_sec : fallbackBucket
  const generated = typeof payload.generated_at === 'number' && payload.generated_at > 0 && Number.isFinite(payload.generated_at) ? payload.generated_at : receivedAt
  const end = generated - generated % bucket
  return series.buckets.map((point, index) => ({
    x: (end - (series.buckets.length - 1 - index) * bucket) * 1000,
    y: historyValue(mode === 'loss' ? point?.loss : point?.ms),
  }))
}
