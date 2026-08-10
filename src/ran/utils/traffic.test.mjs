import assert from 'node:assert/strict'
import test from 'node:test'
import { computeTrafficQuota } from './traffic.ts'

test('uses authoritative MMWX billed usage for quota progress', () => {
  const node = {
    uuid: 'mmwx-0',
    traffic_limit: 1_000,
    traffic_used: 400,
    traffic_used_up: 300,
    traffic_used_down: 500,
    traffic_used_total: 800,
  }
  const record = {
    uuid: 'mmwx-0',
    online: true,
    network_total_up: 9_000,
    network_total_down: 12_000,
  }

  const quota = computeTrafficQuota(node, record)
  assert.equal(quota?.used, 400)
  assert.equal(quota?.percent, 40)
  assert.equal(quota?.mode, 'reported')
  assert.equal(quota?.up, 300)
  assert.equal(quota?.down, 500)
})

test('does not turn a missing reported value into zero', () => {
  const node = { uuid: 'mmwx-0', traffic_limit: 1_000 }
  assert.equal(computeTrafficQuota(node), undefined)
})

test('retains the legacy fallback only when both cumulative counters exist', () => {
  const node = {
    uuid: 'legacy',
    traffic_limit: 1_000,
    traffic_limit_type: 'sum',
  }
  const complete = {
    uuid: 'legacy',
    online: true,
    network_total_up: 100,
    network_total_down: 200,
  }
  const partial = { uuid: 'legacy', online: true, network_total_up: 100 }

  assert.equal(computeTrafficQuota(node, complete)?.used, 300)
  assert.equal(computeTrafficQuota(node, partial), undefined)
})
