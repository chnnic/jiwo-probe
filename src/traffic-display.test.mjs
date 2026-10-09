import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dailyTrafficRows, hasMoreDailyTraffic, trafficRangeLabel } from './traffic-display.ts'

const day = (date) => ({ date, uplink: 1, downlink: 2, total: 3 })
// 30 天每日流量，乱序给出；计费周期从 09-25 开始
const dates = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 8, 10 + i)).toISOString().slice(0, 10))
const server = { daily_traffic: [...dates].reverse().map(day), period_start: '2026-09-25', period_end: '2026-10-25' }

test('全部：返回主控下发的全部每日流量并按日期排序', () => {
  const rows = dailyTrafficRows(server, 'all')
  assert.equal(rows.length, 30)
  assert.equal(rows[0].date, '2026-09-10')
  assert.equal(rows.at(-1).date, '2026-10-09')
})

test('当前周期只取周期内的日子，最近 7 日取最后 7 天', () => {
  assert.equal(dailyTrafficRows(server, 'period')[0].date, '2026-09-25')
  assert.equal(dailyTrafficRows(server, 'period').length, 15)
  assert.deepEqual(dailyTrafficRows(server, 'recent7').map((row) => row.date), dates.slice(-7))
})

test('超过 7 天才提供「全部」，标签写明天数', () => {
  assert.equal(hasMoreDailyTraffic(server), true)
  assert.equal(hasMoreDailyTraffic({ daily_traffic: dates.slice(0, 7).map(day) }), false)
  assert.equal(hasMoreDailyTraffic({}), false)
  assert.equal(trafficRangeLabel('all', server), '全部 30 日')
  assert.equal(trafficRangeLabel('period', server), '当前周期')
  assert.equal(trafficRangeLabel('recent7', server), '最近 7 日')
})
