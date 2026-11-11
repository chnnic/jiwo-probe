import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyProbeDelta, encodeProbeDelta, encodeProbeDeltaV2, isProbeDeltaFrame } from './probe-delta.ts'
import { buildDemoPayload } from '../scripts/screenshots/demo-data.mjs'

const now = Date.parse('2026-10-04T12:00:00Z')
const clone = value => structuredClone(value)
const roundTrip = (current, previous) => {
  const frame = encodeProbeDelta(current, previous)
  assert.ok(frame, '应生成增量帧')
  assert.ok(isProbeDeltaFrame(JSON.parse(JSON.stringify(frame))))
  const restored = applyProbeDelta(JSON.parse(JSON.stringify(frame)), previous)
  assert.deepEqual(restored, current)
  return JSON.stringify(frame).length
}

test('不变、换最后一项、整体左移三种情况都能无损还原，且明显变小', () => {
  const previous = buildDemoPayload({ now })
  const current = clone(previous)
  for (const server of current.servers) {
    server.cpu_pct += 1
    server.ping[0].current_ms += 3
    server.ping[0].buckets[11] = { ms: 99, loss: 0 }
    server.ping[1].buckets = [...server.ping[1].buckets.slice(1), { ms: 50, loss: 1 }]
    server.daily_traffic[6] = { ...server.daily_traffic[6], total: server.daily_traffic[6].total + 1 }
  }
  const deltaSize = roundTrip(current, previous)
  assert.ok(deltaSize < JSON.stringify(current).length * 0.6, `增量帧 ${deltaSize} 字节没有明显变小`)
})

test('服务器增减、换序或缺少基准时不生成增量帧，解码对不上基准返回 null', () => {
  const previous = buildDemoPayload({ now })
  const fewer = clone(previous)
  fewer.servers.pop()
  assert.equal(encodeProbeDelta(fewer, previous), null)
  const reordered = clone(previous)
  reordered.servers.reverse()
  assert.equal(encodeProbeDelta(reordered, previous), null)
  assert.equal(encodeProbeDelta(previous, null), null)
  const frame = encodeProbeDelta(clone(previous), previous)
  assert.equal(applyProbeDelta(frame, fewer), null)
  assert.equal(applyProbeDelta(frame, undefined), null)
})

test('延迟目标增减、字段变化或数组长度变化时退回完整字段', () => {
  const previous = buildDemoPayload({ now })
  const current = clone(previous)
  current.servers[0].ping.pop()
  current.servers[1].ping[0].label = '改名'
  current.servers[2].unlocks = current.servers[2].unlocks.slice(0, 3)
  current.servers[3].ping[2].extra = 1
  roundTrip(current, previous)
  const frame = encodeProbeDelta(current, previous)
  assert.ok(Array.isArray(frame.servers[0].ping), '目标数量变化应发完整 ping')
  assert.ok(Array.isArray(frame.servers[2].unlocks), '长度变化应发完整 unlocks')
})

const roundTripV2 = (current, previous) => {
  const frame = encodeProbeDeltaV2(current, previous)
  assert.ok(frame, '应生成第 2 版增量帧')
  const wire = JSON.parse(JSON.stringify(frame))
  assert.equal(wire.delta, 2)
  assert.ok(isProbeDeltaFrame(wire))
  assert.deepEqual(applyProbeDelta(wire, previous), current)
  return JSON.stringify(frame).length
}

test('第 2 版增量帧：没变的字段不发，仍能无损还原，并比第 1 版小得多', () => {
  const previous = buildDemoPayload({ now })
  const current = clone(previous)
  for (const server of current.servers) {
    server.cpu_pct += 1
    server.ping[0].current_ms += 3
    server.ping[0].buckets[11] = { ms: 99, loss: 0 }
    server.ping[1].buckets = [...server.ping[1].buckets.slice(1), { ms: 50, loss: 1 }]
    server.daily_traffic[6] = { ...server.daily_traffic[6], total: server.daily_traffic[6].total + 1 }
  }
  const v1 = roundTrip(current, previous)
  const v2 = roundTripV2(current, previous)
  assert.ok(v2 < v1 / 3, `第 2 版 ${v2} 字节应远小于第 1 版 ${v1} 字节`)
  const frame = encodeProbeDeltaV2(current, previous)
  assert.deepEqual(Object.keys(frame).sort(), ['delta', 'servers'])
  assert.equal('name' in frame.servers[0], false)
  assert.equal(frame.servers[0]._p[2], 0)
  // 完全没变：每台服务器只剩空对象
  const idle = encodeProbeDeltaV2(clone(previous), previous)
  assert.deepEqual(idle.servers.every(server => Object.keys(server).length === 0), true)
  assert.deepEqual(applyProbeDelta(JSON.parse(JSON.stringify(idle)), previous), previous)
})

test('第 2 版增量帧：字段新增、删除、置空与顶层变化都能还原', () => {
  const previous = buildDemoPayload({ now })
  const current = clone(previous)
  current.title = '新标题'
  delete current.show_globe
  current.tri_isp = { enabled: true, targets: [{ isp: 'telecom', key: 'bj-ct-v4', label: '北京电信' }] }
  const [a, b, c, d] = current.servers
  delete a.cpu_model
  delete a.ping
  b.brand_new = { nested: [1, 2] }
  b.unlocks = []
  c.online = false
  c.ping = c.ping.slice(1)
  delete d.daily_traffic
  d.return_routes = null
  roundTripV2(current, previous)
  // 反方向：字段重新出现
  roundTripV2(previous, current)
})

test('第 2 版增量帧：服务器列表对不上或数据里有保留字段时不生成，缺基准时解码返回 null', () => {
  const previous = buildDemoPayload({ now })
  const fewer = clone(previous)
  fewer.servers.pop()
  assert.equal(encodeProbeDeltaV2(fewer, previous), null)
  const renamed = clone(previous)
  renamed.servers[0].name = '换了名字'
  assert.equal(encodeProbeDeltaV2(renamed, previous), null)
  assert.equal(encodeProbeDeltaV2(previous, null), null)
  const clash = clone(previous)
  clash.servers[0]._x = ['oops']
  assert.equal(encodeProbeDeltaV2(clash, previous), null)
  const frame = encodeProbeDeltaV2(clone(previous), previous)
  assert.equal(applyProbeDelta(frame, undefined), null)
  assert.equal(applyProbeDelta(frame, fewer), null)
})

test('第 2 版增量帧：转发链条数和名称不变时按链只发变化的字段，结构变化时整份重发', () => {
  const chain = (name, extra = {}) => ({ name, end_to_end_ms: 40, loss_pct: 0, groups: [{ name: '入口', latency_ms: 10 }], trend: [1, 2, 3], traffic: { days: Array.from({ length: 30 }, (_, i) => i) }, cells: 'ggggggggdb', speed_up: 0, speed_down: 0, ...extra })
  const previous = { ...buildDemoPayload({ now }), forward: [chain('A'), chain('B'), chain('C')] }
  const current = clone(previous)
  current.forward[0].speed_up = 135
  current.forward[0].speed_down = 494
  delete current.forward[1].trend
  current.forward[1].jitter_ms = 2
  const frame = encodeProbeDeltaV2(current, previous)
  assert.equal('forward' in frame, false)
  assert.deepEqual(frame._f, [{ speed_up: 135, speed_down: 494 }, { jitter_ms: 2, _x: ['trend'] }, {}])
  roundTripV2(current, previous)
  // 转发链完全没变：不带 forward 也不带 _f
  const idle = encodeProbeDeltaV2(clone(previous), previous)
  assert.equal('_f' in idle, false)
  assert.equal('forward' in idle, false)
  // 增减、改名、换序：整份重发
  for (const next of [[chain('A'), chain('B')], [chain('A'), chain('B'), chain('D')], [chain('B'), chain('A'), chain('C')], []]) {
    const changed = { ...clone(previous), forward: next }
    const full = encodeProbeDeltaV2(changed, previous)
    assert.equal('_f' in full, false)
    assert.deepEqual(full.forward, next)
    roundTripV2(changed, previous)
    roundTripV2(previous, changed)
  }
  const removed = clone(previous)
  delete removed.forward
  roundTripV2(removed, previous)
  roundTripV2(previous, removed)
})
