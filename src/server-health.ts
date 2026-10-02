import type { ProbeServer } from './types.ts'
import { isPermanent } from './renewal.ts'

export function averageLatency(server: ProbeServer): number | undefined {
  const values = (server.ping || [])
    .map((series) => series.current_ms)
    .filter((value) => value >= 0)
  if (!values.length) return undefined
  return Math.round(
    values.reduce((total, value) => total + value, 0) / values.length
  )
}


export function percentage(used?: number, total?: number): number {
  if (!total || total <= 0) return 0
  return Math.min(100, Math.max(0, (Number(used || 0) / total) * 100))
}


export function resourcePercentage(used?: number, total?: number): number | undefined {
  if (used === undefined || !total) return undefined
  return percentage(used, total)
}


export type HealthResult = {
  score: number
  label: '卓越' | '良好' | '注意' | '异常'
  tone: 'excellent' | 'good' | 'warning' | 'critical'
  issues: string[]
}


export function serverHealth(server: ProbeServer): HealthResult {
  if (!server.online) {
    return { score: 0, label: '异常', tone: 'critical', issues: ['服务器离线'] }
  }
  let score = 100
  const issues: string[] = []
  const mem = resourcePercentage(server.mem_used, server.mem_total)
  const disk = resourcePercentage(server.disk_used, server.disk_total)
  const resources = [
    ['CPU', server.cpu_pct],
    ['内存', mem],
    ['硬盘', disk],
  ] as const
  for (const [name, value] of resources) {
    if (value === undefined) continue
    if (value >= 90) {
      score -= 18
      issues.push(`${name}压力过高`)
    } else if (value >= 75) {
      score -= 9
      issues.push(`${name}压力偏高`)
    }
  }
  const latency = averageLatency(server)
  const losses = (server.ping || [])
    .map((item) => item.loss_pct)
    .filter((value) => value >= 0)
  const loss = losses.length
    ? losses.reduce((total, value) => total + value, 0) / losses.length
    : undefined
  if (latency !== undefined && latency >= 250) {
    score -= 18
    issues.push('网络延迟过高')
  } else if (latency !== undefined && latency >= 120) {
    score -= 8
    issues.push('网络延迟偏高')
  }
  if (loss !== undefined && loss >= 10) {
    score -= 20
    issues.push('丢包严重')
  } else if (loss !== undefined && loss >= 3) {
    score -= 9
    issues.push('存在丢包')
  }
  if (server.traffic_limit) {
    const used = server.traffic_used ?? server.traffic_used_total ?? 0
    const quota = percentage(used, server.traffic_limit)
    if (quota >= 95) {
      score -= 16
      issues.push('流量额度即将耗尽')
    } else if (quota >= 80) {
      score -= 7
      issues.push('流量额度偏高')
    }
  }
  if (server.expires_at && !isPermanent(server)) {
    const days = Math.ceil(
      (new Date(`${server.expires_at}T00:00:00`).getTime() - Date.now()) /
        86400000
    )
    if (days < 0) {
      score -= 20
      issues.push('服务器已到期')
    } else if (days <= 14) {
      score -= 8
      issues.push('服务器即将到期')
    }
  }
  score = Math.max(0, Math.round(score))
  if (score >= 90) return { score, label: '卓越', tone: 'excellent', issues }
  if (score >= 75) return { score, label: '良好', tone: 'good', issues }
  if (score >= 55) return { score, label: '注意', tone: 'warning', issues }
  return { score, label: '异常', tone: 'critical', issues }
}
