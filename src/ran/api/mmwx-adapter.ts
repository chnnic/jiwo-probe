import type { ProbeServer } from '../../types'
import type { PingHistory, PingTask } from '@/api/client'
import type { KomariNode, KomariRecord } from '@/types/komari'

export function uuidFor(index: number) {
  return `mmwx-${index}`
}

function billingCycleDays(cycle?: ProbeServer['renewal_cycle']) {
  if (!cycle) return undefined
  return cycle === 'quarter' ? 90 : cycle === 'half_year' ? 180 : cycle === 'year' ? 365 : 30
}

function parseLoadAverage(value?: string) {
  if (!value) return []
  return value
    .trim()
    .split(/[\s,]+/)
    .map(Number)
    .filter(Number.isFinite)
}

function countryCode(server: ProbeServer) {
  const explicit = server.region_country?.trim().toUpperCase()
  if (explicit && /^[A-Z]{2}$/.test(explicit)) return explicit
  const source = server.region?.trim().toUpperCase()
  return source && /^[A-Z]{2}$/.test(source) ? source : undefined
}

function compactRegion(server: ProbeServer) {
  return countryCode(server) || server.region?.trim() || '未分组'
}

function currencySymbol(code?: string) {
  if (!code) return undefined
  const symbols: Record<string, string> = {
    USD: '$', CNY: '¥', EUR: '€', GBP: '£', CAD: 'C$', AUD: 'A$',
    HKD: 'HK$', TWD: 'NT$', SGD: 'S$', KRW: '₩', INR: '₹', BRL: 'R$',
  }
  return symbols[code.toUpperCase()] || code.toUpperCase()
}

export function toMmwxNode(server: ProbeServer, index: number): KomariNode {
  const useCny = server.renewal_price === undefined && server.renewal_price_cny !== undefined
  return {
    uuid: uuidFor(index),
    name: server.name?.trim() || `服务器 ${index + 1}`,
    os: server.os,
    cpu_name: server.cpu_model,
    cpu_model: server.cpu_model,
    cpu_cores: server.cpu_cores,
    cpu_threads: server.cpu_threads,
    kernel: server.kernel,
    arch: server.arch,
    region: compactRegion(server),
    region_country: countryCode(server),
    region_name: server.region_name,
    region_city: server.region_city,
    group: server.provider_name || undefined,
    expired_at: server.expires_at,
    price: useCny ? server.renewal_price_cny : server.renewal_price,
    billing_cycle: billingCycleDays(server.renewal_cycle),
    currency: useCny ? '¥' : currencySymbol(server.renewal_currency),
    traffic_limit: server.traffic_limit,
    traffic_used: server.traffic_used,
    traffic_used_up: server.traffic_used_up,
    traffic_used_down: server.traffic_used_down,
    traffic_used_total: server.traffic_used_total,
    period_start: server.period_start,
    period_end: server.period_end,
    provider: server.provider_name,
    provider_url: server.provider_url,
    telecom_paid_peer: server.telecom_paid_peer,
    return_routes: server.return_routes,
    weight: index,
    hidden: false,
    flag: countryCode(server),
    daily_traffic: server.daily_traffic,
  }
}

export function toMmwxRecord(server: ProbeServer, index: number): KomariRecord {
  const load = parseLoadAverage(server.loadavg)
  const validPing = (server.ping ?? []).filter((line) => line.current_ms >= 0)
  const validLoss = (server.ping ?? []).filter((line) => line.loss_pct >= 0)
  return {
    uuid: uuidFor(index),
    online: server.online,
    cpu: server.cpu_pct,
    memory_used: server.mem_used,
    memory_total: server.mem_total,
    disk_used: server.disk_used,
    disk_total: server.disk_total,
    network_tx: server.upload_speed,
    network_rx: server.download_speed,
    network_total_up: server.cumulative_up,
    network_total_down: server.cumulative_down,
    traffic_period_up: server.traffic_used_up,
    traffic_period_down: server.traffic_used_down,
    load1: load[0],
    load5: load[1],
    load15: load[2],
    uptime: server.uptime,
    os: server.os,
    cpu_model: server.cpu_model,
    updated_at: new Date().toISOString(),
    ping: validPing.length
      ? validPing.reduce((sum, line) => sum + line.current_ms, 0) / validPing.length
      : undefined,
    loss: validLoss.length
      ? validLoss.reduce((sum, line) => sum + line.loss_pct, 0) / validLoss.length
      : undefined,
  }
}

export function toMmwxPingHistory(servers: ProbeServer[], now = Date.now()): PingHistory {
  const taskIds = new Map<string, number>()
  const tasks = new Map<number, PingTask>()
  const records: PingHistory['records'] = []
  let nextTaskId = 1

  servers.forEach((server, serverIndex) => {
    for (const line of server.ping ?? []) {
      const taskKey = line.key || line.label || `线路-${nextTaskId}`
      let taskId = taskIds.get(taskKey)
      if (!taskId) {
        taskId = nextTaskId++
        taskIds.set(taskKey, taskId)
      }
      if (!tasks.has(taskId)) {
        tasks.set(taskId, {
          id: taskId,
          name: line.label || `线路 ${taskId}`,
          interval: 300,
          loss: line.loss_pct,
          avg: line.current_ms >= 0 ? line.current_ms : undefined,
          isp: line.isp,
        })
      }
      line.buckets.forEach((bucket, bucketIndex) => {
        records.push({
          task_id: taskId,
          client: uuidFor(serverIndex),
          time: new Date(now - (line.buckets.length - 1 - bucketIndex) * 300_000).toISOString(),
          value: bucket.ms,
          loss: bucket.loss < 0 ? null : bucket.loss,
        })
      })
    }
  })

  return { count: records.length, tasks: [...tasks.values()], records }
}
