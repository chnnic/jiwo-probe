/**
 * useHealthTrend — tracks the cluster health score over time, building a
 * trend line for the Overview "HEALTH TREND" panel.
 *
 * Strategy: instead of fetching 7 days of history (which would require
 * heavy backend support that Komari doesn't have for derived scores), we
 * persist score snapshots to localStorage and build the trend client-side.
 *
 * Storage shape:
 *   ran.v2.healthTrend = [{ t: epoch_ms, score: 87 }, ...]
 *
 * Sampling:
 *   - One snapshot at most every `sampleEveryMs` (default 1h)
 *   - Older snapshots are evicted beyond `retentionMs` (default 7d)
 *
 * If localStorage isn't available (e.g. SSR, incognito quirk) the hook
 * silently degrades to an in-memory single-session trend.
 */

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'ran.v2.healthTrend'
const DEFAULT_SAMPLE_EVERY_MS = 60 * 60 * 1000           // 1 hour
const DEFAULT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000     // 7 days
const HARD_CAP_POINTS = 500                              // safety

export interface TrendPoint {
  t: number   // epoch ms
  score: number
}

function loadTrend(): TrendPoint[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.filter(
      (p) => p && typeof p.t === 'number' && typeof p.score === 'number',
    )
  } catch {
    return []
  }
}

function saveTrend(points: TrendPoint[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(points))
  } catch {
    // ignore — quota / privacy mode
  }
}

export interface UseHealthTrendOptions {
  sampleEveryMs?: number
  retentionMs?: number
}

/**
 * Append the current score to the trend (rate-limited) and return the
 * full series, ready for plotting.
 */
export function useHealthTrend(
  currentScore: number | undefined,
  options: UseHealthTrendOptions = {},
): TrendPoint[] {
  const sampleEveryMs = options.sampleEveryMs ?? DEFAULT_SAMPLE_EVERY_MS
  const retentionMs = options.retentionMs ?? DEFAULT_RETENTION_MS
  const [trend, setTrend] = useState<TrendPoint[]>(() => loadTrend())

  useEffect(() => {
    if (typeof currentScore !== 'number') return
    const now = Date.now()
    const last = trend[trend.length - 1]

    // Rate-limit: skip if we already sampled within sampleEveryMs.
    if (last && now - last.t < sampleEveryMs) return

    // Append + evict by retention + hard cap
    const cutoff = now - retentionMs
    const next = [...trend.filter((p) => p.t >= cutoff), { t: now, score: currentScore }]
    while (next.length > HARD_CAP_POINTS) next.shift()

    setTrend(next)
    saveTrend(next)
    // We deliberately read `trend` from the closure rather than as a dep —
    // listing it would cause an infinite loop. Effect runs on score change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScore, sampleEveryMs, retentionMs])

  return trend
}
