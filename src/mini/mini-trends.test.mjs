import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MINI_RANGES, connectionTrendRows, formatConnectionAverage, pingTrendRows, systemTrendRows, trendValue } from './mini-trends.ts'

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
test('连接数历史按主控时间戳对齐，保留桶平均小数和真实零', () => {
  const series = {
    tcp_connections: [{ t: 900, value: 152.5 }, { t: 300, value: 0 }],
    udp_connections: [{ t: 600, value: 18 }, { t: 900, value: 0 }],
  }
  assert.deepEqual(connectionTrendRows(series, 300), [
    { ts: 300, tcp: 0, udp: null }, { ts: 600, tcp: null, udp: 18 }, { ts: 900, tcp: 152.5, udp: 0 },
  ])
  assert.equal(systemTrendRows(series).at(-1).tcp, 152.5)
})
test('TCP/UDP 历史显示四舍五入为整数，不改变原始桶平均值', () => {
  for (const [value, expected] of [[44.99, '45'], [14.01, '14'], [152.5, '153'], [131.1122448979592, '131'], [0, '0'], [0.49, '0'], [0.5, '1'], [999.99, '1,000']]) {
    assert.equal(formatConnectionAverage(value), expected)
    const rows = connectionTrendRows({ tcp_connections: [{ t: 300, value }], udp_connections: [{ t: 300, value }] }, 300)
    assert.equal(rows[0].tcp, value)
    assert.equal(rows[0].udp, value)
  }
})
test('主控未返回连接历史或返回空数组时不以其他指标或当前快照补齐', () => {
  for (const series of [{}, { tcp_connections: [], udp_connections: [] }, { cpu_pct: [{ t: 300, value: 10 }] }]) {
    assert.deepEqual(connectionTrendRows(series, 300), [])
  }
  assert.deepEqual(connectionTrendRows({ tcp_connections: [{ t: 300, value: 81 }], udp_connections: [] }, 300), [{ ts: 300, tcp: 81, udp: null }])
  assert.deepEqual(connectionTrendRows({ udp_connections: [{ t: 300, value: 22 }] }, 300), [{ ts: 300, tcp: null, udp: 22 }])
})
test('连接数历史的缺失值和异常值为空，非法时间点不参与绘制', () => {
  const series = {
    tcp_connections: [undefined, null, -1, NaN, Infinity, '23'].map((value, i) => ({ t: (i + 1) * 300, value })),
    udp_connections: [{ t: 0, value: 22 }, { t: -1, value: 22 }, { t: NaN, value: 22 }],
  }
  assert.ok(connectionTrendRows(series, 300).every(row => row.tcp === null && row.udp === null))
  assert.equal(connectionTrendRows(series, 300).length, 6)
})
test('1/6/24 小时使用对应桶粒度，主控缺桶只插入空档而非零点', () => {
  for (const { bucketSec } of MINI_RANGES) {
    const series = { tcp_connections: [{ t: bucketSec, value: 81.2 }, { t: bucketSec * 3, value: 91.8 }] }
    assert.deepEqual(connectionTrendRows(series, bucketSec), [
      { ts: bucketSec, tcp: 81.2, udp: null },
      { ts: bucketSec * 2, tcp: null, udp: null },
      { ts: bucketSec * 3, tcp: 91.8, udp: null },
    ])
    assert.equal(series.tcp_connections.length, 2, 'does not mutate API response')
  }
})
test('重新读取相同主控历史即可恢复曲线，不依赖会话或当前时间', () => {
  const payload = { tcp_connections: [{ t: 1790320800, value: 130.17777777777778 }], udp_connections: [{ t: 1790320800, value: 22 }] }
  const first = connectionTrendRows(payload, 300)
  assert.deepEqual(connectionTrendRows(JSON.parse(JSON.stringify(payload)), 300), first)
  for (const step of [0, -1, NaN, Infinity]) assert.deepEqual(connectionTrendRows(payload, step), first)
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
