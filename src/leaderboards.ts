import type { ProbeServer } from './types'

// 先看实时网络/流量与连接规模，再看质量、资源和资产信息。
export const LEADERBOARD_ORDER = [
  'speed', 'today', 'traffic', 'usage', 'week', 'tcp', 'udp',
  'loss-cn', 'loss-idc', 'ping-cn', 'ping-idc',
  'cpu', 'mem', 'load', 'disk', 'uptime', 'expiry', 'cost',
] as const
export type LeaderboardKey = (typeof LEADERBOARD_ORDER)[number]

export const EMERALD_LEADERBOARD_ORDER = ['speed', 'traffic', 'tcp', 'udp', 'quality', 'uptime'] as const
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
