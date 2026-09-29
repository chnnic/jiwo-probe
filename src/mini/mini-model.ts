import type { ProbeServer } from '../types'

export type MiniStatus = 'all' | 'online' | 'offline' | 'expiring'
export type MiniSort = 'default' | 'name' | 'cpu' | 'memory' | 'traffic' | 'latency' | 'expiry'
export type MiniView = 'compact' | 'detailed' | 'list'
export const UNKNOWN_PROVIDER = '未标注服务商'

export function validNumber(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

export function ratio(used?: number, total?: number): number | undefined {
  const numerator = validNumber(used)
  const denominator = validNumber(total)
  return numerator !== undefined && denominator !== undefined && denominator > 0 ? numerator / denominator * 100 : undefined
}

export function averageLatency(server: ProbeServer): number | undefined {
  const values = (server.ping || []).map(item => validNumber(item.current_ms)).filter((value): value is number => value !== undefined)
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined
}

export function expiryTime(server: ProbeServer): number | undefined {
  if (!server.expires_at) return undefined
  const time = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(server.expires_at) ? `${server.expires_at}T23:59:59` : server.expires_at)
  return Number.isFinite(time) ? time : undefined
}

export function isExpiring(server: ProbeServer, now = Date.now()): boolean {
  const expiry = expiryTime(server)
  // 临期包含已过期节点，与待续费的意图一致。
  return expiry !== undefined && expiry <= now + 30 * 86400000
}

export function providerName(server: ProbeServer): string {
  return server.provider_name?.trim() || UNKNOWN_PROVIDER
}

export function selectServers(servers: ProbeServer[], options: { query: string; status: MiniStatus; provider: string; sort: MiniSort }, now = Date.now()) {
  const query = options.query.trim().toLocaleLowerCase()
  // 排序/筛选后始终保留原始下标；详情 API 也使用这个下标，不能用名称或可见行号替代。
  const entries = servers.map((server, index) => ({ server, index })).filter(({ server }) => {
    if (options.status === 'online' && !server.online) return false
    if (options.status === 'offline' && server.online) return false
    if (options.status === 'expiring' && !isExpiring(server, now)) return false
    if (options.provider && providerName(server) !== options.provider) return false
    return !query || [server.name, server.region, server.region_name, server.region_country, server.region_city, server.provider_name, server.os].filter(Boolean).join(' ').toLocaleLowerCase().includes(query)
  })
  if (options.sort === 'default') return entries
  const sortValue = (server: ProbeServer) => {
    switch (options.sort) {
      case 'cpu': return validNumber(server.cpu_pct)
      case 'memory': return ratio(server.mem_used, server.mem_total)
      case 'traffic': return validNumber(server.traffic_used)
      case 'latency': return averageLatency(server)
      case 'expiry': return expiryTime(server)
      default: return undefined
    }
  }
  return entries.sort((a, b) => {
    if (options.sort === 'name') return (a.server.name || '').localeCompare(b.server.name || '', 'zh-CN', { numeric: true }) || a.index - b.index
    const av = sortValue(a.server), bv = sortValue(b.server)
    if (av === undefined) return bv === undefined ? a.index - b.index : 1
    if (bv === undefined) return -1
    const ascending = options.sort === 'latency' || options.sort === 'expiry'
    return (ascending ? av - bv : bv - av) || a.index - b.index
  })
}

export function miniSummary(servers: ProbeServer[]) {
  const sum = (key: 'upload_speed' | 'download_speed' | 'traffic_used' | 'traffic_used_up' | 'traffic_used_down') => {
    const values = servers.map(server => validNumber(server[key])).filter((value): value is number => value !== undefined)
    return values.length ? values.reduce((total, value) => total + value, 0) : undefined
  }
  const latencies = servers.filter(server => server.online).map(averageLatency).filter((value): value is number => value !== undefined)
  return {
    online: servers.filter(server => server.online).length,
    upload: sum('upload_speed'), download: sum('download_speed'), traffic: sum('traffic_used'),
    outbound: sum('traffic_used_up'), inbound: sum('traffic_used_down'),
    latency: latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : undefined,
  }
}
