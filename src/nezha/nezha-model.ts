// 哪吒主题的数据整理：排序、分组、计费信息。界面照哪吒 V1 默认前台（nezha-dash-v1，Apache-2.0）的布局，
// 数据全部来自本站已有的主控快照字段，不另起口径。
import type { ProbeServer } from '../types'
import { CYCLE_DAYS, CYCLE_LABELS, expiryTimestamp, isPermanent } from '../renewal.ts'
import { globeCountryCode, regionGroupLabel } from '../globe-regions.ts'

export type NezhaSortType = 'default' | 'name' | 'uptime' | 'system' | 'cpu' | 'mem' | 'disk' | 'up' | 'down' | 'up total' | 'down total'
export type NezhaSortOrder = 'asc' | 'desc'
export type NezhaStatus = 'all' | 'online' | 'offline'

export const NEZHA_SORT_TYPES: NezhaSortType[] = ['default', 'name', 'uptime', 'system', 'cpu', 'mem', 'disk', 'up', 'down', 'up total', 'down total']
export const NEZHA_SORT_LABELS: Record<NezhaSortType, string> = {
  default: '默认', name: '名称', uptime: '在线时间', system: '系统', cpu: 'CPU', mem: '内存', disk: '存储',
  up: '上传', down: '下载', 'up total': '上传总量', 'down total': '下载总量',
}

const pct = (used?: number, total?: number) => typeof used === 'number' && typeof total === 'number' && total > 0 ? Math.min(100, Math.max(0, (used / total) * 100)) : 0

export const cpuPct = (s: ProbeServer) => typeof s.cpu_pct === 'number' && Number.isFinite(s.cpu_pct) ? Math.max(0, s.cpu_pct) : 0
export const memPct = (s: ProbeServer) => pct(s.mem_used, s.mem_total)
export const diskPct = (s: ProbeServer) => pct(s.disk_used, s.disk_total)
/** 本期上 / 下行流量（主控按计费周期统计的物理口径） */
export const totalUp = (s: ProbeServer) => s.traffic_used_up ?? 0
export const totalDown = (s: ProbeServer) => s.traffic_used_down ?? 0

/** 占用条配色：超过 90% 红、超过 70% 橙，其余绿（与哪吒前台一致） */
export function usageTone(value: number): 'bad' | 'warn' | 'ok' {
  return value > 90 ? 'bad' : value > 70 ? 'warn' : 'ok'
}

/** 「12 天」或「5 小时」 */
export function uptimeLabel(seconds?: number): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return '—'
  return seconds >= 86400 ? `${Math.floor(seconds / 86400)} 天` : `${Math.floor(seconds / 3600)} 小时`
}

/** 系统简称（列表视图「系统」一栏）：「Debian GNU/Linux 12」→「Debian」，Windows 统一写 Windows */
export function osShortName(os?: string): string {
  const value = os?.trim()
  if (!value) return '—'
  if (/windows/i.test(value)) return 'Windows'
  if (/darwin|mac\s*os/i.test(value)) return 'macOS'
  return value.split(/[\s/]+/)[0] || value
}

/** 分组标签：按地区分，台数多的在前；「全部」永远第一个 */
export function regionTabs(servers: ProbeServer[]): Array<{ key: string; label: string; count: number }> {
  const counts = new Map<string, { label: string; count: number }>()
  for (const s of servers) {
    // 手动选的国旗（region）优先，按 IP 自动识别的 region_country 兜底
    const raw = s.region?.trim() || s.region_country || ''
    if (!raw.trim()) continue
    const key = globeCountryCode(raw) || raw.trim()
    const item = counts.get(key) || { label: regionGroupLabel(raw), count: 0 }
    item.count++
    counts.set(key, item)
  }
  const groups = [...counts].map(([key, item]) => ({ key, ...item })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh-CN'))
  return [{ key: 'all', label: '全部', count: servers.length }, ...groups]
}

export function serverRegionKey(s: ProbeServer): string {
  const raw = s.region?.trim() || s.region_country || ''
  return globeCountryCode(raw) || raw.trim()
}

/** 筛选 + 排序；保留原始下标，供详情页路由使用。默认顺序为主控排好的顺序，离线机器不另行置底 */
export function selectNezhaServers(servers: ProbeServer[], options: { status: NezhaStatus; group: string; query: string; sort: NezhaSortType; order: NezhaSortOrder }) {
  const keyword = options.query.trim().toLowerCase()
  const list = servers.map((server, index) => ({ server, index })).filter(({ server }) => {
    if (options.status === 'online' && !server.online) return false
    if (options.status === 'offline' && server.online) return false
    if (options.group !== 'all' && serverRegionKey(server) !== options.group) return false
    if (keyword && ![server.name, server.region, server.region_name, server.region_city, server.provider_name].filter(Boolean).join(' ').toLowerCase().includes(keyword)) return false
    return true
  })
  if (options.sort === 'default') return list
  const value = (s: ProbeServer): number | string => {
    switch (options.sort) {
      case 'name': return s.name || ''
      case 'uptime': return s.uptime ?? 0
      case 'system': return s.os || ''
      case 'cpu': return cpuPct(s)
      case 'mem': return memPct(s)
      case 'disk': return diskPct(s)
      case 'up': return s.upload_speed ?? 0
      case 'down': return s.download_speed ?? 0
      case 'up total': return totalUp(s)
      case 'down total': return totalDown(s)
      default: return 0
    }
  }
  const sign = options.order === 'asc' ? 1 : -1
  return [...list].sort((a, b) => {
    const va = value(a.server)
    const vb = value(b.server)
    const cmp = typeof va === 'string' && typeof vb === 'string' ? va.localeCompare(vb, 'zh-CN') : (va as number) - (vb as number)
    return cmp * sign || a.index - b.index
  })
}

/** 顶部四张概览卡：总数、在线、离线，以及本期总上下行与实时网速 */
export function nezhaOverview(servers: ProbeServer[]) {
  let online = 0
  let up = 0
  let down = 0
  let upSpeed = 0
  let downSpeed = 0
  for (const s of servers) {
    if (s.online) online++
    up += totalUp(s)
    down += totalDown(s)
    upSpeed += s.upload_speed ?? 0
    downSpeed += s.download_speed ?? 0
  }
  return { total: servers.length, online, offline: servers.length - online, up, down, upSpeed, downSpeed }
}

/**
 * 卡片名字下面的计费信息（哪吒前台的 BillingInfo）：剩余天数、剩余比例条、价格。
 * 永久买断显示「剩余：永久」；没有到期日也没有价格时返回 undefined。
 */
export function billingInfo(s: ProbeServer, now = Date.now()) {
  const cycle = s.renewal_cycle || 'month'
  const priceValue = s.renewal_price_cny ?? s.renewal_price
  const price = typeof priceValue === 'number' && priceValue >= 0
    ? `${s.renewal_price_cny !== undefined || (s.renewal_currency || 'CNY').toUpperCase() === 'CNY' ? '¥' : `${s.renewal_currency} `}${Number(priceValue.toFixed(2))}/${CYCLE_LABELS[cycle as keyof typeof CYCLE_LABELS] || '月'}`
    : undefined
  if (isPermanent(s)) return { permanent: true as const, days: undefined, expired: false, remainPct: 100, price }
  const at = expiryTimestamp(s)
  if (at === undefined) return price ? { permanent: false as const, days: undefined, expired: false, remainPct: undefined, price } : undefined
  const days = Math.ceil((at - now) / 86400000)
  const cycleDays = CYCLE_DAYS[cycle as keyof typeof CYCLE_DAYS] || 30
  return { permanent: false as const, days, expired: days < 0, remainPct: Math.max(0, Math.min(100, (days / cycleDays) * 100)), price }
}
