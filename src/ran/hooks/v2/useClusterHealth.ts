/**
 * useClusterHealth — overall cluster health score 0..100.
 *
 * Formula (deterministic, explainable to users):
 *   score = onlineRatio    * 40    // 40 pts for online ratio
 *         + (1 - avgLoss)  * 30    // 30 pts for low packet loss
 *         + (1 - load/4)   * 20    // 20 pts for low load (load >= 4 → 0)
 *         + (1 - degradedRatio) * 10  // 10 pts for low degraded ratio
 *
 * Grade thresholds:
 *   >= 90 EXCELLENT
 *   80-89 GOOD
 *   60-79 FAIR
 *   <  60 POOR
 *
 * Missing components default to "perfect" (full points): e.g. if ping data
 * isn't loaded yet, avgLoss is treated as 0 (full 30 pts). This avoids
 * showing alarming dips during first paint.
 *
 * Designed to be readable and stable — no weighting magic that changes
 * over time. Same input → same score.
 */

import { useMemo } from 'react'
import type { AggregateStats } from './useAggregateStats'

export type HealthGrade = 'excellent' | 'good' | 'fair' | 'poor'

export interface ClusterHealth {
  /** Integer 0..100 */
  score: number
  grade: HealthGrade
  /** Per-component breakdown (each is the actual points contributed) */
  breakdown: {
    online: number      // 0..40
    loss: number        // 0..30
    load: number        // 0..20
    degraded: number    // 0..10
  }
}

export function gradeFor(score: number): HealthGrade {
  if (score >= 90) return 'excellent'
  if (score >= 80) return 'good'
  if (score >= 60) return 'fair'
  return 'poor'
}

export function useClusterHealth(stats: AggregateStats): ClusterHealth {
  return useMemo(() => {
    // Component 1: online ratio (40 pts max)
    const onlinePts = stats.onlineRatio * 40

    // Component 2: packet loss (30 pts max). If avgLoss is undefined,
    // assume best case (no loss data yet → full credit).
    const loss = stats.avgLoss ?? 0
    const lossPts = (1 - Math.min(1, Math.max(0, loss))) * 30

    // Component 3: load (20 pts max). load >= 4 → 0 pts.
    // Per-core load1 isn't normalized in Komari, but typical desktop/server
    // hardware sits at 1-2 idle, so 4 is a reasonable "saturation" threshold.
    const load = stats.avgLoad ?? 0
    const loadPts = Math.max(0, 1 - load / 4) * 20

    // Component 4: degraded ratio (10 pts max)
    const degradedPts = (1 - Math.min(1, stats.degradedRatio)) * 10

    const score = Math.round(onlinePts + lossPts + loadPts + degradedPts)
    const clamped = Math.max(0, Math.min(100, score))

    return {
      score: clamped,
      grade: gradeFor(clamped),
      breakdown: {
        online: Math.round(onlinePts * 10) / 10,
        loss: Math.round(lossPts * 10) / 10,
        load: Math.round(loadPts * 10) / 10,
        degraded: Math.round(degradedPts * 10) / 10,
      },
    }
  }, [stats.onlineRatio, stats.avgLoss, stats.avgLoad, stats.degradedRatio])
}
