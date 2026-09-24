import test from 'node:test'
import assert from 'node:assert/strict'
import { filledSegments, loadMetric, quotaMetric, resetDays, speedTone, parseLuminaPlusView } from './luminaplus-model.ts'

test('segments preserve small values, cap overflow, and do not fabricate missing usage', () => {
  for (const value of [undefined, NaN, Infinity, -1, 0]) assert.equal(filledSegments(value), 0)
  assert.equal(filledSegments(.01), 1)
  assert.equal(filledSegments(26), 6)
  assert.equal(filledSegments(200), 20)
})
test('load is normalized by actual core count only', () => {
  assert.deepEqual(loadMetric({ loadavg: '  0.25 0.5 1.0 ', cpu_cores: 2 }), { value: .25, percent: 12.5 })
  assert.deepEqual(loadMetric({ loadavg: '0 0 0' }), { value: 0, percent: undefined })
  assert.equal(loadMetric({ loadavg: 'unknown', cpu_cores: 2 }).value, undefined)
  assert.equal(loadMetric({ loadavg: '-1 0 0', cpu_cores: 2 }).value, undefined)
  assert.equal(loadMetric({ loadavg: '1', cpu_cores: 0 }).percent, undefined)
})
test('quota uses controller counter without doubling single-direction traffic', () => {
  for (const traffic_stats_mode of ['both', 'upload', 'download', 'max']) {
    assert.equal(quotaMetric({ traffic_stats_mode, traffic_used: 40, traffic_used_up: 30, traffic_used_down: 40, traffic_limit: 100 }).remaining, 60)
  }
  assert.equal(quotaMetric({ traffic_limit: 100, traffic_used: 0, traffic_used_total: 80 }).remaining, 100)
  assert.equal(quotaMetric({ traffic_limit: 100, traffic_used_total: 80 }).percent, 80)
  assert.equal(quotaMetric({ traffic_limit: 100, traffic_used: 140 }).remaining, 0)
  assert.equal(quotaMetric({ traffic_limit: 100, traffic_used: 140 }).exceeded, true)
  assert.equal(quotaMetric({ traffic_limit: 0, traffic_used: 80 }).unlimited, true)
  assert.equal(quotaMetric({ traffic_limit: 0, traffic_used: 80 }).percent, undefined)
  assert.equal(quotaMetric({ traffic_limit: 100 }).remaining, undefined)
  assert.equal(quotaMetric({ traffic_limit: -1 }).unlimited, false)
})
test('reset date comes only from a valid future period end', () => {
  const now = Date.parse('2026-09-24T00:00:00Z')
  assert.equal(resetDays('2026-09-30T00:00:00Z', now), 6)
  assert.equal(resetDays('2026-09-24T00:00:00Z', now), 0)
  for (const value of [undefined, 'invalid', '2026-09-01']) assert.equal(resetDays(value, now), undefined)
})
test('speed tones match original binary B/KB/MB/GB tiers independently of display units', () => {
  assert.equal(speedTone(0), 'idle')
  assert.equal(speedTone(1023.999), 'idle')
  assert.equal(speedTone(1024), 'low')
  assert.equal(speedTone(44032), 'low') // 43 KB/s / 352 Kbps use the same gold tone.
  assert.equal(speedTone(1024 ** 2 - 1), 'low')
  assert.equal(speedTone(1024 ** 2), 'high')
  assert.equal(speedTone(25 * 1024 ** 2), 'high')
  assert.equal(speedTone(1024 ** 3 - 1), 'high')
  assert.equal(speedTone(1024 ** 3), 'max')
  assert.equal(speedTone(Number.MAX_VALUE), 'max')
  for (const value of [undefined, -1, NaN, Infinity]) assert.equal(speedTone(value), 'unknown')
})
test('display mode preferences accept only independent supported modes', () => {
  assert.equal(parseLuminaPlusView('compact'), 'compact')
  assert.equal(parseLuminaPlusView('list'), 'list')
  for (const value of ['card', null, 'detailed', 'mini', {}]) assert.equal(parseLuminaPlusView(value), 'card')
})
