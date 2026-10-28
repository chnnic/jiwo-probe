// 经典主题探针页的汇总、健康判定、排序 —— 纯函数，移植自上游 989b8e7 的 src/probe-overview.ts（与主控内置探针同一份逻辑）。
import { primaryPing } from './ping-groups.ts'

export type ProbeOverviewServer = {
  name?: string
  region?: string
  online: boolean
  cpu_pct?: number
  mem_used?: number
  mem_total?: number
  disk_used?: number
  disk_total?: number
  upload_speed?: number
  download_speed?: number
  traffic_limit?: number
  expires_at?: string
  renewal_price_cny?: number
  traffic_used?: number
  tcp_connections?: number
  udp_connections?: number
  conn_history?: { tcp: (number | null)[]; udp: (number | null)[] }
  daily_traffic?: Array<{ date: string; total: number }>
  /** 日流量由累计值估算（xray 来源）：主控探针页的日流量合计不算这些机器 */
  daily_traffic_estimated?: boolean
  ping?: Array<{ key?: string; label?: string; current_ms: number; loss_pct?: number; buckets?: Array<{ ms: number; loss: number }> }>
}

/** 进度条变红的阈值，告警也按它 */
export const PROBE_ALERT_PCT = 90
/** 进度条变黄的阈值 */
export const PROBE_WARN_PCT = 70

export type ProbeHealthIssue = { key: 'cpu' | 'mem' | 'disk' | 'traffic'; pct: number }

function ratio(used?: number, total?: number): number | undefined {
  if (typeof used !== 'number' || typeof total !== 'number' || total <= 0) return undefined
  return (used / total) * 100
}

export const memPct = (s: ProbeOverviewServer) => ratio(s.mem_used, s.mem_total)
export const diskPct = (s: ProbeOverviewServer) => ratio(s.disk_used, s.disk_total)

/** 进度条配色：超过 90% 红、超过 70% 黄 */
export function meterTone(percent: number): 'bad' | 'warn' | undefined {
  return percent > PROBE_ALERT_PCT ? 'bad' : percent > PROBE_WARN_PCT ? 'warn' : undefined
}

/**
 * 最严重的一项（超过阈值才算）。离线机器的数据是旧的，不判。
 * trafficUsed 由调用方给（计费口径沿用页面现有的 traffic_used）。
 */
export function probeHealthIssue(s: ProbeOverviewServer, trafficUsed?: number): ProbeHealthIssue | undefined {
  if (!s.online) return undefined
  const items: ProbeHealthIssue[] = []
  if (typeof s.cpu_pct === 'number') items.push({ key: 'cpu', pct: s.cpu_pct })
  const mem = memPct(s)
  if (mem !== undefined) items.push({ key: 'mem', pct: mem })
  const disk = diskPct(s)
  if (disk !== undefined) items.push({ key: 'disk', pct: disk })
  const traffic = ratio(trafficUsed, s.traffic_limit)
  if (traffic !== undefined) items.push({ key: 'traffic', pct: traffic })
  return items.filter((item) => item.pct > PROBE_ALERT_PCT).sort((a, b) => b.pct - a.pct)[0]
}

/** 「已用 / 总量」：按总量选单位，两边同一单位，去掉多余的 .0 */
export function formatCapacity(used: number, total: number): string {
  const MiB = 1024 ** 2
  const GiB = 1024 ** 3
  const TiB = 1024 ** 4
  const unit = total >= TiB ? TiB : total >= GiB ? GiB : MiB
  const name = unit === TiB ? 'TB' : unit === GiB ? 'GB' : 'MB'
  const fmt = (value: number) => {
    const x = value / unit
    return (x >= 100 ? x.toFixed(0) : x.toFixed(1)).replace(/\.0$/, '')
  }
  return `${fmt(used)} / ${fmt(total)} ${name}`
}

/** 只写总量（离线卡片的规格行用） */
export function formatSize(total: number): string {
  return formatCapacity(0, total).replace(/^0 \/ /, '')
}

export type ProbeSortKey = 'default' | 'name' | 'cpu' | 'mem' | 'speed' | 'traffic' | 'expiry' | 'latency'

export const PROBE_SORT_KEYS: ProbeSortKey[] = ['default', 'name', 'cpu', 'mem', 'speed', 'traffic', 'expiry', 'latency']

export const PROBE_SORT_LABELS: Record<ProbeSortKey, string> = {
  default: '默认顺序', name: '名称', cpu: 'CPU', mem: '内存', speed: '网速', traffic: '流量用量', expiry: '到期日', latency: '延迟',
}

/**
 * 排序。没有该项数据的排最后；数值类从大到小（最该关注的在前），
 * 到期日与延迟从小到大。相同时保持原顺序（管理员排好的顺序）。
 */
export function sortProbeServers<T extends { server: ProbeOverviewServer; index: number }>(
  list: T[],
  key: ProbeSortKey,
  trafficUsed: (s: ProbeOverviewServer) => number | undefined,
): T[] {
  if (key === 'default') return list
  const value = (s: ProbeOverviewServer): number | string | undefined => {
    switch (key) {
      case 'name': return s.name || ''
      case 'cpu': return s.cpu_pct
      case 'mem': return memPct(s)
      case 'speed': return s.upload_speed === undefined && s.download_speed === undefined ? undefined : (s.upload_speed || 0) + (s.download_speed || 0)
      case 'traffic': return trafficUsed(s)
      case 'expiry': return s.expires_at || undefined
      case 'latency': {
        const ms = primaryPing(s.ping).map((p) => p.current_ms).filter((v) => v >= 0)
        return ms.length ? Math.min(...ms) : undefined
      }
    }
  }
  const ascending = key === 'name' || key === 'expiry' || key === 'latency'
  return [...list].sort((a, b) => {
    const va = value(a.server)
    const vb = value(b.server)
    if (va === undefined && vb === undefined) return a.index - b.index
    if (va === undefined) return 1
    if (vb === undefined) return -1
    let cmp = typeof va === 'string' && typeof vb === 'string' ? va.localeCompare(vb, 'zh-CN') : (va as number) - (vb as number)
    if (!ascending) cmp = -cmp
    return cmp || a.index - b.index
  })
}

/** 「37 分钟前」这类相对时间 */
export function relativeTime(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const sec = Math.max(0, Math.round((now - t) / 1000))
  if (sec < 60) return '刚刚'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min} 分钟前`
  const hour = Math.round(sec / 3600)
  if (hour < 48) return `${hour} 小时前`
  return `${Math.round(sec / 86400)} 天前`
}

// ===== 顶部指标格（照主控内置探针页） =====

/**
 * 各服务器日流量按日期合计，取最近 days 天（旧到新）；没有日流量时为空。
 * 与主控内置探针页一致：日流量是按累计值估算出来的机器（daily_traffic_estimated）不计入。
 */
export function dailyTrafficTotals(servers: ProbeOverviewServer[], days = 7): Array<{ date: string; total: number }> {
  const totals = new Map<string, number>()
  for (const s of servers) {
    if (s.daily_traffic_estimated) continue
    for (const d of s.daily_traffic ?? []) totals.set(d.date, (totals.get(d.date) || 0) + (d.total || 0))
  }
  return [...totals].sort(([a], [b]) => a.localeCompare(b)).slice(-days).map(([date, total]) => ({ date, total }))
}

/** 本期流量额度：只算设了限额的服务器；超 80% 的台数单独数出来 */
export function quotaSummary(servers: ProbeOverviewServer[]) {
  let used = 0
  let limit = 0
  let count = 0
  let over80 = 0
  for (const s of servers) {
    if (!(typeof s.traffic_limit === 'number' && s.traffic_limit > 0)) continue
    const u = typeof s.traffic_used === 'number' && s.traffic_used > 0 ? s.traffic_used : 0
    count++
    used += u
    limit += s.traffic_limit
    if (u / s.traffic_limit > 0.8) over80++
  }
  return count ? { used, limit, pct: (used / limit) * 100, count, over80 } : undefined
}

/**
 * 一台服务器的延迟与丢包：各延迟目标近 1 小时分桶的平均（与主控内置探针页的数值对得上）；
 * 没有分桶时退回当前值。失败的 -1 不算；开了 IPv6 延迟的服务器只算 IPv4 目标。
 */
export function serverPing(s: ProbeOverviewServer): { latency?: number; loss?: number } {
  const ping = primaryPing(s.ping)
  const buckets = ping.flatMap((p) => p.buckets ?? [])
  const valid = (values: Array<number | undefined>) => values.filter((v): v is number => typeof v === 'number' && v >= 0)
  const bucketMs = valid(buckets.map((b) => b.ms))
  const ms = bucketMs.length ? bucketMs : valid(ping.map((p) => p.current_ms))
  const bucketLoss = valid(buckets.map((b) => b.loss))
  const loss = bucketLoss.length ? bucketLoss : valid(ping.map((p) => p.loss_pct))
  return {
    latency: ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : undefined,
    loss: loss.length ? loss.reduce((a, b) => a + b, 0) / loss.length : undefined,
  }
}

/** 网络质量分级，与 Premium 网络视图同一口径：丢包 ≥10% 或延迟 ≥250ms 为差，丢包 ≥3% 或延迟 ≥120ms 为中 */
export function pingQuality(latency: number, loss: number): 'good' | 'medium' | 'poor' {
  if (loss >= 10 || latency >= 250) return 'poor'
  if (loss >= 3 || latency >= 120) return 'medium'
  return 'good'
}

/** 在线且有延迟数据的服务器：平均延迟、平均丢包与优 / 中 / 差台数 */
export function networkQuality(servers: ProbeOverviewServer[]) {
  const rows = servers.filter((s) => s.online).map(serverPing).filter((row): row is { latency: number; loss?: number } => row.latency !== undefined)
  if (!rows.length) return undefined
  const counts = { good: 0, medium: 0, poor: 0 }
  for (const row of rows) counts[pingQuality(row.latency, row.loss ?? 0)]++
  const losses = rows.map((row) => row.loss).filter((v): v is number => v !== undefined)
  return {
    latency: rows.reduce((sum, row) => sum + row.latency, 0) / rows.length,
    loss: losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : undefined,
    ...counts,
    total: rows.length,
  }
}

/** 全部服务器的 TCP / UDP 连接数合计，以及近 1 小时的合计曲线（各台同一时段相加，全缺的时段为 null） */
export function connectionTotals(servers: ProbeOverviewServer[]) {
  let tcp = 0
  let udp = 0
  let reported = false
  let length = 0
  for (const s of servers) {
    if (typeof s.tcp_connections === 'number') { tcp += s.tcp_connections; reported = true }
    if (typeof s.udp_connections === 'number') { udp += s.udp_connections; reported = true }
    if (s.conn_history) length = Math.max(length, s.conn_history.tcp.length, s.conn_history.udp.length)
  }
  if (!reported) return undefined
  const history = length ? Array.from({ length }, (_, i) => {
    let sum = 0
    let any = false
    for (const s of servers) {
      for (const v of [s.conn_history?.tcp[i], s.conn_history?.udp[i]]) if (typeof v === 'number') { sum += v; any = true }
    }
    return any ? sum : null
  }) : undefined
  return { tcp, udp, total: tcp + udp, history }
}
