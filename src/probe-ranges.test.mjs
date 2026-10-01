import assert from 'node:assert/strict'
import test from 'node:test'
import { effectiveProbeRange, probeHistoryDays, probeRangeBucketSec, probeRangeOptions } from './probe-ranges.ts'

const keys = days => probeRangeOptions(days).map(option => option.key)

test('older controllers and malformed retention retain the three hourly ranges', () => {
  for (const days of [undefined, null, NaN, Infinity, -Infinity, 0, -4, '7']) {
    assert.deepEqual(keys(days), ['1h', '6h', '24h'])
  }
})

test('only offer ranges within retention, including nonstandard 2/4/5/6 day periods', () => {
  for (const days of [2, 3, 4, 5, 6, 7]) {
    const ranges = keys(days)
    assert.ok(ranges.includes(`${days}d`))
    assert.equal(new Set(ranges).size, ranges.length)
    assert.ok(ranges.filter(key => key.endsWith('d')).every(key => parseInt(key) <= days))
  }
  assert.deepEqual(keys(7), ['1h', '6h', '24h', '3d', '7d'])
  assert.deepEqual(keys(5), ['1h', '6h', '24h', '3d', '5d'])
  assert.deepEqual(keys(50), keys(7))
  assert.equal(probeHistoryDays(3.9), 3)
})

test('retention reductions fall back to 1h instead of requesting a removed range', () => {
  assert.equal(effectiveProbeRange('7d', probeRangeOptions(3)), '1h')
  assert.equal(effectiveProbeRange('3d', probeRangeOptions(3)), '3d')
  assert.equal(effectiveProbeRange('24h', probeRangeOptions()), '24h')
})

test('multi-day fallback buckets match the controller aggregation intervals', () => {
  assert.deepEqual(['1h', '6h', '24h', '2d', '3d', '4d', '7d'].map(probeRangeBucketSec), [300, 600, 1800, 3600, 3600, 7200, 7200])
})
