/**
 * useRegionDistribution — aggregate nodes by region for the Overview
 * "REGION DISTRIBUTION" donut chart.
 *
 * Region is read from KomariNode.region directly. We sort by count desc
 * and merge tiny slices (< minRatio) into an "其他" bucket so the donut
 * stays readable.
 *
 * Assigns each slice a stable color from a small palette (looped).
 */

import { useMemo } from 'react'
import type { KomariNode } from '@/types/komari'

export interface RegionSlice {
  /** Region name (e.g. "深圳", "香港", or "其他") */
  name: string
  count: number
  /** Fraction of total (0..1) */
  ratio: number
  /** Stable color for this slice (CSS color string) */
  color: string
  /** True if this slice merges multiple small regions */
  isOther?: boolean
}

const DEFAULT_PALETTE = [
  '#3a5d8f', // info blue
  '#4a8a64', // good green
  '#a06820', // accent
  '#c28840', // accent bright
  '#7a4f18', // accent dim
  '#9b6e8c', // muted purple
  '#807866', // fg-3 (neutral)
]

const OTHER_COLOR = '#807866'
const UNASSIGNED_NAME = '未分配'

export interface UseRegionDistributionOptions {
  /** Min fraction to keep as own slice (default 0.05 = 5%) */
  minRatio?: number
  /** Custom color palette */
  palette?: string[]
}

export function useRegionDistribution(
  nodes: KomariNode[],
  options: UseRegionDistributionOptions = {},
): RegionSlice[] {
  const minRatio = options.minRatio ?? 0.05
  const palette = options.palette ?? DEFAULT_PALETTE

  return useMemo(() => {
    if (nodes.length === 0) return []

    const buckets: Record<string, number> = {}
    for (const n of nodes) {
      const key = (n.region ?? '').trim() || UNASSIGNED_NAME
      buckets[key] = (buckets[key] ?? 0) + 1
    }

    const total = nodes.length
    const entries = Object.entries(buckets)
      .map(([name, count]) => ({ name, count, ratio: count / total }))
      .sort((a, b) => b.count - a.count)

    // Separate "big enough" slices from the long tail
    const big = entries.filter((e) => e.ratio >= minRatio)
    const small = entries.filter((e) => e.ratio < minRatio)

    const slices: RegionSlice[] = big.map((e, i) => ({
      name: e.name,
      count: e.count,
      ratio: e.ratio,
      color: palette[i % palette.length],
    }))

    if (small.length > 0) {
      const otherCount = small.reduce((s, e) => s + e.count, 0)
      slices.push({
        name: '其他',
        count: otherCount,
        ratio: otherCount / total,
        color: OTHER_COLOR,
        isOther: true,
      })
    }

    return slices
  }, [nodes, minRatio, palette])
}
