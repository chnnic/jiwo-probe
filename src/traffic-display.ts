import type { ProbeServer } from './types'

// all：主控下发的全部每日流量（主控最多保存 30 天，每台服务器从开始统计算起，天数各不相同）
export type TrafficRange = 'period' | 'recent7' | 'all'

export function billableTraffic(server: ProbeServer): number | undefined {
  return server.traffic_used ?? server.traffic_used_total
}

export function hasTrafficPeriod(server: ProbeServer): boolean {
  return Boolean(server.period_start && server.period_end)
}

const DAY_MS = 86_400_000
const DAYS_PER_MONTH = 365.25 / 12

/** 流量周期跨了多少天；主控没下发周期或日期不合法时返回 undefined */
export function trafficPeriodDays(server: ProbeServer): number | undefined {
  if (!server.period_start || !server.period_end) return undefined
  const days = Math.round((Date.parse(server.period_end) - Date.parse(server.period_start)) / DAY_MS)
  return Number.isFinite(days) && days > 0 ? days : undefined
}

/**
 * 流量额度对应几个月：主控的流量重置周期有一个月、三个月、半年、一年，额度按整个周期给，
 * 折算月度单价时要先摊到每月。没有周期信息时按月处理（与以前一致）。
 */
export function trafficPeriodMonths(server: ProbeServer): number {
  const days = trafficPeriodDays(server)
  return days === undefined ? 1 : Math.max(1, Math.round(days / DAYS_PER_MONTH))
}

/** 一次性流量：主控不下发周期，用量从计数器重置起一直累计、不再重置 */
export function isOneTimeTraffic(server: ProbeServer): boolean {
  return server.traffic_used_scope === 'counter_since_reset' && !hasTrafficPeriod(server)
}

/**
 * 流量周期的起止日期；一次性流量返回「一次性流量」。按月重置时只写月-日；半年、一年等长周期两端可能月-日相同（05-01 — 05-01），
 * 必须带上年份才看得出跨度。
 */
export function trafficPeriodText(server: ProbeServer, separator = ' — '): string | undefined {
  if (isOneTimeTraffic(server)) return '一次性流量'
  if (!server.period_start || !server.period_end) return undefined
  const days = trafficPeriodDays(server)
  const short = days !== undefined && days <= 40
  const format = (date: string) => (short ? date.slice(5, 10) : date.slice(0, 10))
  return `${format(server.period_start)}${separator}${format(server.period_end)}`
}

export function trafficUsageLabel(server: ProbeServer): string {
  if (
    server.traffic_used_scope === 'configured_period' ||
    hasTrafficPeriod(server)
  ) {
    return '本周期计费用量'
  }
  if (server.traffic_used_scope === 'counter_since_reset') {
    return '计数器重置以来计费用量'
  }
  return '当前计费用量'
}

export function trafficSourceLabel(server: ProbeServer): string | undefined {
  if (server.traffic_source === 'system') return '系统网卡'
  if (server.traffic_source === 'xray') return 'Xray 节点'
  return undefined
}

export function trafficModeLabel(server: ProbeServer): string | undefined {
  switch (server.traffic_stats_mode) {
    case 'both':
      return '上行 + 下行'
    case 'upload':
      return '仅上行'
    case 'download':
      return '仅下行'
    case 'max':
      return '上/下行取较大值'
    default:
      return undefined
  }
}

export function trafficRuleLabel(server: ProbeServer): string {
  const parts = [trafficSourceLabel(server), trafficModeLabel(server)].filter(
    (value): value is string => Boolean(value)
  )
  return parts.length > 0 ? parts.join(' · ') : '主控计费口径'
}

export function trafficFormulaLabel(server: ProbeServer): string | undefined {
  if (
    server.traffic_used_up === undefined ||
    server.traffic_used_down === undefined
  ) {
    return undefined
  }
  const mode = trafficModeLabel(server)
  if (!mode) return undefined
  return server.traffic_adjustment !== undefined
    ? `${mode} + 对账调整`
    : mode
}

export function bootTraffic(server: ProbeServer): {
  uplink?: number
  downlink?: number
} {
  return {
    uplink: server.boot_traffic_up ?? server.cumulative_up,
    downlink: server.boot_traffic_down ?? server.cumulative_down,
  }
}

export function dailyTrafficRows(
  server: ProbeServer,
  range: TrafficRange
): NonNullable<ProbeServer['daily_traffic']> {
  const rows = [...(server.daily_traffic || [])].sort((left, right) =>
    left.date.localeCompare(right.date)
  )
  if (range === 'all') return rows
  if (
    range === 'period' &&
    server.period_start &&
    server.period_end
  ) {
    return rows.filter(
      (row) =>
        row.date >= server.period_start! && row.date < server.period_end!
    )
  }
  return rows.slice(-7)
}

/** 每日流量超过 7 天时才值得提供「全部」：否则与「最近 7 日」完全相同。 */
export function hasMoreDailyTraffic(server: ProbeServer): boolean {
  return (server.daily_traffic?.length ?? 0) > 7
}

export function trafficRangeLabel(range: TrafficRange, server: ProbeServer): string {
  if (range === 'period') {
    // 长周期（半年、一年）主控只下发最近几十天的每日流量，覆盖不到周期开头时如实写天数
    const covered = !server.period_start || !server.daily_traffic_start || server.daily_traffic_start <= server.period_start
    return covered ? '当前周期' : `本周期近 ${dailyTrafficRows(server, 'period').length} 日`
  }
  if (range === 'recent7') return '最近 7 日'
  return `全部 ${server.daily_traffic?.length ?? 0} 日`
}
