import type { ProbeServer } from './types'
import { normalizeUnlocks, unlockCategorySummaries, unlockSummary } from './unlocks.ts'

// 先看实时网络/流量与连接规模，再看质量、资源和资产信息。
export const LEADERBOARD_ORDER = [
  'speed', 'today', 'traffic', 'usage', 'week', 'tcp', 'udp', 'unlock',
  'loss-cn', 'loss-idc', 'ping-cn', 'ping-idc',
  'cpu', 'mem', 'load', 'disk', 'uptime', 'expiry', 'cost',
] as const
export type LeaderboardKey = (typeof LEADERBOARD_ORDER)[number]

export const EMERALD_LEADERBOARD_ORDER = ['speed', 'traffic', 'tcp', 'udp', 'quality', 'unlock', 'uptime'] as const
export type EmeraldRankingType = (typeof EMERALD_LEADERBOARD_ORDER)[number]

export function rankConnectionCounts<T extends Pick<ProbeServer, 'tcp_connections' | 'udp_connections'>>(
  servers: T[], protocol: 'tcp' | 'udp', descending = true,
): { server: T; index: number; value: number }[] {
  const field = protocol === 'tcp' ? 'tcp_connections' : 'udp_connections'
  return servers
    .map((server, index) => ({ server, index, value: server[field] }))
    .filter((row): row is { server: T; index: number; value: number } =>
      typeof row.value === 'number' && Number.isSafeInteger(row.value) && row.value >= 0)
    .sort((a, b) => (descending ? b.value - a.value : a.value - b.value) || a.index - b.index)
}

/**
 * 解锁排行：与主控解锁徽标同一口径（unlockSummary）——仅自制剧算解锁，检测失败不进分母。
 * 已解锁项数优先，其次解锁率；没有解锁检测数据的节点不参与排名。
 */
export function rankUnlocks<T extends Pick<ProbeServer, 'unlocks'>>(servers: T[], descending = true) {
  const direction = descending ? 1 : -1
  return servers
    .map((server, index) => {
      const summary = unlockSummary(normalizeUnlocks(server.unlocks))
      const ratio = summary.total > 0 ? summary.unlocked / summary.total : 0
      const categories = unlockCategorySummaries(server.unlocks).filter((category) => category.total > 0)
      return { server, index, unlocked: summary.unlocked, total: summary.total, ratio, categories }
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => direction * (b.unlocked - a.unlocked) || direction * (b.ratio - a.ratio) || a.index - b.index)
}
