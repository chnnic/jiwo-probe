import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizeConnHistory, connSparklineMax, connSparklinePath, connHoverIndex, connBucketLabel } from './conn-sparkline.ts'
import { parseShowConnectionChart } from './connection-chart.ts'

test('首页、历史弹窗、Lite/LP 系统图共用主题 TCP/UDP 配色，Ran 不覆盖', () => {
  const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
  const palette = read('./connection-colors.css')
  for (const theme of ['pixel', 'anime', 'glass', 'lumina', 'luminaplus', 'lite', 'emerald', 'premium']) {
    assert.ok(palette.includes(`:root.theme-${theme}`), theme)
  }
  assert.match(palette, /body\.gm-body/)
  assert.match(palette, /body\.gm-light-body/)
  assert.doesNotMatch(palette, /\.theme-ran/)
  for (const path of ['./charts/SystemTrendChart.tsx', './mini/MiniTrends.tsx']) {
    const source = read(path)
    assert.match(source, /key: 'tcp', label: 'TCP', color: 'var\(--connection-tcp\)'/)
    assert.match(source, /key: 'udp', label: 'UDP', color: 'var\(--connection-udp\)'/)
  }
  const styles = read('./probe-history.css')
  assert.match(styles, /\.probe-conn-tcp \{ stroke: var\(--connection-tcp\)/)
  assert.match(styles, /\.probe-conn-udp \{ stroke: var\(--connection-udp\)/)
  assert.match(styles, /\.probe-conn-tcp-dot \{ background: var\(--connection-tcp\)/)
  assert.match(styles, /\.probe-conn-udp-dot \{ background: var\(--connection-udp\)/)
  assert.match(read('./main.tsx'), /import '\.\/connection-colors.css'/)
})

test('CF 连接数折线默认开启，兼容布尔、开关文本、大小写与留空', () => {
  for (const value of [undefined, null, '', 'invalid', true, 1, 'true', ' TRUE ', '1', 'on', 'yes', '开启']) {
    assert.equal(parseShowConnectionChart(value), true, String(value))
  }
  for (const value of [false, 0, 'false', ' FALSE ', '0', 'OFF', 'no', '关闭']) {
    assert.equal(parseShowConnectionChart(value), false, String(value))
  }
})

test('主控未下发连接历史时不创建图表；空数组不是假零', () => {
  assert.equal(normalizeConnHistory(), undefined)
  assert.deepEqual(normalizeConnHistory({ tcp: [], udp: [] }), { tcp: [], udp: [] })
})
test('保留浮点均值和真实零；无效/缺失值为空，两条线使用同一时间位置', () => {
  const history = normalizeConnHistory({ tcp: [0, 152.5, null, NaN, -1, Infinity], udp: [18] })
  assert.deepEqual(history, { tcp: [0, 152.5, null, null, null, null], udp: [18, null, null, null, null, null] })
  assert.equal(connSparklineMax(history), 152.5)
})
test('缺失数据处断线，孤立样本可见，全空不画线', () => {
  assert.equal(connSparklinePath([1, null, 2], 2, 100, 40, 0), 'M0 20h0.01M100 0h0.01')
  assert.equal(connSparklinePath([null, null], 0), '')
  assert.equal(connSparklinePath([1], 1, 100, 40, 0), 'M50 0h0.01')
})
test('真实全零为底线，两条曲线共用纵轴不夸大 UDP', () => {
  assert.equal(connSparklinePath([0, 0], 0, 100, 40, 0), 'M0 40L100 40')
  assert.equal(connSparklinePath([10, 10], 100, 100, 40, 0), 'M0 36L100 36')
})
test('12 个五分钟槽的悬停与时间说明', () => {
  assert.equal(connBucketLabel(0, 12), '约 55 分钟前')
  assert.equal(connBucketLabel(11, 12), '最近 5 分钟')
  assert.equal(connHoverIndex(-1, 12), 0)
  assert.equal(connHoverIndex(2, 12), 11)
  assert.equal(connHoverIndex(.5, 12), 6)
  assert.equal(connHoverIndex(.5, 1), 0)
  assert.equal(connHoverIndex(.5, 0), 0)
})
