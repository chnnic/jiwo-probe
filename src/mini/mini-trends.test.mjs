import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pingTrendRows, systemTrendRows, trendValue } from './mini-trends.ts'

test('Mini 趋势保留零值，缺失和无效值不变成零', () => {
  assert.equal(trendValue(0), 0)
  for (const value of [undefined, null, '', '10', NaN, Infinity, -1]) assert.equal(trendValue(value), null)
  assert.deepEqual(systemTrendRows({}), [])
})
test('Mini 系统曲线按时间匹配内存，缺点和零总量不误配', () => {
  const rows = systemTrendRows({
    cpu_pct: [{ t: 200, value: 0 }, { t: 100, value: 3 }, { t: NaN, value: 5 }],
    mem_used: [{ t: 100, value: 25 }, { t: 200, value: 0 }, { t: 300, value: 20 }, { t: 400, value: 10 }],
    mem_total: [{ t: 200, value: 100 }, { t: 100, value: 50 }, { t: 400, value: 0 }],
  })
  assert.deepEqual(rows.map(row => row.ts), [100, 200, 300, 400])
  assert.deepEqual(rows.map(row => row.mem), [50, 0, null, null])
  assert.deepEqual(rows.map(row => row.cpu), [3, 0, null, null])
})
test('Mini 网速保持原始 bytes/s，上下行和时间不交换', () => {
  const rows = systemTrendRows({ upload_speed: [{ t: 100, value: 1024 }, { t: 200, value: 0 }], download_speed: [{ t: 100, value: 2048 }, { t: 300, value: -1 }] })
  assert.deepEqual(rows.map(row => [row.ts, row.upload, row.download]), [[100, 1024, 2048], [200, 0, null], [300, null, null]])
})
test('Mini 延迟曲线按最长历史生成时间，短历史右对齐', () => {
  const rows = pingTrendRows([
    { buckets: [{ ms: 1 }, { ms: 2 }, { ms: 3 }] },
    { buckets: [{ ms: 0 }] },
  ], 1250, 300, 'latency')
  assert.deepEqual(rows, [{ ts: 600, line0: 1, line1: null }, { ts: 900, line0: 2, line1: null }, { ts: 1200, line0: 3, line1: 0 }])
})
test('Mini 丢包与延迟分别读取；无效值留空，丢包不超100%', () => {
  const lines = [{ buckets: [{ ms: -1, loss: 100 }, { ms: 0, loss: 0 }, { ms: NaN, loss: 120 }, { loss: -1 }] }]
  assert.deepEqual(pingTrendRows(lines, 1200, 300, 'latency').map(row => row.line0), [null, 0, null, null])
  assert.deepEqual(pingTrendRows(lines, 1200, 300, 'loss').map(row => row.line0), [100, 0, 100, null])
})
test('Mini 没有历史或非法时间粒度不伪造曲线', () => {
  assert.deepEqual(pingTrendRows([], 1200, 300, 'latency'), [])
  assert.deepEqual(pingTrendRows([{ buckets: [] }], 1200, 300, 'latency'), [])
  for (const step of [0, -1, NaN]) assert.deepEqual(pingTrendRows([{ buckets: [{ ms: 0 }] }], 1200, step, 'latency'), [])
  assert.deepEqual(pingTrendRows([{ buckets: [{ ms: 0 }] }], NaN, 300, 'latency'), [])
})
