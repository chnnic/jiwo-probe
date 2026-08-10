/**
 * useAlertHistory — track total active alert count over the last 24 hours
 * by sampling useAlertSummary's counts.total at regular intervals.
 *
 * Approach (same shape as useHealthTrend):
 *   - Sample once per `sampleEveryMs` (default 1 hour) when the current
 *     count changes from the previous sample
 *   - Persist to localStorage under `ran.v2.alertHistory`
 *   - Evict points older than 24h on every read
 *   - Return a fixed-length 12-bucket series for the ActiveAlertsCard
 *     24h volume bars (each bucket = 2 hours)
 *
 * The 12-bucket aggregation lets the UI render a stable visual regardless
 * of how many raw samples we have — early in the day there are few
 * samples but the bar viz still looks intentional.
 */

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'ran.v2.alertHistory'
const DEFAULT_SAMPLE_EVERY_MS = 60 * 60 * 1000      // 1 hour
const RETENTION_MS = 24 * 60 * 60 * 1000            // 24 hours
const HARD_CAP_POINTS = 100
const BUCKETS = 12                                  // 24h / 12 = 2h per bucket
const BUCKET_MS = RETENTION_MS / BUCKETS

interface Sample {
  t: number
  count: number
}

function loadHistory(): Sample[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.filter(
      (p) => p && typeof p.t === 'number' && typeof p.count === 'number',
    )
  } catch {
    return []
  }
}

function saveHistory(arr: Sample[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr))
  } catch {
    /* ignore */
  }
}

/**
 * Bucket raw samples into a 12-slot 24h series.
 * Each slot holds the MAX count seen in its 2-hour window (alerts are
 * "active" counts — peaks are what matter, not averages).
 */
function bucketize(samples: Sample[]): number[] {
  const now = Date.now()
  const windowStart = now - RETENTION_MS
  const buckets = new Array(BUCKETS).fill(0)

  for (const s of samples) {
    if (s.t < windowStart) continue
    const idx = Math.min(
      BUCKETS - 1,
      Math.floor((s.t - windowStart) / BUCKET_MS),
    )
    if (s.count > buckets[idx]) buckets[idx] = s.count
  }

  return buckets
}

export interface UseAlertHistoryOptions {
  sampleEveryMs?: number
}

/**
 * Returns a 12-bucket 24h alert volume series, ready for the
 * ActiveAlertsCard mini bar chart.
 */
export function useAlertHistory(
  currentCount: number,
  options: UseAlertHistoryOptions = {},
): number[] {
  const sampleEveryMs = options.sampleEveryMs ?? DEFAULT_SAMPLE_EVERY_MS
  const [samples, setSamples] = useState<Sample[]>(() => loadHistory())

  useEffect(() => {
    const now = Date.now()
    const last = samples[samples.length - 1]

    // Sample if:
    //   1. No prior sample, OR
    //   2. Count changed (always capture transitions), OR
    //   3. Rate-limit window elapsed
    const shouldSample =
      !last || last.count !== currentCount || now - last.t >= sampleEveryMs

    if (!shouldSample) return

    const cutoff = now - RETENTION_MS
    const next = [
      ...samples.filter((s) => s.t >= cutoff),
      { t: now, count: currentCount },
    ]
    while (next.length > HARD_CAP_POINTS) next.shift()

    setSamples(next)
    saveHistory(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCount, sampleEveryMs])

  return bucketize(samples)
}
