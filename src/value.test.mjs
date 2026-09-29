import assert from 'node:assert/strict'
import test from 'node:test'
import { computeMonthlyTrafficCost } from './value.ts'

const base = { online: true, renewal_currency: 'CNY', traffic_limit: 2 * 1024 ** 4 }

test('monthly traffic cost normalizes monthly, quarterly, half-year and yearly renewal prices', () => {
  for (const [renewal_cycle, renewal_price] of [['month', 10], ['quarter', 30], ['half_year', 60], ['year', 120]]) {
    assert.deepEqual(computeMonthlyTrafficCost({ ...base, renewal_cycle, renewal_price }), {
      monthlyPrice: 10, quotaTB: 2, perTB: 5, currency: 'CNY', isCny: true,
    })
  }
})

test('prefers upstream converted CNY; otherwise preserves original currency without inventing exchange rates', () => {
  const result = computeMonthlyTrafficCost({ ...base, renewal_price: 10, renewal_currency: 'USD', renewal_price_cny: 70 })
  assert.equal(result.perTB, 35)
  assert.equal(result.currency, 'CNY')
  const original = computeMonthlyTrafficCost({ ...base, renewal_price: 10, renewal_currency: ' usd ' })
  assert.equal(original.perTB, 5)
  assert.equal(original.currency, 'USD')
  assert.equal(original.isCny, false)
  assert.equal(computeMonthlyTrafficCost({ ...base, renewal_price_cny: 70 }).perTB, 35)
})

test('missing, unlimited or invalid quota / price does not produce a fictitious price', () => {
  for (const traffic_limit of [undefined, null, 0, -1, Infinity, NaN, '2048']) {
    assert.equal(computeMonthlyTrafficCost({ ...base, renewal_price: 10, traffic_limit }), null)
  }
  for (const renewal_price of [undefined, null, -1, Infinity, NaN, '10']) {
    assert.equal(computeMonthlyTrafficCost({ ...base, renewal_price }), null)
  }
  assert.equal(computeMonthlyTrafficCost({ ...base, renewal_price: 10, renewal_cycle: 'unknown' }), null)
  assert.equal(computeMonthlyTrafficCost({ ...base, renewal_price: Number.MAX_VALUE, traffic_limit: 1 }), null)
})

test('free plans are zero; missing cycle defaults to month; sub-TB quotas stay precise', () => {
  assert.equal(computeMonthlyTrafficCost({ ...base, renewal_price: 0 }).perTB, 0)
  assert.equal(computeMonthlyTrafficCost({ ...base, renewal_price: 10, renewal_price_cny: 0 }).perTB, 0)
  assert.equal(computeMonthlyTrafficCost({ ...base, renewal_price: 10, traffic_limit: 512 * 1024 ** 3 }).perTB, 20)
})

test('actual usage, speed, traffic direction and expiry never change the advertised quota cost', () => {
  const expected = computeMonthlyTrafficCost({ ...base, renewal_price: 10 })
  for (const traffic_used of [0, 1024, 10 * base.traffic_limit]) {
    for (const traffic_stats_mode of ['both', 'upload', 'download', 'max']) {
      assert.deepEqual(computeMonthlyTrafficCost({ ...base, renewal_price: 10, traffic_used, download_speed: 1e9, traffic_stats_mode, expires_at: '2020-01-01' }), expected)
    }
  }
})
