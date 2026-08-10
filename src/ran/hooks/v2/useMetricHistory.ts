/**
 * useMetricHistory — generic single-value 24h history with sparkline
 * and yesterday-delta derivation.
 *
 * Used by AvgPacketLossCard, ThroughputSummaryCard, and any other top
 * card that wants:
 *   1. A real sparkline (last N points)
 *   2. A "vs yesterday" percent delta
 *
 * Why a single generic hook instead of N specialized hooks: the math
 * is the same for any monotonically-sampled metric. We just need a
 * stable key per metric so each one gets its own localStorage slot.
 *
 *   useMetricHistory('avgLoss', stats.avgLoss, { multiplier: 100 })
 *   useMetricHistory('throughputTotal', stats.totalNetUp + stats.totalNetDown)
 *
 * Storage shape:
 *   ran.v2.metric.{key} = [{ t: epoch_ms, v: number }, ...]
 *
 * Returns:
 *   spark:   compact array (latest 30 points) for sparkline rendering
 *   deltaPct: percentage change vs 24h-ago point (undefined if no point yet)
 */

import { useEffect, useMemo, useState } from 'react'

const DEFAULT_SAMPLE_EVERY_MS = 60 * 60 * 1000        // 1 hour
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000          // 7 days
const HARD_CAP_POINTS = 200
const SPARK_LENGTH = 30
const HOURS_24_MS = 24 * 60 * 60 * 1000
const HOURS_6_MS = 6 * 60 * 60 * 1000

interface Sample {
  t: number
  v: number
}

function storageKey(key: string): string {
  return `ran.v2.metric.${key}`
}

function loadHistory(key: string): Sample[] {
  try {
    const raw = localStorage.getItem(storageKey(key))
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.filter(
      (p) => p && typeof p.t === 'number' && typeof p.v === 'number',
    )
  } catch {
    return []
  }
}

function saveHistory(key: string, arr: Sample[]): void {
  try {
    localStorage.setItem(storageKey(key), JSON.stringify(arr))
  } catch {
    /* ignore */
  }
}

export interface UseMetricHistoryOptions {
  /** Sampling interval, default 1h */
  sampleEveryMs?: number
  /**
   * Multiplier applied to raw values when computing deltas. For loss
   * passed as 0..1 fraction, set to 100 so the delta reads as percent
   * points. For absolute byte counts, leave at 1.
   */
  multiplier?: number
}

export interface MetricHistoryResult {
  /** Compact series (oldest → newest) for sparkline rendering */
  spark: number[]
  /**
   * Percent change vs the sample closest to 24h ago, in raw % units.
   * Undefined when no comparison sample is available yet.
   */
  deltaPct?: number
  /** Total number of stored points (for diagnostics) */
  count: number
}

export function useMetricHistory(
  key: string,
  currentValue: number | undefined,
  options: UseMetricHistoryOptions = {},
): MetricHistoryResult {
  const sampleEveryMs = options.sampleEveryMs ?? DEFAULT_SAMPLE_EVERY_MS
  const [samples, setSamples] = useState<Sample[]>(() => loadHistory(key))

  useEffect(() => {
    if (typeof currentValue !== 'number' || !Number.isFinite(currentValue))
      return

    const now = Date.now()
    const last = samples[samples.length - 1]

    // Rate-limit: only sample if window elapsed
    if (last && now - last.t < sampleEveryMs) return

    const cutoff = now - RETENTION_MS
    const next = [
      ...samples.filter((s) => s.t >= cutoff),
      { t: now, v: currentValue },
    ]
    while (next.length > HARD_CAP_POINTS) next.shift()

    setSamples(next)
    saveHistory(key, next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentValue, sampleEveryMs, key])

  return useMemo(() => {
    // Sparkline: last N points, value-only
    const spark = samples.slice(-SPARK_LENGTH).map((s) => s.v)

    // Delta vs yesterday — find sample closest to 24h ago, within ±6h
    let deltaPct: number | undefined
    if (typeof currentValue === 'number' && samples.length >= 2) {
      const target = Date.now() - HOURS_24_MS
      let best: Sample | undefined
      let bestDt = Infinity
      for (const s of samples) {
        const dt = Math.abs(s.t - target)
        if (dt < bestDt) {
          bestDt = dt
          best = s
        }
      }
      if (best && bestDt < HOURS_6_MS && best.v !== 0) {
        deltaPct = ((currentValue - best.v) / Math.abs(best.v)) * 100
      }
    }

    return { spark, deltaPct, count: samples.length }
  }, [samples, currentValue])
}
