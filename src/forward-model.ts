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
