import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dailyTrafficRows, hasMoreDailyTraffic, isOneTimeTraffic, trafficPeriodMonths, trafficPeriodText, trafficRangeLabel } from './traffic-display.ts'

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

test('流量周期按天数折成月数：一个月、三个月、半年、一年，没有周期按月', () => {
  for (const [period_start, period_end, months] of [
    ['2026-10-17', '2026-11-17', 1], ['2026-02-01', '2026-03-01', 1], ['2026-10-01', '2027-01-01', 3],
    ['2026-10-30', '2027-04-30', 6], ['2026-05-01', '2027-05-01', 12],
  ]) assert.equal(trafficPeriodMonths({ online: true, period_start, period_end }), months)
  assert.equal(trafficPeriodMonths({ online: true }), 1)
  assert.equal(trafficPeriodMonths({ online: true, period_start: 'x', period_end: 'y' }), 1)
})

test('按月周期只写月-日，长周期带年份，一次性流量单独标出', () => {
  assert.equal(trafficPeriodText({ online: true, period_start: '2026-10-17', period_end: '2026-11-17' }), '10-17 — 11-17')
  assert.equal(trafficPeriodText({ online: true, period_start: '2026-05-01', period_end: '2027-05-01' }), '2026-05-01 — 2027-05-01')
  assert.equal(trafficPeriodText({ online: true, period_start: '2026-10-30', period_end: '2027-04-30' }, '–'), '2026-10-30–2027-04-30')
  const oneTime = { online: true, traffic_used_scope: 'counter_since_reset' }
  assert.equal(isOneTimeTraffic(oneTime), true)
  assert.equal(trafficPeriodText(oneTime), '一次性流量')
  assert.equal(isOneTimeTraffic({ online: true, traffic_used_scope: 'probe_estimated_from_cumulative' }), false)
  assert.equal(trafficPeriodText({ online: true }), undefined)
})

test('每日流量没覆盖到长周期开头时，标签写本周期近 N 日', () => {
  const daily_traffic = ['2026-10-30', '2026-10-31', '2026-11-01'].map(date => ({ date, uplink: 1, downlink: 1, total: 2 }))
  const server = { online: true, period_start: '2026-05-01', period_end: '2027-05-01', daily_traffic_start: '2026-10-30', daily_traffic }
  assert.equal(trafficRangeLabel('period', server), '本周期近 3 日')
  assert.equal(trafficRangeLabel('period', { ...server, period_start: '2026-10-30', period_end: '2026-11-30' }), '当前周期')
})
