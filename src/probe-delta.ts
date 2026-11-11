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
/**
 * 第 2 版增量帧（/api/stream?delta=2）：在第 1 版基础上，没变的字段整个不发。
 * 线上实测（83 台）第 1 版每 3 秒一帧约 200 KB：各服务器六十来个基本不变的标量字段占 100 KB，
 * 15 分钟才结算一次的转发链 forward 占 58 KB，延迟目标里大多数「没变」的占位占 20 KB。
 * 第 2 版里：顶层和每台服务器只带有变化的字段（被删掉的字段名列在 _x 里）；
 * 延迟目标整项没变时记为 0；转发链 forward 条数和名称没变时按链只发有变化的字段（_f）。
 * 第 1 版保留给还没刷新的旧页面。
 */
export const PROBE_DELTA_VERSION_2 = 2

/** 数组相对上一帧的变化：0 不变；{ t } 只换最后一项；{ s } 左移一格并追加一项。 */
type ArrayDiff = 0 | { t: unknown } | { s: unknown }
type PingTarget = NonNullable<ProbeServer['ping']>[number]
type PingDelta = { c: number; l: number; b: ArrayDiff }
type CompactServer = Record<string, unknown> & { _d?: Record<string, ArrayDiff>; _p?: (PingTarget | PingDelta | 0)[]; _x?: string[] }

export type ProbeDeltaFrame = Omit<ProbePayload, 'servers'> & { delta: number; servers: CompactServer[]; _x?: string[]; _f?: Array<Record<string, unknown> & { _x?: string[] }> }

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
  const version = !!value && typeof value === 'object' ? (value as { delta?: unknown }).delta : undefined
  return version === PROBE_DELTA_VERSION || version === PROBE_DELTA_VERSION_2
}

/** 只留下相对上一份有变化的字段；上一份有、这一份没有的字段名记进 _x。 */
function changedFields(current: Record<string, unknown>, previous: Record<string, unknown>, skip: ReadonlySet<string>): Record<string, unknown> & { _x?: string[] } {
  const out: Record<string, unknown> & { _x?: string[] } = {}
  for (const key of Object.keys(current)) {
    if (!skip.has(key) && !same(current[key], previous[key])) out[key] = current[key]
  }
  const removed = Object.keys(previous).filter((key) => !skip.has(key) && !(key in current))
  if (removed.length) out._x = removed
  return out
}

const V2_SERVER_SKIP: ReadonlySet<string> = new Set([...ARRAY_FIELDS, 'ping'])
const V2_TOP_SKIP: ReadonlySet<string> = new Set(['servers'])
const V2_TOP_SKIP_FORWARD: ReadonlySet<string> = new Set(['servers', 'forward'])
const NO_SKIP: ReadonlySet<string> = new Set()
// 帧自身的保留字段：数据里万一出现同名字段就不发增量，退回完整帧
const V2_RESERVED = ['delta', '_x', '_d', '_p', '_f']

/** 生成第 2 版增量帧；与上一帧服务器列表对不上时返回 null（调用方改发完整帧）。 */
export function encodeProbeDeltaV2(current: ProbePayload, previous: ProbePayload | null | undefined): ProbeDeltaFrame | null {
  const servers = current.servers
  const prevServers = previous?.servers
  if (!previous || !Array.isArray(servers) || !Array.isArray(prevServers) || servers.length !== prevServers.length) return null
  if (servers.some((server, i) => server.name !== prevServers[i].name)) return null
  const reserved = (value: object) => V2_RESERVED.some((key) => key in value)
  if (reserved(current) || reserved(previous) || servers.some(reserved) || prevServers.some(reserved)) return null

  const compact = servers.map((server, i) => {
    const prev = prevServers[i] as unknown as Record<string, unknown>
    const now = server as unknown as Record<string, unknown>
    const out: CompactServer = changedFields(now, prev, V2_SERVER_SKIP)
    const fields: Record<string, ArrayDiff> = {}
    for (const field of ARRAY_FIELDS) {
      if (!(field in now)) { if (field in prev) (out._x ??= []).push(field); continue }
      const diff = diffArray(now[field], prev[field])
      if (diff === 0) continue
      if (diff === null) { if (!same(now[field], prev[field])) out[field] = now[field] } else fields[field] = diff
    }
    if (Object.keys(fields).length) out._d = fields
    if (!('ping' in now)) {
      if ('ping' in prev) (out._x ??= []).push('ping')
    } else if (!same(now.ping, prev.ping)) {
      const ping = Array.isArray(now.ping) && Array.isArray(prev.ping) ? encodePing(now.ping as PingTarget[], prev.ping as PingTarget[]) : null
      if (ping) {
        const before = prev.ping as PingTarget[]
        out._p = ping.map((item, k) => 'b' in item && item.b === 0 && item.c === before[k].current_ms && item.l === before[k].loss_pct ? 0 : item)
      } else out.ping = now.ping
    }
    return out
  })
  // 转发链：条数、顺序、名称都没变时逐条只发变化的字段（网速、延迟每帧在变，流量和 24 小时状态条很少变）
  type Chain = Record<string, unknown>
  const chains = current.forward as unknown as Chain[] | undefined
  const prevChains = previous.forward as unknown as Chain[] | undefined
  const chainDiff = Array.isArray(chains) && Array.isArray(prevChains) && chains.length > 0 && chains.length === prevChains.length
    && chains.every((chain, i) => !!chain && !!prevChains[i] && typeof chain === 'object' && typeof prevChains[i] === 'object' && !Array.isArray(chain) && !('_x' in chain) && chain.name === prevChains[i].name)
  const top = changedFields(current as unknown as Record<string, unknown>, previous as unknown as Record<string, unknown>, chainDiff ? V2_TOP_SKIP_FORWARD : V2_TOP_SKIP)
  const frame = { ...top, delta: PROBE_DELTA_VERSION_2, servers: compact } as ProbeDeltaFrame
  if (chainDiff && !same(chains, prevChains)) frame._f = chains!.map((chain, i) => changedFields(chain, prevChains![i], NO_SKIP))
  return frame
}

function applyProbeDeltaV2(frame: ProbeDeltaFrame, previous: ProbePayload): ProbePayload | null {
  const prevServers = previous.servers ?? []
  const servers: ProbeServer[] = []
  for (let i = 0; i < frame.servers.length; i++) {
    const { _d, _p, _x, ...changed } = frame.servers[i]
    const prev = prevServers[i]
    const server = { ...prev, ...changed } as unknown as ProbeServer & Record<string, unknown>
    for (const key of _x ?? []) delete server[key]
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
        if (item === 0) { ping.push(prevPing[k]); continue }
        if (!('b' in item)) { ping.push(item); continue }
        const buckets = applyArray(prevPing[k].buckets, item.b)
        if (!buckets) return null
        ping.push({ ...prevPing[k], current_ms: item.c, loss_pct: item.l, buckets: buckets as PingTarget['buckets'] })
      }
      server.ping = ping
    }
    servers.push(server)
  }
  const { delta: _delta, _x, _f, servers: _servers, ...changed } = frame
  const payload = { ...previous, ...changed, servers } as ProbePayload & Record<string, unknown>
  for (const key of _x ?? []) delete payload[key]
  if (_f) {
    const prevChains = previous.forward as unknown as Array<Record<string, unknown>> | undefined
    if (!Array.isArray(prevChains) || prevChains.length !== _f.length) return null
    payload.forward = _f.map(({ _x: removed, ...fields }, i) => {
      const chain = { ...prevChains[i], ...fields }
      for (const key of removed ?? []) delete chain[key]
      return chain
    }) as unknown as ProbePayload['forward']
  }
  return payload
}

/** 用上一帧还原完整数据；基准对不上时返回 null（调用方应重连拿完整帧）。 */
export function applyProbeDelta(frame: ProbeDeltaFrame, previous: ProbePayload | null | undefined): ProbePayload | null {
  const prevServers = previous?.servers
  if (!previous || !Array.isArray(prevServers) || !Array.isArray(frame.servers) || frame.servers.length !== prevServers.length) return null
  if (frame.delta === PROBE_DELTA_VERSION_2) return applyProbeDeltaV2(frame, previous)
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
        if (item === 0) return null
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
