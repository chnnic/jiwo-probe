import type { ProbeServer } from './types'

// all：主控下发的全部每日流量（主控最多保存 30 天，每台服务器从开始统计算起，天数各不相同）
export type TrafficRange = 'period' | 'recent7' | 'all'

export function billableTraffic(server: ProbeServer): number | undefined {
  return server.traffic_used ?? server.traffic_used_total
}

export function hasTrafficPeriod(server: ProbeServer): boolean {
  return Boolean(server.period_start && server.period_end)
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
  if (range === 'period') return '当前周期'
  if (range === 'recent7') return '最近 7 日'
  return `全部 ${server.daily_traffic?.length ?? 0} 日`
}
