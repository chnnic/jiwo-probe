import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCachedSnapshot, SNAPSHOT_MAX_AGE_MS } from './probe-snapshot-cache.ts'

const now = 1_800_000_000_000
const record = (payload, savedAt = now - 60_000) => ({ savedAt, json: JSON.stringify(payload) })

test('还原快照时保留数据和保存时间，但清零实时网速', () => {
  const snapshot = parseCachedSnapshot(record({ enabled: true, servers: [{ name: 'a', upload_speed: 900, download_speed: 800, traffic_used: 5 }] }), now)
  assert.equal(snapshot.savedAt, now - 60_000)
  assert.equal(snapshot.payload.enabled, true)
  assert.deepEqual(snapshot.payload.servers, [{ name: 'a', upload_speed: 0, download_speed: 0, traffic_used: 5 }])
})

test('超过一天的快照不再使用，刚好一天的还能用', () => {
  const payload = { servers: [] }
  assert.ok(parseCachedSnapshot(record(payload, now - SNAPSHOT_MAX_AGE_MS), now))
  assert.equal(parseCachedSnapshot(record(payload, now - SNAPSHOT_MAX_AGE_MS - 1), now), undefined)
})

test('保存时间在未来的快照不使用（访客改过系统时间）', () => {
  assert.equal(parseCachedSnapshot(record({ servers: [] }, now + 1), now), undefined)
})

test('记录缺失或损坏时返回 undefined，不抛异常', () => {
  for (const bad of [undefined, null, 'x', {}, { savedAt: now }, { savedAt: now, json: '{' }, { savedAt: now, json: 'null' }, { savedAt: now, json: '{"servers":1}' }]) {
    assert.equal(parseCachedSnapshot(bad, now), undefined)
  }
})
