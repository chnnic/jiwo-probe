// ProbeHub 实时推送的增量帧（Worker 编码、前端解码共用）。
//
// 线上实测（56 台）：每 3 秒一帧约 480 KB，其中 ping 占 200 KB、unlocks 105 KB、daily_traffic 60 KB，
// 但 unlocks / return_routes 几乎不变，ping 每个目标只有 current_ms、loss_pct 和最后一个桶在变，
// daily_traffic 只有当天那一行在变。增量帧对这些数组只发「不变 / 换最后一项 / 整体左移一格」，
// 其余字段照常完整发送。
//
// 增量是相对「同一条连接上一帧」的：ProbeHub 新连接先发完整帧，之后才发增量帧；
// 任何对不上的情况（服务器增减、换序、目标变化）都退回完整字段，解码失败时前端断线重连拿完整帧。
// 只有在 /api/stream?delta=1 声明支持的连接才会收到增量帧，旧页面和主控直连兜底不受影响。

import type { ProbePayload, ProbeServer } from './types'

export const PROBE_DELTA_VERSION = 1

/** 数组相对上一帧的变化：0 不变；{ t } 只换最后一项；{ s } 左移一格并追加一项。 */
type ArrayDiff = 0 | { t: unknown } | { s: unknown }
type PingTarget = NonNullable<ProbeServer['ping']>[number]
type PingDelta = { c: number; l: number; b: ArrayDiff }
type CompactServer = Record<string, unknown> & { _d?: Record<string, ArrayDiff>; _p?: (PingTarget | PingDelta)[] }

export type ProbeDeltaFrame = Omit<ProbePayload, 'servers'> & { delta: number; servers: CompactServer[] }

const ARRAY_FIELDS = ['unlocks', 'return_routes', 'daily_traffic'] as const
const PING_KEYS = new Set(['key', 'label', 'isp', 'current_ms', 'loss_pct', 'buckets'])

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b)

function diffArray(current: unknown, previous: unknown): ArrayDiff | null {
  if (!Array.isArray(current) || !Array.isArray(previous) || current.length !== previous.length || !current.length) return null
  if (same(current, previous)) return 0
  const last = current[current.length - 1]
  if (same(current.slice(0, -1), previous.slice(0, -1))) return { t: last }
  if (same(current.slice(0, -1), previous.slice(1))) return { s: last }
  return null
}

function applyArray(previous: unknown, diff: ArrayDiff): unknown[] | null {
  if (!Array.isArray(previous)) return null
  if (diff === 0) return previous
  if ('t' in diff) return [...previous.slice(0, -1), diff.t]
  if ('s' in diff) return [...previous.slice(1), diff.s]
  return null
}

function encodePing(current: PingTarget[], previous: PingTarget[]): (PingTarget | PingDelta)[] | null {
  if (current.length !== previous.length) return null
  let compacted = false
  const out = current.map((target, i) => {
    const prev = previous[i]
    const plain = Object.keys(target).every((key) => PING_KEYS.has(key)) && Object.keys(prev).every((key) => PING_KEYS.has(key))
    if (!plain || target.key !== prev.key || target.label !== prev.label || target.isp !== prev.isp) return target
    const b = diffArray(target.buckets, prev.buckets)
    if (b === null) return target
    compacted = true
    return { c: target.current_ms, l: target.loss_pct, b }
  })
  return compacted ? out : null
}

/** 生成增量帧；与上一帧服务器列表对不上时返回 null（调用方改发完整帧）。 */
export function encodeProbeDelta(current: ProbePayload, previous: ProbePayload | null | undefined): ProbeDeltaFrame | null {
  const servers = current.servers
  const prevServers = previous?.servers
  if (!Array.isArray(servers) || !Array.isArray(prevServers) || servers.length !== prevServers.length) return null
  if (servers.some((server, i) => server.name !== prevServers[i].name)) return null

  const compact = servers.map((server, i) => {
    const prev = prevServers[i]
    const out: CompactServer = { ...server }
    const fields: Record<string, ArrayDiff> = {}
    for (const field of ARRAY_FIELDS) {
      const diff = diffArray(server[field], prev[field])
      if (diff === null) continue
      fields[field] = diff
      delete out[field]
    }
    if (Object.keys(fields).length) out._d = fields
    if (Array.isArray(server.ping) && Array.isArray(prev.ping)) {
      const ping = encodePing(server.ping, prev.ping)
      if (ping) {
        delete out.ping
        out._p = ping
      }
    }
    return out
  })
  return { ...current, delta: PROBE_DELTA_VERSION, servers: compact }
}

export function isProbeDeltaFrame(value: unknown): value is ProbeDeltaFrame {
  return !!value && typeof value === 'object' && (value as { delta?: unknown }).delta === PROBE_DELTA_VERSION
}

/** 用上一帧还原完整数据；基准对不上时返回 null（调用方应重连拿完整帧）。 */
export function applyProbeDelta(frame: ProbeDeltaFrame, previous: ProbePayload | null | undefined): ProbePayload | null {
  const prevServers = previous?.servers
  if (!Array.isArray(prevServers) || frame.servers.length !== prevServers.length) return null
  const servers: ProbeServer[] = []
  for (let i = 0; i < frame.servers.length; i++) {
    const { _d, _p, ...rest } = frame.servers[i]
    const prev = prevServers[i]
    if (rest.name !== prev.name) return null
    const server = rest as unknown as ProbeServer & Record<string, unknown>
    for (const [field, diff] of Object.entries(_d ?? {})) {
      const value = applyArray(prev[field as keyof ProbeServer], diff)
      if (!value) return null
      server[field] = value
    }
    if (_p) {
      const prevPing = prev.ping
      if (!Array.isArray(prevPing) || prevPing.length !== _p.length) return null
      const ping: PingTarget[] = []
      for (let k = 0; k < _p.length; k++) {
        const item = _p[k]
        if (!('b' in item)) {
          ping.push(item)
          continue
        }
        const buckets = applyArray(prevPing[k].buckets, item.b)
        if (!buckets) return null
        ping.push({ ...prevPing[k], current_ms: item.c, loss_pct: item.l, buckets: buckets as PingTarget['buckets'] })
      }
      server.ping = ping
    }
    servers.push(server)
  }
  const { delta: _delta, ...payload } = frame
  return { ...payload, servers } as ProbePayload
}
