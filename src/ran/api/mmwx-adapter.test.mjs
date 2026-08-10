import assert from 'node:assert/strict'
import test from 'node:test'
import { toMmwxNode, toMmwxPingHistory, toMmwxRecord } from './mmwx-adapter.ts'

test('maps current-period fields without mixing them with cumulative counters', () => {
  const server = {
    online: true,
    traffic_used: 700,
    traffic_used_up: 300,
    traffic_used_down: 500,
    traffic_used_total: 800,
    traffic_limit: 1_000,
    period_start: '2026-08-01',
    period_end: '2026-09-01',
    cumulative_up: 9_000,
    cumulative_down: 12_000,
    cpu_threads: 8,
    kernel: '6.1.0',
  }

  const node = toMmwxNode(server, 0)
  const record = toMmwxRecord(server, 0)

  assert.equal(node.traffic_used, 700)
  assert.equal(node.traffic_used_up, 300)
  assert.equal(node.traffic_used_down, 500)
  assert.equal(node.traffic_used_total, 800)
  assert.equal(node.period_start, '2026-08-01')
  assert.equal(node.period_end, '2026-09-01')
  assert.equal(node.cpu_threads, 8)
  assert.equal(node.kernel, '6.1.0')
  assert.equal(record.network_total_up, 9_000)
  assert.equal(record.network_total_down, 12_000)
})

test('preserves missing cumulative fields instead of deriving them from daily traffic', () => {
  const server = {
    online: true,
    daily_traffic: [{ date: '2026-08-10', uplink: 10, downlink: 20, total: 30 }],
  }

  const record = toMmwxRecord(server, 0)
  assert.equal(record.network_total_up, undefined)
  assert.equal(record.network_total_down, undefined)
})

test('keeps ping no-data buckets distinct from packet loss', () => {
  const server = {
    online: true,
    ping: [{
      key: 'cm',
      label: 'China Mobile',
      isp: 'mobile',
      current_ms: 32,
      loss_pct: 12.5,
      buckets: [
        { ms: -1, loss: -1 },
        { ms: 31, loss: 0 },
        { ms: -1, loss: 100 },
      ],
    }],
  }

  const history = toMmwxPingHistory([server], Date.UTC(2026, 7, 10))
  assert.equal(history.tasks[0]?.isp, 'mobile')
  assert.deepEqual(history.records.map((record) => record.loss), [null, 0, 100])
  assert.deepEqual(history.records.map((record) => record.value), [-1, 31, -1])
})
