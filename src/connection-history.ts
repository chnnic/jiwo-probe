import type { ProbeServer } from './types'

export const CONNECTION_SAMPLE_SECONDS = 30
export const CONNECTION_RETENTION_SECONDS = 24 * 3600
const MAX_POINTS = CONNECTION_RETENTION_SECONDS / CONNECTION_SAMPLE_SECONDS + 1
type ConnectionServer = Pick<ProbeServer, 'name' | 'online' | 'tcp_connections' | 'udp_connections'>
export type ConnectionSample = { ts: number; tcp: number | null; udp: number | null }
export type ConnectionHistory = ReadonlyMap<string, readonly ConnectionSample[]>

// Probe APIs identify nodes by index. Include the visible name to discard samples
// when a different node occupies that index; never mix two nodes' histories.
export const connectionHistoryKey = (server: Pick<ProbeServer, 'name'>, index: number) => JSON.stringify([index, server.name || ''])
const count = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null

/** Only called on received snapshots, never by a timer. Memory-only, not persisted. */
export function recordConnectionSnapshot(previous: ConnectionHistory, servers: readonly ConnectionServer[], receivedAt: number): ConnectionHistory {
  if (!Number.isFinite(receivedAt) || receivedAt <= 0) return previous
  const ts = Math.floor(receivedAt)
  const cutoff = ts - CONNECTION_RETENTION_SECONDS
  const next = new Map<string, readonly ConnectionSample[]>()
  let changed = false
  servers.forEach((server, index) => {
    const key = connectionHistoryKey(server, index)
    const points = previous.get(key) || []
    const last = points.at(-1)
    // A render, duplicate delivery or fast push does not create extra points.
    if (last && ts - last.ts < CONNECTION_SAMPLE_SECONDS) {
      next.set(key, points)
      return
    }
    const samples = points.filter(point => point.ts >= cutoff)
    // A disconnected/backgrounded page must not draw a continuous line through
    // an unobserved interval. This null marks a gap, not a zero measurement.
    if (last && ts - last.ts > CONNECTION_SAMPLE_SECONDS * 3 && last.ts + CONNECTION_SAMPLE_SECONDS >= cutoff) {
      samples.push({ ts: last.ts + CONNECTION_SAMPLE_SECONDS, tcp: null, udp: null })
    }
    samples.push({ ts, tcp: server.online ? count(server.tcp_connections) : null, udp: server.online ? count(server.udp_connections) : null })
    next.set(key, samples.slice(-MAX_POINTS))
    changed = true
  })
  // Also forget removed nodes. There is no disk cache or cross-visitor storage.
  return changed || next.size !== previous.size ? next : previous
}

export function connectionRows(points: readonly ConnectionSample[], rangeHours: number): ConnectionSample[] {
  const end = points.at(-1)?.ts
  if (end === undefined || !Number.isFinite(rangeHours) || rangeHours <= 0) return []
  return points.filter(point => point.ts >= end - rangeHours * 3600)
}
