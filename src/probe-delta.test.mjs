import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyProbeDelta, encodeProbeDelta, isProbeDeltaFrame } from './probe-delta.ts'
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
