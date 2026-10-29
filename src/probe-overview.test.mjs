import { test } from 'node:test'
import assert from 'node:assert/strict'
import { connectionTotals, kpiColumns, dailyTrafficTotals, formatCapacity, formatSize, meterTone, networkQuality, pingQuality, probeHealthIssue, quotaPerServer, quotaSummary, relativeTime, sortProbeServers } from './probe-overview.ts'

const GB = 1024 ** 3

test('已用 / 总量：两边同一单位，去掉多余的 .0', () => {
  assert.equal(formatCapacity(1 * GB, 8 * GB), '1 / 8 GB')
  assert.equal(formatCapacity(1.5 * GB, 2 * GB), '1.5 / 2 GB')
  assert.equal(formatCapacity(18.4 * GB, 20 * GB), '18.4 / 20 GB')
  assert.equal(formatCapacity(300 * 1024 ** 2, 512 * 1024 ** 2), '300 / 512 MB')
  assert.equal(formatCapacity(150 * GB, 500 * GB), '150 / 500 GB')
  assert.equal(formatSize(20 * GB), '20 GB')
})

test('健康判定：取超过 90% 里最严重的一项，离线机器不判', () => {
  const server = { online: true, cpu_pct: 38, mem_used: 1.5, mem_total: 2, disk_used: 92.1, disk_total: 100, traffic_limit: 100 }
  assert.deepEqual(probeHealthIssue(server, 30), { key: 'disk', pct: 92.1 })
  assert.equal(probeHealthIssue({ ...server, disk_used: 50 }, 30), undefined)
  assert.equal(probeHealthIssue({ ...server, disk_used: 50 }, 95)?.key, 'traffic')
  assert.equal(probeHealthIssue({ ...server, online: false }, 99), undefined)
})

test('进度条配色：超过 90% 红，超过 70% 黄', () => {
  assert.equal(meterTone(95), 'bad')
  assert.equal(meterTone(90), 'warn')
  assert.equal(meterTone(71), 'warn')
  assert.equal(meterTone(70), undefined)
})

test('排序：没有数据的排最后，相同时保持原顺序', () => {
  const list = [
    { index: 0, server: { online: true, name: 'b', cpu_pct: 5 } },
    { index: 1, server: { online: true, name: 'a' } },
    { index: 2, server: { online: true, name: 'c', cpu_pct: 50 } },
    { index: 3, server: { online: true, name: 'd', cpu_pct: 5 } },
  ]
  const used = () => 0
  assert.deepEqual(sortProbeServers(list, 'cpu', used).map((x) => x.index), [2, 0, 3, 1])
  assert.deepEqual(sortProbeServers(list, 'name', used).map((x) => x.server.name), ['a', 'b', 'c', 'd'])
  assert.equal(sortProbeServers(list, 'default', used), list)
})

test('排序：延迟按最低的一条从小到大，失败的 -1 不算', () => {
  const list = [
    { index: 0, server: { online: true, ping: [{ current_ms: 80 }, { current_ms: -1 }] } },
    { index: 1, server: { online: true, ping: [{ current_ms: -1 }] } },
    { index: 2, server: { online: true, ping: [{ current_ms: 30 }, { current_ms: 120 }] } },
  ]
  assert.deepEqual(sortProbeServers(list, 'latency', () => 0).map((x) => x.index), [2, 0, 1])
})

test('相对时间：刚刚、分钟、小时、天', () => {
  const now = Date.parse('2026-10-22T01:49:00Z')
  assert.equal(relativeTime('2026-10-22T01:12:00Z', now), '37 分钟前')
  assert.equal(relativeTime('2026-10-22T01:48:40Z', now), '刚刚')
  assert.equal(relativeTime('2026-10-20T01:00:00Z', now), '2 天前')
  assert.equal(relativeTime('坏数据', now), '')
})

test('近 7 天日流量：按日期合计各服务器，只留最近的天数', () => {
  const servers = [
    { online: true, daily_traffic: [{ date: '2026-10-20', total: 1 }, { date: '2026-10-21', total: 2 }, { date: '2026-10-22', total: 3 }] },
    { online: true, daily_traffic: [{ date: '2026-10-22', total: 4 }] },
    { online: true, daily_traffic_estimated: true, daily_traffic: [{ date: '2026-10-22', total: 100 }] },
  ]
  // 估算日流量的机器不计入（与主控探针页一致）
  assert.deepEqual(dailyTrafficTotals(servers, 2), [{ date: '2026-10-21', total: 2 }, { date: '2026-10-22', total: 7 }])
  assert.deepEqual(dailyTrafficTotals([{ online: true }]), [])
})

test('本期流量额度：只算设了限额的服务器，超 80% 单独计数', () => {
  const q = quotaSummary([
    { online: true, traffic_used: 90, traffic_limit: 100 },
    { online: true, traffic_used: 10, traffic_limit: 300 },
    { online: true, traffic_used: 999 },
  ])
  assert.deepEqual(q, { used: 100, limit: 400, pct: 25, count: 2, over80: 1 })
  assert.equal(quotaSummary([{ online: true, traffic_used: 5 }]), undefined)
})

test('网络质量：在线服务器取各目标平均，按 Premium 同一口径分优中差', () => {
  const q = networkQuality([
    { online: true, ping: [{ current_ms: 30, loss_pct: 0 }, { current_ms: 50, loss_pct: 1 }] },
    { online: true, ping: [{ current_ms: 130, loss_pct: 0 }] },
    { online: true, ping: [{ current_ms: 20, loss_pct: 12 }] },
    { online: true, ping: [{ current_ms: -1, loss_pct: -1 }] },
    { online: false, ping: [{ current_ms: 999, loss_pct: 50 }] },
  ])
  assert.equal(q.total, 3)
  assert.equal(q.latency, (40 + 130 + 20) / 3)
  assert.deepEqual([q.good, q.medium, q.poor], [1, 1, 1])
  assert.equal(pingQuality(100, 2), 'good')
  // 有分桶时按近 1 小时平均算，而不是当前值
  const hourly = networkQuality([{ online: true, ping: [{ current_ms: 20, loss_pct: 0, buckets: [{ ms: 100, loss: 0 }, { ms: 160, loss: 6 }, { ms: -1, loss: -1 }] }] }])
  assert.equal(hourly.latency, 130)
  assert.equal(hourly.loss, 3)
  assert.equal(hourly.medium, 1)
  assert.equal(networkQuality([{ online: true }]), undefined)
  const dual = networkQuality([{ online: true, ping: [{ key: 'sh-ct-v4', label: '上海电信', current_ms: 40, loss_pct: 0, buckets: [{ ms: 40, loss: 0 }] }, { key: 'sh-cu-v6', label: '上海联通 IPv6', current_ms: 300, loss_pct: 30, buckets: [{ ms: 300, loss: 30 }] }] }])
  assert.equal(dual.latency, 40)
})

test('连接数：合计 TCP / UDP，曲线分 TCP、UDP 按末尾对齐相加，全缺的时段为 null', () => {
  const c = connectionTotals([
    { online: true, tcp_connections: 10, udp_connections: 2, conn_history: { tcp: [1, null, 3], udp: [1, null, null] } },
    { online: true, tcp_connections: 5, conn_history: { tcp: [null, 1], udp: [null, 0] } },
  ])
  assert.deepEqual(c, { tcp: 15, udp: 2, total: 17, tcpHistory: [1, null, 4], udpHistory: [1, null, 0] })
  assert.deepEqual(connectionTotals([{ online: true, tcp_connections: 1 }]), { tcp: 1, udp: 0, total: 1, tcpHistory: undefined, udpHistory: undefined })
  assert.equal(connectionTotals([{ online: true }]), undefined)
})

test('额度每台用量：只算设了额度的，封顶 100%，从高到低', () => {
  assert.deepEqual(quotaPerServer([
    { name: 'a', online: true, traffic_limit: 100, traffic_used: 30 },
    { name: 'b', online: true, traffic_limit: 100, traffic_used: 150 },
    { name: 'c', online: true, traffic_used: 50 },
    { name: 'd', online: false, traffic_limit: 200 },
  ]), [{ name: 'b', pct: 100 }, { name: 'a', pct: 30 }, { name: 'd', pct: 0 }])
})

test('汇总格列数：按卡宽算一行最多几格，各行格数均分，手机两列', () => {
  assert.equal(kpiColumns(6, 0), 3)
  assert.equal(kpiColumns(6, 375), 2)
  assert.equal(kpiColumns(6, 700), 2)
  assert.equal(kpiColumns(6, 1060), 3)
  assert.equal(kpiColumns(6, 1600), 3)
  assert.equal(kpiColumns(6, 2000), 6)
  assert.equal(kpiColumns(5, 1060), 3)
  assert.equal(kpiColumns(4, 1300), 4)
  assert.equal(kpiColumns(1, 1300), 1)
})
