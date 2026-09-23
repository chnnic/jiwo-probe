import test from 'node:test'
import assert from 'node:assert/strict'
import { LEADERBOARD_ORDER, EMERALD_LEADERBOARD_ORDER, rankConnectionCounts } from './leaderboards.ts'

test('连接榜单按数值排序，TCP / UDP 独立且保留真实零', () => {
  const servers = [
    { tcp_connections: 9, udp_connections: 500 },
    { tcp_connections: 1000, udp_connections: 0 },
    { tcp_connections: 0, udp_connections: 12 },
  ]
  assert.deepEqual(rankConnectionCounts(servers, 'tcp').map(row => row.value), [1000, 9, 0])
  assert.deepEqual(rankConnectionCounts(servers, 'tcp', false).map(row => row.value), [0, 9, 1000])
  assert.deepEqual(rankConnectionCounts(servers, 'udp').map(row => row.value), [500, 12, 0])
  assert.deepEqual(rankConnectionCounts(servers, 'udp', false).map(row => row.value), [0, 12, 500])
})

test('未上报或无效连接数不参与排名，不受另一协议有效值影响', () => {
  const invalid = [undefined, null, '', '12', -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]
  const servers = invalid.map(tcp_connections => ({ tcp_connections, udp_connections: 8 }))
  assert.deepEqual(rankConnectionCounts(servers, 'tcp'), [])
  assert.equal(rankConnectionCounts(servers, 'udp').length, invalid.length)
  assert.deepEqual(rankConnectionCounts([], 'tcp'), [])
  assert.deepEqual(rankConnectionCounts([{}], 'udp'), [])
})

test('并列排序稳定、原节点索引正确且不修改原数组', () => {
  const servers = Object.freeze([
    Object.freeze({ name: 'missing' }),
    Object.freeze({ name: 'first', tcp_connections: 5 }),
    Object.freeze({ name: 'second', tcp_connections: 5 }),
    Object.freeze({ name: 'offline', online: false, tcp_connections: 10 }),
  ])
  const rows = rankConnectionCounts(servers, 'tcp')
  assert.deepEqual(rows.map(row => row.index), [3, 1, 2])
  assert.deepEqual(rankConnectionCounts(servers, 'tcp', false).map(row => row.index), [1, 2, 3])
  for (const row of rows) assert.equal(row.server, servers[row.index])
  assert.equal(servers[0].name, 'missing')
})

test('共享排序不截断数量，由通用榜单 Top 10 和 Emerald 自行控制展示', () => {
  const servers = Array.from({ length: 15 }, (_, tcp_connections) => ({ tcp_connections }))
  assert.equal(rankConnectionCounts(servers, 'tcp').length, 15)
  assert.equal(rankConnectionCounts(servers, 'tcp').slice(0, 10).at(-1).value, 5)
})

test('榜单维度完整不重复，网络与连接数在资源和资产前面', () => {
  assert.equal(LEADERBOARD_ORDER.length, 18)
  assert.equal(new Set(LEADERBOARD_ORDER).size, 18)
  assert.deepEqual(LEADERBOARD_ORDER.slice(0, 7), ['speed', 'today', 'traffic', 'usage', 'week', 'tcp', 'udp'])
  assert.deepEqual(LEADERBOARD_ORDER.slice(7), ['loss-cn', 'loss-idc', 'ping-cn', 'ping-idc', 'cpu', 'mem', 'load', 'disk', 'uptime', 'expiry', 'cost'])
  assert.deepEqual(EMERALD_LEADERBOARD_ORDER, ['speed', 'traffic', 'tcp', 'udp', 'quality', 'uptime'])
})
