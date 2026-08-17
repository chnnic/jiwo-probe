import type { ProbeServer } from './types'

export type TrafficRange = 'period' | 'recent7'

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
