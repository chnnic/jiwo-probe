// 转发链状态模型：与主控转发链列表、主控 CSS（正常 / 偏慢 / 异常）同一口径，供各主题的转发链视图使用。
// 延迟阈值沿用上游 Premium 转发页（forwardLatencyClass）：<80 良好、<160 一般、≥160 偏高、≤0 无数据。
// 出口组不探测下一跳，主控下发的 healthy 恒为 false，不参与健康判断。
import type { ForwardChainData, ForwardChainGroupData } from './types'

export type ForwardStatus = 'ok' | 'warn' | 'down'
export type HopTone = 'idle' | 'good' | 'ok' | 'hi' | 'down'

export const FORWARD_SLOW_MS = 160
export const FORWARD_WARN_LOSS = 5
export const FORWARD_DOWN_LOSS = 50

const ROLE_LABEL: Record<string, string> = { entry: '入口组', mid: '中转组', exit: '出口组' }
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

export function latencyTone(ms: number | undefined): Exclude<HopTone, 'down'> {
  if (!finite(ms) || ms <= 0) return 'idle'
  if (ms < 80) return 'good'
  if (ms < FORWARD_SLOW_MS) return 'ok'
  return 'hi'
}

/** 一个组的可用情况；出口组返回 null（不参与判断）。 */
export function groupHealth(group: ForwardChainGroupData): { healthy: number; total: number } | null {
  if (group.role === 'exit') return null
  return { healthy: group.servers.filter((server) => server.healthy).length, total: group.servers.length }
}

/** 组到下一组的连线状态：组内无可用服务器时为 down，否则按延迟着色。 */
export function hopTone(group: ForwardChainGroupData): HopTone {
  const health = groupHealth(group)
  if (health && health.total > 0 && health.healthy === 0) return 'down'
  return latencyTone(group.to_next_ms)
}

export function chainStatus(chain: ForwardChainData): { status: ForwardStatus; reasons: string[] } {
  const down: string[] = []
  const warn: string[] = []
  const hasLatency = (finite(chain.end_to_end_ms) && chain.end_to_end_ms > 0)
    || (chain.trend || []).some((point) => finite(point.e2e_ms) && point.e2e_ms > 0)
  if (!hasLatency) down.push('暂无有效延迟数据')
  for (const group of chain.groups) {
    const health = groupHealth(group)
    if (!health || health.total === 0) continue
    const label = ROLE_LABEL[group.role] ?? group.name
    if (health.healthy === 0) down.push(`${label}无可用服务器`)
    else if (health.healthy < health.total) warn.push(`${label} ${health.total - health.healthy}/${health.total} 台探测异常`)
  }
  if (finite(chain.loss_pct) && chain.loss_pct >= FORWARD_DOWN_LOSS) down.push(`丢包 ${chain.loss_pct.toFixed(1)}%`)
  else if (finite(chain.loss_pct) && chain.loss_pct >= FORWARD_WARN_LOSS) warn.push(`丢包 ${chain.loss_pct.toFixed(1)}%`)
  if (finite(chain.end_to_end_ms) && chain.end_to_end_ms >= FORWARD_SLOW_MS) warn.push(`端到端 ${Math.round(chain.end_to_end_ms)} ms`)
  if (down.length) return { status: 'down', reasons: [...down, ...warn] }
  if (warn.length) return { status: 'warn', reasons: warn }
  return { status: 'ok', reasons: [] }
}

const ORDER: Record<ForwardStatus, number> = { down: 0, warn: 1, ok: 2 }

/** 异常置顶、偏慢其次，同状态保持主控原顺序。 */
export function sortChains(chains: ForwardChainData[]) {
  return chains
    .map((chain, index) => ({ chain, index, ...chainStatus(chain) }))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.index - b.index)
}

export function forwardSummary(chains: ForwardChainData[]) {
  const counts = { total: chains.length, ok: 0, warn: 0, down: 0 }
  for (const chain of chains) counts[chainStatus(chain).status]++
  return counts
}

// 主控每 15 分钟批量结算一次各转发链流量，接口不下发这个周期（2026-10-08 实测，主控开发者确认）
export const FORWARD_TRAFFIC_SETTLE_MINUTES = 15
export const FORWARD_TRAFFIC_NOTE = `主控每 ${FORWARD_TRAFFIC_SETTLE_MINUTES} 分钟更新一次`

/** 7 天流量：每天各节点合计与流量最多的节点；无数据返回 null。 */
export function chainTraffic(chain: ForwardChainData, top = 3) {
  const traffic = chain.traffic
  if (!traffic?.days?.length || !traffic.servers?.length) return null
  const daily = traffic.days.map((date, i) => ({
    date,
    gb: traffic.servers.reduce((sum, server) => sum + (finite(server.daily_gb?.[i]) ? server.daily_gb[i] : 0), 0),
  }))
  const servers = [...traffic.servers]
    .filter((server) => finite(server.total_gb) && server.total_gb > 0)
    .sort((a, b) => b.total_gb - a.total_gb)
    .slice(0, top)
  const total = finite(traffic.total_gb) ? traffic.total_gb : daily.reduce((sum, day) => sum + day.gb, 0)
  return { daily, servers, total }
}

export function formatGb(gb: number): string {
  if (!finite(gb) || gb <= 0) return '0 GB'
  if (gb >= 1000) return `${(gb / 1024).toFixed(2)} TB`
  if (gb >= 100) return `${Math.round(gb)} GB`
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  return `${Math.max(1, Math.round(gb * 1024))} MB`
}

/** 某一天的流量明细：当天合计与各节点用量（从多到少，0 流量不列出）；越界或无数据返回 null。 */
export function chainTrafficDay(chain: ForwardChainData, dayIndex: number) {
  const traffic = chain.traffic
  if (!traffic?.days?.length || !traffic.servers?.length || dayIndex < 0 || dayIndex >= traffic.days.length) return null
  const servers = traffic.servers
    .map((server) => ({ name: server.name, group: server.group, role: server.role, gb: finite(server.daily_gb?.[dayIndex]) ? server.daily_gb[dayIndex] : 0 }))
    .filter((server) => server.gb > 0)
    .sort((a, b) => b.gb - a.gb)
  return { date: traffic.days[dayIndex], total: servers.reduce((sum, server) => sum + server.gb, 0), servers }
}

export type CellTone = ForwardStatus | 'idle'

/** 链路卡片状态条：每个 bucket 一格，判断口径与整条链一致（无数据为 idle）。 */
export function trendCells(chain: ForwardChainData): { ts: number; tone: CellTone; label: string }[] {
  return (chain.trend || []).map((point) => {
    const ms = finite(point.e2e_ms) ? point.e2e_ms : -1
    const lossPct = finite(point.loss) ? point.loss : -1
    const tone: CellTone = ms <= 0 && lossPct <= 0 ? 'idle'
      : lossPct >= FORWARD_DOWN_LOSS ? 'down'
      : lossPct >= FORWARD_WARN_LOSS || ms >= FORWARD_SLOW_MS ? 'warn'
      : 'ok'
    const time = new Date(point.ts * 1000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
    const label = tone === 'idle' ? `${time} · 无数据` : `${time} · ${Math.round(ms)} ms · 丢包 ${lossPct.toFixed(1)}%`
    return { ts: point.ts, tone, label }
  })
}

const CELL_TONE: Record<string, CellTone> = { o: 'ok', d: 'down', n: 'idle' }
const CELL_LABEL: Record<CellTone, string> = { ok: '正常', warn: '降级', down: '中断', idle: '无数据' }
const DAY_MS = 24 * 3600 * 1000
const clock = (ms: number) => new Date(ms).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })

/**
 * 近 24 小时状态条（主控 v0.5.6-beta.6 起的 cells）：每个字符一格、按时间先后排列，最后一格是当前。
 * 已见到的编码只有 o 正常、d 中断、n 无数据，其余字符一律按降级显示。主控不下发时返回 null。
 */
export function availabilityCells(chain: ForwardChainData, now = Date.now()): { key: number; tone: CellTone; label: string }[] | null {
  const cells = chain.cells
  if (typeof cells !== 'string' || !cells.length) return null
  const span = DAY_MS / cells.length
  return [...cells].map((char, index) => {
    const tone = CELL_TONE[char] ?? 'warn'
    const end = now - (cells.length - 1 - index) * span
    return { key: index, tone, label: `约 ${clock(end - span)}–${clock(end)} · ${CELL_LABEL[tone]}` }
  })
}

/** 近 24 小时可用率（百分比）；主控下发 0–1，未下发返回 null。 */
export function availabilityPct(chain: ForwardChainData): number | null {
  const value = chain.availability_24h
  if (!finite(value) || value < 0) return null
  return Math.min(100, value <= 1 ? value * 100 : value)
}

/** 可用率文字：满格写 100%，接近满格保留两位小数，免得 99.96% 被四舍五入成 100%。 */
export function formatAvailability(pct: number): string {
  if (pct >= 100) return '100%'
  if (pct >= 99) return `${(Math.floor(pct * 100) / 100).toFixed(2)}%`
  return `${(Math.floor(pct * 10) / 10).toFixed(1)}%`
}

export function formatJitter(ms: number | undefined): string | null {
  if (!finite(ms) || ms < 0) return null
  return `${ms < 10 ? ms.toFixed(1) : Math.round(ms)} ms`
}

/** 入口在这条链上的实时上下行（byte/s，主控 v0.5.6-beta.6 起）；未下发返回 null。 */
export function chainLiveSpeed(chain: ForwardChainData): { up: number; down: number; total: number } | null {
  if (!finite(chain.speed_up) && !finite(chain.speed_down)) return null
  const up = finite(chain.speed_up) && chain.speed_up > 0 ? chain.speed_up : 0
  const down = finite(chain.speed_down) && chain.speed_down > 0 ? chain.speed_down : 0
  return { up, down, total: up + down }
}

/**
 * 主控接口只下发按顺序排列的组，不含选路结构：连续两个以上中转组既可能是串联，也可能是
 * 「选路段」里的多条并行路线（例如入口直连 / 经组 3 / 经组 4 按最低延迟择一）。
 */
export function mayHaveRouteSelection(chain: ForwardChainData): boolean {
  if (chain.routes?.length) return false // 新版主控已下发选路结构
  let run = 0
  for (const group of chain.groups) {
    run = group.role === 'mid' ? run + 1 : 0
    if (run >= 2) return true
  }
  return false
}

// 与上游 Premium 转发页（c6839d2）同一组策略名
const POLICY_LABEL: Record<string, string> = { lowest_latency: '最低延迟优先', failover: '按顺序故障转移', weighted: '按权重分流' }

/**
 * 选路段（主控 v0.5.6-beta.4 起，#1136）：groups[route_hop] 之后分叉成多条路，汇合到下一组。
 * 返回分叉位置、各条路（含状态色）与策略说明；没有选路段或位置不合法时返回 null。
 */
export function routeFork(chain: ForwardChainData) {
  const routes = chain.routes
  const hop = chain.route_hop
  if (!routes?.length || !finite(hop) || hop < 0 || hop >= chain.groups.length - 1) return null
  const policy = [
    chain.route_policy ? POLICY_LABEL[chain.route_policy] ?? chain.route_policy : '',
    finite(chain.failover_ms) && chain.failover_ms > 0 ? `故障转移 ${chain.failover_ms} ms` : '',
  ].filter(Boolean).join(' · ')
  return {
    hop,
    policy,
    routes: routes.map((route) => ({
      ...route,
      tone: (finite(route.loss_pct) && route.loss_pct >= FORWARD_DOWN_LOSS ? 'down' : latencyTone(route.latency_ms)) as HopTone,
    })),
  }
}

export type FlowLevel = 0 | 1 | 2 | 3

/** 按一组服务器的实时上下行合计（主控下发为 byte/s，按 bit/s 分档）划分连线流动档位。 */
export function flowLevel(bytesPerSecond: number): FlowLevel {
  const bps = bytesPerSecond * 8
  if (!finite(bps) || bps < 50_000) return 0
  if (bps < 1_000_000) return 1
  if (bps < 20_000_000) return 2
  return 3
}

/**
 * 连线光点流动一轮的秒数：延迟越低越快，按档位取值（与延迟色阶同一组界线）。
 * 不随毫秒连续变化：快照每 3 秒刷新，时长一变浏览器就按新时长重算进度，光点会跳一下。
 */
export function flowDuration(ms: number | undefined): number {
  if (!finite(ms) || ms <= 0) return 2.4
  if (ms < 30) return 1
  if (ms < 80) return 1.6
  if (ms < FORWARD_SLOW_MS) return 2.4
  return 3.2
}
