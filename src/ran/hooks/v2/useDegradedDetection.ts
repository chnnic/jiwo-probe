/**
 * useDegradedDetection — sustained-state degraded detection for v2.
 *
 * Unlike isRecordDegraded (instantaneous snapshot in useAggregateStats),
 * this hook tracks a rolling buffer of recent CPU samples per node and
 * marks a node as degraded only if CPU stayed above the threshold for a
 * sustained window (default 5 minutes).
 *
 * Other degraded conditions (ping > 200ms, loss > 5%, mem > 90%) are
 * already inherently sustained — the ping/loss values come from a 60s
 * averaging window, so they're not flaky enough to need extra debouncing.
 *
 * Memory cost: 18 nodes * ~120 samples (5 min @ 2.5s) * (number + timestamp)
 *   ≈ 4 KB of in-memory state. Negligible.
 */

import { useEffect, useMemo, useRef } from 'react'
import type { KomariNode, KomariRecord } from '@/types/komari'
import { resolveRamPercent } from '@/utils/format'

interface CpuSample {
  t: number    // epoch ms
  v: number    // CPU percent 0..100
}

interface PerNodeBuffer {
  samples: CpuSample[]
}

export interface DegradedInfo {
  /** True if currently degraded (any of the conditions met) */
  degraded: boolean
  /** Reason flags */
  reasons: {
    sustainedHighCpu: boolean
    highMem: boolean
    highPing: boolean
    highLoss: boolean
  }
}

const DEFAULT_SUSTAINED_WINDOW_MS = 5 * 60 * 1000   // 5 minutes
const DEFAULT_CPU_THRESHOLD = 90                     // %
const DEFAULT_MEM_THRESHOLD = 90                     // %
const DEFAULT_PING_THRESHOLD = 200                   // ms
const DEFAULT_LOSS_THRESHOLD = 5                     // %
const MAX_SAMPLES_PER_NODE = 200                     // buffer cap

export interface UseDegradedDetectionOptions {
  sustainedWindowMs?: number
  cpuThreshold?: number
  memThreshold?: number
  pingThreshold?: number
  lossThreshold?: number
}

/**
 * Returns a map of uuid -> DegradedInfo for nodes that the buffer has seen.
 * Live updates as new records flow in.
 */
export function useDegradedDetection(
  nodes: KomariNode[],
  records: Record<string, KomariRecord>,
  options: UseDegradedDetectionOptions = {},
): Record<string, DegradedInfo> {
  const sustainedWindowMs = options.sustainedWindowMs ?? DEFAULT_SUSTAINED_WINDOW_MS
  const cpuThreshold = options.cpuThreshold ?? DEFAULT_CPU_THRESHOLD
  const memThreshold = options.memThreshold ?? DEFAULT_MEM_THRESHOLD
  const pingThreshold = options.pingThreshold ?? DEFAULT_PING_THRESHOLD
  const lossThreshold = options.lossThreshold ?? DEFAULT_LOSS_THRESHOLD

  /** Per-node CPU sample ring buffer */
  const buffers = useRef<Record<string, PerNodeBuffer>>({})

  // On each records change, append new CPU samples to buffer for each online node
  useEffect(() => {
    const now = Date.now()
    const cutoff = now - sustainedWindowMs

    for (const node of nodes) {
      const r = records[node.uuid]
      if (!r || !r.online || typeof r.cpu !== 'number') continue

      const buf = buffers.current[node.uuid] ?? { samples: [] }
      buf.samples.push({ t: now, v: r.cpu })

      // Drop samples older than the sustained window
      while (buf.samples.length > 0 && buf.samples[0].t < cutoff) {
        buf.samples.shift()
      }
      // Hard cap to prevent runaway memory if something weird happens
      while (buf.samples.length > MAX_SAMPLES_PER_NODE) {
        buf.samples.shift()
      }

      buffers.current[node.uuid] = buf
    }

    // Clean up buffers for nodes that no longer exist
    const liveUuids = new Set(nodes.map((n) => n.uuid))
    for (const uuid of Object.keys(buffers.current)) {
      if (!liveUuids.has(uuid)) delete buffers.current[uuid]
    }
  }, [nodes, records, sustainedWindowMs])

  // Derive degraded info synchronously from latest records + buffers
  return useMemo(() => {
    const out: Record<string, DegradedInfo> = {}
    const now = Date.now()
    const cutoff = now - sustainedWindowMs

    for (const node of nodes) {
      const r = records[node.uuid]
      if (!r || !r.online) continue

      // Sustained high CPU: every sample in the window above threshold
      // AND we have at least 60% of the expected sample count
      // (avoids false positives right after agent reconnects)
      const buf = buffers.current[node.uuid]
      let sustainedHighCpu = false
      if (buf) {
        const inWindow = buf.samples.filter((s) => s.t >= cutoff)
        // Expect roughly one sample per 2.5s — so 5min ≈ 120 samples;
        // require at least 60% of that for a confident reading.
        const expected = Math.ceil(sustainedWindowMs / 2500)
        const minSamples = Math.max(8, Math.ceil(expected * 0.6))
        if (inWindow.length >= minSamples) {
          sustainedHighCpu = inWindow.every((s) => s.v > cpuThreshold)
        }
      }

      const memPct = resolveRamPercent(r.memory_used, r.memory_total)
      const highMem = typeof memPct === 'number' && memPct > memThreshold
      const highPing = typeof r.ping === 'number' && r.ping > pingThreshold
      const highLoss = typeof r.loss === 'number' && r.loss > lossThreshold

      const degraded = sustainedHighCpu || highMem || highPing || highLoss

      out[node.uuid] = {
        degraded,
        reasons: { sustainedHighCpu, highMem, highPing, highLoss },
      }
    }

    return out
  }, [
    nodes,
    records,
    sustainedWindowMs,
    cpuThreshold,
    memThreshold,
    pingThreshold,
    lossThreshold,
  ])
}
