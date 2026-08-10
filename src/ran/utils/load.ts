import type { LoadHistory, LoadRecord } from '@/api/client'

/**
 * Bucket load records into evenly-spaced slots over the last `windowMs`.
 * Returns numeric arrays for each metric (already ordered chronologically),
 * with zero-fill for empty slots.
 */
export interface LoadSeries {
  cpu: number[]
  ram: number[]
  disk: number[]
  netIn: number[]
  netOut: number[]
  load: number[]
}

export interface TimedLoadSeries {
  data: number[]
  times: number[]
}

export interface TimedNetworkSeries {
  netIn: number[]
  netOut: number[]
  times: number[]
  hasIn: boolean
  hasOut: boolean
}

export type LoadMetric = 'cpu' | 'ram' | 'disk' | 'netIn' | 'netOut' | 'load'

function metricValue(record: LoadRecord, metric: LoadMetric): number | undefined {
  if (metric === 'cpu') return record.cpu
  if (metric === 'netIn') return record.net_in
  if (metric === 'netOut') return record.net_out
  if (metric === 'load') return record.load
  if (metric === 'ram') {
    if (record.ram == null) return undefined
    if (record.ram_total && record.ram_total > 0) return (record.ram / record.ram_total) * 100
    return record.ram <= 100 ? record.ram : undefined
  }
  if (record.disk == null) return undefined
  if (record.disk_total && record.disk_total > 0) return (record.disk / record.disk_total) * 100
  return record.disk <= 100 ? record.disk : undefined
}

/**
 * Preserve the timestamps actually returned by the backend. This is used by
 * detail charts so an unfilled 6H/24H window starts where collection really
 * started instead of manufacturing leading zero samples.
 */
export function timedLoadMetric(history: LoadHistory, metric: LoadMetric): TimedLoadSeries {
  const points = (history?.records ?? [])
    .map((record) => ({
      time: new Date(record.time).getTime(),
      value: metricValue(record, metric),
    }))
    .filter(
      (point): point is { time: number; value: number } =>
        Number.isFinite(point.time) && point.value != null && Number.isFinite(point.value),
    )
    .sort((a, b) => a.time - b.time)
  return {
    data: points.map((point) => point.value),
    times: points.map((point) => point.time),
  }
}

/** Network metrics share timestamps in MMWX system-series responses. */
export function timedNetwork(history: LoadHistory): TimedNetworkSeries {
  const records = (history?.records ?? [])
    .map((record) => ({
      time: new Date(record.time).getTime(),
      netIn: record.net_in,
      netOut: record.net_out,
    }))
    .filter(
      (record) =>
        Number.isFinite(record.time) &&
        (Number.isFinite(record.netIn) || Number.isFinite(record.netOut)),
    )
    .sort((a, b) => a.time - b.time)
  const hasIn = records.some((record) => Number.isFinite(record.netIn))
  const hasOut = records.some((record) => Number.isFinite(record.netOut))
  return {
    times: records.map((record) => record.time),
    netIn: records.map((record) => (Number.isFinite(record.netIn) ? record.netIn! : 0)),
    netOut: records.map((record) => (Number.isFinite(record.netOut) ? record.netOut! : 0)),
    hasIn,
    hasOut,
  }
}

export function bucketLoadHistory(
  history: LoadHistory,
  buckets = 60,
  windowMs = 60 * 60 * 1000,
): LoadSeries {
  const empty = (): number[] => new Array(buckets).fill(0)
  const counts = empty()
  const series: LoadSeries = {
    cpu: empty(),
    ram: empty(),
    disk: empty(),
    netIn: empty(),
    netOut: empty(),
    load: empty(),
  }

  if (!history?.records?.length) return series

  const now = Date.now()
  const start = now - windowMs
  const bucketMs = windowMs / buckets

  // Aggregate sums + counts
  const sums: LoadSeries = {
    cpu: empty(),
    ram: empty(),
    disk: empty(),
    netIn: empty(),
    netOut: empty(),
    load: empty(),
  }

  for (const r of history.records) {
    const t = new Date(r.time).getTime()
    if (!Number.isFinite(t) || t < start) continue
    const idx = Math.min(buckets - 1, Math.max(0, Math.floor((t - start) / bucketMs)))
    counts[idx] += 1
    if (r.cpu != null) sums.cpu[idx] += r.cpu
    // ram + disk: Komari historically stores absolute bytes here even though
    // some deployments emit percent. If value is bytes (>100 with a known
    // total), convert; if already a percent, pass through.
    if (r.ram != null) {
      const pct =
        r.ram <= 100
          ? r.ram
          : r.ram_total && r.ram_total > 0
            ? (r.ram / r.ram_total) * 100
            : 0
      sums.ram[idx] += pct
    }
    if (r.disk != null) {
      const pct =
        r.disk <= 100
          ? r.disk
          : r.disk_total && r.disk_total > 0
            ? (r.disk / r.disk_total) * 100
            : 0
      sums.disk[idx] += pct
    }
    if (r.net_in != null) sums.netIn[idx] += r.net_in
    if (r.net_out != null) sums.netOut[idx] += r.net_out
    if (r.load != null) sums.load[idx] += r.load
  }

  // Average each filled bucket; for empty buckets, forward-fill the previous
  // value so the curve stays continuous instead of dropping to 0. This fixes
  // the sawtooth seen on the 6H window, where bucket count exceeds the sample
  // count and >half the buckets would otherwise be zero-filled.
  const keys: (keyof LoadSeries)[] = ['cpu', 'ram', 'disk', 'netIn', 'netOut', 'load']
  const last: Record<string, number | null> = {
    cpu: null, ram: null, disk: null, netIn: null, netOut: null, load: null,
  }
  for (let i = 0; i < buckets; i++) {
    const n = counts[i]
    if (n > 0) {
      for (const k of keys) {
        const v = sums[k][i] / n
        series[k][i] = v
        last[k] = v
      }
    } else {
      // empty bucket — hold the previous value (forward-fill).
      // leading empties (no prior value) stay 0.
      for (const k of keys) {
        series[k][i] = last[k] ?? 0
      }
    }
  }

  return series
}

/** True if history has any records we can plot. */
export function hasLoadData(h: LoadHistory): boolean {
  return (h?.records?.length ?? 0) > 0
}

export type { LoadHistory, LoadRecord }
