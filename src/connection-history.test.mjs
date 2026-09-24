import { test } from 'node:test'
import assert from 'node:assert/strict'
import { connectionHistoryKey, connectionRows, recordConnectionSnapshot, CONNECTION_RETENTION_SECONDS } from './connection-history.ts'

const server = { name: 'node-a', online: true, tcp_connections: 81, udp_connections: 22 }
const samples = (history, node = server, index = 0) => history.get(connectionHistoryKey(node, index))

test('连接曲线仅记录真实收到的快照，每 30 秒最多一个点', () => {
  const first = recordConnectionSnapshot(new Map(), [server], 1000)
  assert.deepEqual(samples(first), [{ ts: 1000, tcp: 81, udp: 22 }])
  assert.equal(recordConnectionSnapshot(first, [server], 1000), first)
  assert.equal(recordConnectionSnapshot(first, [server], 1029), first)
  const next = recordConnectionSnapshot(first, [{ ...server, tcp_connections: 90 }], 1030)
  assert.deepEqual(samples(next), [{ ts: 1000, tcp: 81, udp: 22 }, { ts: 1030, tcp: 90, udp: 22 }])
  assert.equal(samples(first).length, 1, 'immutable previous snapshot')
})
test('连接曲线保留真实零；非法、缺失与离线快照使用空点', () => {
  let history = recordConnectionSnapshot(new Map(), [{ ...server, tcp_connections: 0, udp_connections: 0 }], 1000)
  assert.deepEqual(samples(history)[0], { ts: 1000, tcp: 0, udp: 0 })
  for (const [index, value] of [undefined, null, -1, NaN, Infinity, '23'].entries()) {
    history = recordConnectionSnapshot(history, [{ ...server, tcp_connections: value, udp_connections: value }], 1030 + index * 30)
    assert.equal(samples(history).at(-1).tcp, null)
    assert.equal(samples(history).at(-1).udp, null)
  }
  history = recordConnectionSnapshot(history, [{ ...server, online: false }], 1210)
  assert.deepEqual(samples(history).at(-1), { ts: 1210, tcp: null, udp: null })
})
test('断流、休眠和重新连接期间不补点、不连成虚假连续曲线', () => {
  const first = recordConnectionSnapshot(new Map(), [server], 1000)
  const next = recordConnectionSnapshot(first, [server], 1600)
  assert.deepEqual(samples(next), [{ ts: 1000, tcp: 81, udp: 22 }, { ts: 1030, tcp: null, udp: null }, { ts: 1600, tcp: 81, udp: 22 }])
  for (const time of [0, -1, NaN, Infinity, 900]) assert.equal(recordConnectionSnapshot(first, [server], time), first)
})
test('不同节点、重排、重命名和移除不串数据；新页面为空', () => {
  const other = { ...server, name: 'node-b', tcp_connections: 5 }
  const first = recordConnectionSnapshot(new Map(), [server, other], 1000)
  assert.equal(samples(first, other, 1)[0].tcp, 5)
  const reordered = recordConnectionSnapshot(first, [other, server], 1005)
  assert.equal(samples(reordered, other, 0).length, 1)
  assert.equal(samples(reordered, server, 1)[0].ts, 1005)
  const renamed = recordConnectionSnapshot(reordered, [{ ...other, name: 'renamed' }], 1010)
  assert.equal(renamed.size, 1)
  assert.equal(renamed.has(connectionHistoryKey(other, 0)), false)
  assert.equal(recordConnectionSnapshot(first, [], 1005).size, 0)
  assert.equal(new Map().size, 0)
})
test('内存只保留当前会话最近 24 小时，范围筛选不改变源数据', () => {
  let history = new Map()
  for (let ts = 1000; ts <= 1000 + CONNECTION_RETENTION_SECONDS + 300; ts += 30) history = recordConnectionSnapshot(history, [server], ts)
  const points = samples(history)
  assert.equal(points.length, 2881)
  assert.equal(points[0].ts, 1300)
  assert.equal(connectionRows(points, 1).length, 121)
  assert.equal(connectionRows(points, 6).length, 721)
  assert.equal(connectionRows(points, 24).length, 2881)
  assert.deepEqual(connectionRows([], 1), [])
  assert.deepEqual(connectionRows(points, -1), [])
  assert.equal(points.length, 2881)
})
