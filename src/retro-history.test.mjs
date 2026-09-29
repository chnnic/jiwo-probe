import assert from 'node:assert/strict'
import test from 'node:test'
import { memoryPoints, metricPoints, pingPoints } from './retro-history.ts'

test('history retains zero and missing samples without drawing false zeroes', () => {
  assert.deepEqual(metricPoints([{ t: 3, value: -1 }, { t: 1, value: 0 }, { t: 2, value: null }, { t: 4, value: Infinity }]), [
    { x: 1000, y: 0 }, { x: 2000, y: null }, { x: 3000, y: null }, { x: 4000, y: null },
  ])
})

test('memory percentages match timestamps, not array positions or current capacity', () => {
  assert.deepEqual(memoryPoints({
    mem_used: [{ t: 1, value: 10 }, { t: 2, value: 20 }, { t: 3, value: 0 }, { t: 4, value: 20 }],
    mem_total: [{ t: 4, value: 0 }, { t: 3, value: 100 }, { t: 1, value: 40 }],
  }), [{ x: 1000, y: 25 }, { x: 2000, y: null }, { x: 3000, y: 0 }, { x: 4000, y: null }])
})

test('ping uses response bucket times and distinguishes timeout from 100% loss', () => {
  const series = { buckets: [{ ms: 0, loss: 0 }, { ms: -1, loss: 100 }, { ms: 12, loss: 0.5 }] }
  const payload = { generated_at: 1901, bucket_sec: 600 }
  assert.deepEqual(pingPoints(series, 'latency', payload, '6h', 9999), [
    { x: 600000, y: 0 }, { x: 1200000, y: null }, { x: 1800000, y: 12 },
  ])
  assert.deepEqual(pingPoints(series, 'loss', payload, '6h', 9999).map((point) => point.y), [0, 100, 0.5])
})

test('older ping responses get stable range-specific times from receipt time', () => {
  const series = { buckets: [{ ms: 2 }, { ms: 3 }] }
  assert.deepEqual(pingPoints(series, 'latency', {}, '24h', 7205).map((point) => point.x), [5400000, 7200000])
})
