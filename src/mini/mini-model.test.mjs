import { test } from 'node:test'
import assert from 'node:assert/strict'
import { averageLatency, expiryTime, isExpiring, miniSummary, providerName, ratio, selectServers, validNumber } from './mini-model.ts'

const options = { query: '', status: 'all', provider: '', sort: 'default' }
const servers = [
  { name: '重复名称', online: true, provider_name: ' Alpha ', cpu_pct: 0, mem_used: 0, mem_total: 100, upload_speed: 0, traffic_used: 0, ping: [{ current_ms: 0 }] },
  { name: 'Tokyo 10', online: false, provider_name: 'Beta', cpu_pct: 90, mem_used: 80, mem_total: 100, traffic_used: 500, expires_at: '2026-09-25', ping: [{ current_ms: -1 }] },
  { name: '重复名称', online: true, provider_name: 'Beta', cpu_pct: 10, traffic_used: 100, ping: [{ current_ms: 40 }, { current_ms: 60 }, { current_ms: -1 }] },
  { name: 'Tokyo 2', online: true, os: 'Debian', expires_at: 'invalid' },
]
const indices = (extra) => selectServers(servers, { ...options, ...extra }, Date.parse('2026-09-24T00:00:00')).map(item => item.index)

test('Mini 数值 0 与未上报不同，无限额度不计算百分比', () => {
  assert.equal(validNumber(0), 0)
  for (const value of [undefined, NaN, Infinity, -1]) assert.equal(validNumber(value), undefined)
  assert.equal(ratio(0, 100), 0)
  assert.ok(Math.abs(ratio(110, 100) - 110) < 1e-10)
  for (const values of [[0, 0], [1, undefined], [undefined, 10], [-1, 10]]) assert.equal(ratio(...values), undefined)
})
test('Mini 筛选保留原始下标，重名节点不合并', () => {
  assert.deepEqual(indices({ query: '重复名称' }), [0, 2])
  assert.deepEqual(indices({ status: 'online', provider: 'Beta' }), [2])
  assert.deepEqual(indices({ status: 'offline' }), [1])
  assert.deepEqual(indices({ query: ' DEBIAN ' }), [3])
  assert.deepEqual(indices({ query: 'not found' }), [])
  assert.equal(providerName(servers[0]), 'Alpha')
  assert.equal(providerName(servers[3]), '未标注服务商')
})
test('Mini 排序稳定，缺失值始终排后，0 延迟有效', () => {
  assert.deepEqual(indices({ sort: 'cpu' }), [1, 2, 0, 3])
  assert.deepEqual(indices({ sort: 'memory' }), [1, 0, 2, 3])
  assert.deepEqual(indices({ sort: 'traffic' }), [1, 2, 0, 3])
  assert.deepEqual(indices({ sort: 'latency' }), [0, 2, 1, 3])
  assert.deepEqual(indices({ sort: 'expiry' }), [1, 0, 2, 3])
  assert.deepEqual(indices({ query: 'Tokyo', sort: 'name' }), [3, 1])
  assert.equal(averageLatency(servers[2]), 50)
  assert.equal(averageLatency(servers[1]), undefined)
})
test('Mini 临期包含逾期，但不包含未知日期', () => {
  const now = Date.parse('2026-09-24T00:00:00')
  assert.deepEqual(indices({ status: 'expiring' }), [1])
  assert.equal(isExpiring({ expires_at: '2026-09-01' }, now), true)
  assert.equal(isExpiring({ expires_at: '2027-01-01' }, now), false)
  assert.equal(expiryTime(servers[3]), undefined)
})
test('Mini 概览汇总有效数据，空快照不伪造速度，离线不参与延迟均值', () => {
  const result = miniSummary(servers)
  assert.equal(result.online, 3)
  assert.equal(result.upload, 0)
  assert.equal(result.download, undefined)
  assert.equal(result.traffic, 600)
  assert.equal(result.latency, 25)
  assert.equal(miniSummary([]).traffic, undefined)
  assert.equal(miniSummary([]).online, 0)
})
