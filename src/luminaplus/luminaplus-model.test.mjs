import test from 'node:test'
import assert from 'node:assert/strict'
import { trafficWeek, trafficPopoverPosition } from './luminaplus-traffic.ts'
import { rankLiveSpeeds, rankPeriodTraffic } from './luminaplus-model.ts'
import { nextLuminaPlusColor, resolveLuminaPlusColor } from './luminaplus-color.ts'

test('LuminaPlus 按 Light → Carbon → Paper → Mint → Mint Night 循环，手动选择优先', () => {
  assert.equal(nextLuminaPlusColor('light'), 'dark')
  assert.equal(nextLuminaPlusColor('dark'), 'paper')
  assert.equal(nextLuminaPlusColor('paper'), 'mint')
  assert.equal(nextLuminaPlusColor('mint'), 'mint-dark')
  assert.equal(nextLuminaPlusColor('mint-dark'), 'light')
  for (const saved of ['light', 'dark', 'paper', 'mint', 'mint-dark']) {
    assert.equal(resolveLuminaPlusColor({ saved, paper: true, legacy: 'gold', hour: 23 }), saved)
  }
})

test('主控 luminaplus-mint 按北京时间切换浅 / 深，带后缀时固定，访客手动选择优先', () => {
  for (const hour of [6, 12, 17]) assert.equal(resolveLuminaPlusColor({ mint: true, hour }), 'mint')
  for (const hour of [0, 5, 18, 23]) assert.equal(resolveLuminaPlusColor({ mint: true, hour }), 'mint-dark')
  assert.equal(resolveLuminaPlusColor({ mint: true, light: true, hour: 23 }), 'mint')
  assert.equal(resolveLuminaPlusColor({ mint: true, light: false, hour: 12 }), 'mint-dark')
  assert.equal(resolveLuminaPlusColor({ mint: true, legacy: 'dark', hour: 12 }), 'mint', '其他主题的旧深色设置不影响 Mint')
  assert.equal(resolveLuminaPlusColor({ saved: 'paper', mint: true, hour: 12 }), 'paper')
})

test('Paper stays warm throughout the day and explicit follow-controller ignores legacy choices', () => {
  for (const hour of [0, 6, 12, 18, 23]) {
    assert.equal(resolveLuminaPlusColor({ paper: true, legacy: 'dark', hour }), 'paper')
    assert.equal(resolveLuminaPlusColor({ saved: 'auto', paper: true, hour }), 'paper')
    assert.equal(resolveLuminaPlusColor({ saved: 'auto', light: true, legacy: 'dark', hour }), 'light')
    assert.equal(resolveLuminaPlusColor({ saved: 'auto', light: false, legacy: 'light', hour }), 'dark')
  }
})

test('LuminaPlus retains legacy modes and normal automatic light/dark boundaries', () => {
  for (const legacy of ['dark', 'gold']) assert.equal(resolveLuminaPlusColor({ legacy, hour: 12 }), 'dark')
  for (const legacy of ['light', 'platinum']) assert.equal(resolveLuminaPlusColor({ legacy, hour: 23 }), 'light')
  for (const saved of [undefined, null, 'invalid', 'auto']) {
    for (const [hour, expected] of [[0, 'dark'], [5, 'dark'], [6, 'light'], [17, 'light'], [18, 'dark'], [23, 'dark']]) {
      assert.equal(resolveLuminaPlusColor({ saved, hour }), expected)
    }
  }
})

test('period ranking uses billed usage without re-adding directions or doubling one-way traffic', () => {
  const servers = [
    { online: true, traffic_stats_mode: 'max', traffic_used: 90, traffic_used_up: 90, traffic_used_down: 80 },
    { online: true, traffic_stats_mode: 'upload', traffic_used: 100, traffic_used_up: 100, traffic_used_down: 900 },
    { online: true, traffic_stats_mode: 'both', traffic_used: 120, traffic_used_up: 30, traffic_used_down: 70, traffic_adjustment: 20 },
  ]
  assert.deepEqual(rankPeriodTraffic(servers).map(row => [row.index, row.value]), [[2, 120], [1, 100], [0, 90]])
  assert.deepEqual(rankPeriodTraffic(servers, 'upload').map(row => row.index), [1, 0, 2])
  assert.deepEqual(rankPeriodTraffic(servers, 'download').map(row => row.index), [1, 0, 2])
})

test('period ranking includes offline usage, preserves real zero, and keeps original route indices', () => {
  const servers = [
    { name: 'zero', online: false, traffic_used: 0, traffic_used_total: 999 },
    { name: 'offline', online: false, traffic_used: 100 },
    { name: 'legacy', online: true, traffic_used_total: 100 },
  ]
  assert.deepEqual(rankPeriodTraffic(servers).map(row => [row.index, row.value]), [[1, 100], [2, 100], [0, 0]])
  assert.equal(rankPeriodTraffic(servers)[0].server.name, 'offline')
  assert.equal(servers[0].name, 'zero')
})

test('period ranking never substitutes lifetime, boot, daily totals, or incomplete direction data', () => {
  const servers = [
    { cumulative_up: 9999, cumulative_down: 9999, boot_traffic_up: 999, boot_traffic_down: 999 },
    { traffic_used_up: 200, traffic_used_down: 300, daily_traffic: [{ date: '2026-09-30', total: 20000 }] },
    { traffic_used: -1, traffic_used_total: 400 },
    { traffic_used: '500', traffic_used_up: Infinity, traffic_used_down: NaN },
    { traffic_used: Infinity },
  ]
  assert.deepEqual(rankPeriodTraffic(servers), [])
  assert.deepEqual(rankPeriodTraffic(servers, 'upload').map(row => [row.index, row.value]), [[1, 200]])
  assert.deepEqual(rankPeriodTraffic([]), [])
})

test('speed ranking sorts actual duplex bytes/s and retains original server route indices', () => {
  const servers = [
    { name: 'A', online: true, upload_speed: 500, download_speed: 100 },
    { name: 'B', online: true, upload_speed: 200, download_speed: 900 },
    { name: 'C', online: true, upload_speed: 800, download_speed: 300 },
  ]
  assert.deepEqual(rankLiveSpeeds(servers).map(row => [row.index, row.value]), [[1, 1100], [2, 1100], [0, 600]])
  assert.deepEqual(rankLiveSpeeds(servers, 'upload').map(row => row.index), [2, 0, 1])
  assert.deepEqual(rankLiveSpeeds(servers, 'download').map(row => row.index), [1, 2, 0])
  assert.equal(rankLiveSpeeds(servers)[0].server.name, 'B')
  assert.equal(servers[0].name, 'A')
})

test('speed ranking excludes offline stale counters and unknown values, but preserves real zero', () => {
  const servers = [
    { online: false, upload_speed: 100000, download_speed: 100000 },
    { online: true, upload_speed: 0, download_speed: 0 },
    { online: true, upload_speed: 500 },
    { online: true, upload_speed: -1, download_speed: 10 },
    { online: true, upload_speed: NaN, download_speed: Infinity },
    { online: true, upload_speed: '100', download_speed: null },
  ]
  assert.deepEqual(rankLiveSpeeds(servers).map(row => [row.index, row.value]), [[1, 0]])
  assert.deepEqual(rankLiveSpeeds(servers, 'upload').map(row => row.index), [2, 1])
  assert.deepEqual(rankLiveSpeeds(servers, 'download').map(row => row.index), [3, 1])
  assert.equal(rankLiveSpeeds(servers, 'upload')[0].download, undefined)
  assert.deepEqual(rankLiveSpeeds([]), [])
})

test('traffic popover shows seven calendar days ending today, never seven old records', () => {
  const result = trafficWeek({ daily_traffic: [
    { date: '2026-09-01', uplink: 99, downlink: 99, total: 198 },
    { date: '2026-09-28', uplink: 1, downlink: 2, total: 3 },
    { date: '2026-09-30', uplink: 9, downlink: 9, total: 18 },
  ] }, new Date(2026, 8, 29, 12))
  assert.deepEqual(result.days.map(day => day.date), ['2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29'])
  assert.equal(result.today.total, undefined)
  assert.equal(result.days[5].total, 3)
  assert.equal(result.days[0].total, undefined)
})

test('daily traffic retains zero, rejects invalid values and only sums complete directions', () => {
  const result = trafficWeek({ daily_traffic: [
    { date: '2026-09-29', uplink: 0, downlink: 0, total: 0 },
    { date: '2026-09-28', uplink: 10, downlink: 20, total: 25 },
    { date: '2026-09-27', uplink: 1, downlink: 2 },
    { date: '2026-09-26', uplink: -1, downlink: 2, total: NaN },
    { date: '2026-09-25', uplink: Infinity, downlink: 2, total: '3' },
  ] }, new Date(2026, 8, 29))
  assert.equal(result.today.total, 0)
  assert.equal(result.days[5].total, 25)
  assert.equal(result.days[4].total, 3)
  assert.equal(result.days[3].upload, undefined)
  assert.equal(result.days[3].total, undefined)
  assert.equal(result.days[2].total, undefined)
})

test('seven-day window crosses month/year boundaries and empty data stays missing', () => {
  const result = trafficWeek({}, new Date(2027, 0, 2))
  assert.equal(result.days[0].date, '2026-12-27')
  assert.equal(result.today.date, '2027-01-02')
  assert.ok(result.days.every(day => day.total === undefined))
})

test('Worker-estimated daily rows retain their UTC day boundary and estimate label', () => {
  const result = trafficWeek({ daily_traffic_scope: 'probe_estimated_from_cumulative', daily_traffic_estimated: true }, new Date('2026-09-29T01:00:00+07:00'))
  assert.equal(result.today.date, '2026-09-28')
  assert.equal(result.utc, true)
  assert.equal(result.estimated, true)
})

test('popover fits below anchor, flips above, and clamps at narrow viewport edges', () => {
  const anchor = { left: 650, right: 680, top: 200, bottom: 230 }
  assert.deepEqual(trafficPopoverPosition(anchor, 340, 400, 1280, 900), { left: 340, top: 238 })
  assert.deepEqual(trafficPopoverPosition({ ...anchor, top: 600, bottom: 630 }, 340, 400, 1280, 900), { left: 340, top: 192 })
  assert.deepEqual(trafficPopoverPosition({ left: 10, right: 40, top: 100, bottom: 130 }, 296, 336, 320, 360), { left: 12, top: 12 })
})
import { filledSegments, loadMetric, quotaMetric, resetDays, speedTone, parseLuminaPlusView, LUMINA_PLUS_VIEWS, assetOverview, nextSpeedTrails, pulseStrength, PULSE_POINTS, regionKey, combinedSpeedTrail } from './luminaplus-model.ts'

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
  assert.deepEqual(LUMINA_PLUS_VIEWS, ['large', 'compact', 'mini', 'list'])
  for (const view of LUMINA_PLUS_VIEWS) assert.equal(parseLuminaPlusView(view), view)
  for (const value of ['card', null, undefined, 'detailed', '__proto__', {}]) assert.equal(parseLuminaPlusView(value), 'large')
})

test('compact duplex pulse adds real pairs without filling missing samples', () => {
  assert.deepEqual(combinedSpeedTrail(), [])
  assert.deepEqual(combinedSpeedTrail({ upload: [10, 0, undefined, 8, -1], download: [20, 0, 3, undefined, 4, 10] }), [30, 0, undefined, undefined, undefined, undefined])
})

test('pulse trail uses only received samples, retains zero and missing gaps, and stays bounded', () => {
  const node = { name: 'A', online: true, upload_speed: 1024, download_speed: 0 }
  let trails = nextSpeedTrails([node])
  assert.deepEqual(trails[0], { name: 'A', upload: [1024], download: [0] })
  trails = nextSpeedTrails([{ ...node, online: false }], trails)
  assert.deepEqual(trails[0].upload, [1024, undefined])
  assert.deepEqual(trails[0].download, [0, undefined])
  trails = nextSpeedTrails([{ name: 'B', online: true, upload_speed: -1 }], trails)
  assert.deepEqual(trails[0].upload, [undefined]) // Never assign A's trail to B.
  for (let i = 0; i < 30; i++) trails = nextSpeedTrails([node], trails)
  assert.equal(trails[0].upload.length, PULSE_POINTS)
  for (const value of [undefined, NaN, Infinity, -1, 0]) assert.equal(pulseStrength(value), 0)
  assert.ok(pulseStrength(1) > 0)
  assert.ok(pulseStrength(1024 ** 3) <= 1)
  assert.ok(pulseStrength(1024 ** 2) > pulseStrength(1024))
})

test('asset summary separates currencies, uses controller FX, and excludes invalid prices', () => {
  const now = Date.parse('2026-09-29T00:00:00Z')
  const result = assetOverview([
    { renewal_price: 120, renewal_currency: 'USD', renewal_cycle: 'year', expires_at: '2026-09-30T00:00:00Z' },
    { renewal_price: 120, renewal_price_cny: 840, renewal_currency: 'USD', renewal_cycle: 'year', expires_at: '2026-09-30T00:00:00Z' },
    { renewal_price: 0, renewal_currency: 'CNY', expires_at: '2026-09-28' },
    { renewal_price: NaN }, { renewal_price: -1 }, {},
  ], now)
  assert.equal(result.unpriced, 3)
  assert.equal(result.groups.length, 2)
  assert.deepEqual(result.groups[0], { currency: 'CNY', monthly: 70, remaining: 840 / 365, priced: 2, valued: 2 })
  assert.deepEqual(result.groups[1], { currency: 'USD', monthly: 10, remaining: 120 / 365, priced: 1, valued: 1 })
})

test('multi-year renewals and permanent purchases do not inflate the asset budget', () => {
  const result = assetOverview([
    { renewal_price: 240, renewal_cycle: 'two_year', renewal_currency: 'USD' },
    { renewal_price: 360, renewal_cycle: 'three_year', renewal_currency: 'USD' },
    { renewal_price: 5000, renewal_cycle: 'permanent', renewal_currency: 'USD', expires_at: '2099-01-01' },
  ])
  assert.equal(result.groups[0].monthly, 20)
  assert.equal(result.groups[0].priced, 3)
  assert.equal(result.groups[0].valued, 0)
  assert.equal(result.groups[0].remaining, 0)
  assert.equal(result.unpriced, 0)
})

test('unknown expiry does not become a zero-value asset, but an expired real asset does', () => {
  const now = Date.parse('2026-09-29T00:00:00Z')
  assert.equal(assetOverview([], now).groups.length, 0)
  assert.equal(assetOverview([{ renewal_price: 10, expires_at: 'invalid' }], now).groups[0].valued, 0)
  assert.equal(assetOverview([{ renewal_price: 10, expires_at: '2026-09-01' }], now).groups[0].valued, 1)
  assert.equal(assetOverview([{ renewal_price: 10, expires_at: '2026-09-01' }], now).groups[0].remaining, 0)
})

test('region filters tolerate missing labels and normalize case', () => {
  assert.equal(regionKey({ region_country: 'hk', region: 'Japan' }), 'HK')
  assert.equal(regionKey({ region: 'JP' }), 'JP')
  assert.equal(regionKey({}), '未知')
  assert.equal(regionKey({ region_country: '  ', region: 'jp' }), 'JP')
})
