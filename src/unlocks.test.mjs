import test from 'node:test'
import assert from 'node:assert/strict'
import { connectionCount, normalizeUnlocks, unlockCategorySummaries, unlockIndicator, unlockService, unlockStatus, unlockSummary } from './unlocks.ts'
import { unlockBrandIcon } from './unlock-icons.ts'
import { existsSync, readFileSync } from 'node:fs'

test('连接数区分真实零、缺失与无效值', () => {
  assert.equal(connectionCount(0), '0')
  assert.equal(connectionCount(12501), '12,501')
  for (const value of [undefined, null, '', '12', -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.equal(connectionCount(value), '—')
})
test('旧主控和异常解锁数据安全回落', () => {
  for (const value of [undefined, null, {}, 'yes', [null, 2, {}, { service: '', status: 'yes' }]]) assert.deepEqual(normalizeUnlocks(value), [])
  assert.deepEqual(normalizeUnlocks([{ service: 'openai', status: 'yes', region: 10, tested_at: {} }]), [{ service: 'openai', status: 'yes', region: undefined, tested_at: undefined }])
})
test('服务排序稳定，重复服务采用最后一条', () => {
  const normalized = normalizeUnlocks([{ service: 'steam', status: 'yes' }, { service: 'netflix', status: 'no' }, { service: 'openai', status: 'yes' }, { service: 'netflix', status: 'yes' }])
  assert.deepEqual(normalized.map(item => item.service), ['netflix', 'openai', 'steam'])
  assert.equal(normalized[0].status, 'yes')
})
test('主控口径包含地区/CDN/货币信息，仅自制剧同时计入解锁和说明', () => {
  const items = normalizeUnlocks([
    { service: 'netflix', status: 'originals_only' }, { service: 'openai', status: 'yes' },
    { service: 'disneyplus', status: 'no' }, { service: 'claude', status: 'failed' },
    ...['iqiyi', 'bing', 'apple', 'google_play', 'steam', 'onetrust', 'youtube_cdn', 'netflix_cdn'].map(service => ({ service, status: 'yes', region: 'US' })),
  ])
  assert.deepEqual(unlockSummary(items), { total: 11, unlocked: 10, failed: 1, partial: 1, info: 8 })
})
test('信息查询与解锁状态分别展示；未知服务和状态可降级', () => {
  assert.deepEqual(unlockStatus({ service: 'steam', status: 'yes', region: 'USD' }), { label: 'USD', tone: 'info' })
  assert.deepEqual(unlockStatus({ service: 'steam', status: 'yes' }), { label: '—', tone: 'info' })
  assert.deepEqual(unlockStatus({ service: 'apple', status: 'no' }), { label: '未解锁', tone: 'bad' })
  for (const [status, label] of [['yes', '已解锁'], ['originals_only', '仅自制剧'], ['no', '未解锁'], ['banned', 'IP 被封禁'], ['future_status', '检测失败']]) assert.equal(unlockStatus({ service: 'netflix', status }).label, label)
  for (const key of ['future_service', 'constructor', '__proto__']) assert.deepEqual(unlockService(key), { label: key, category: 'other' })
})
test('四类分母保留失败项，折叠栏与分类标签一致，总徽标排除失败项', () => {
  const input = [
    { service: 'netflix', status: 'no' }, { service: 'netflix', status: 'yes' },
    { service: 'disneyplus', status: 'originals_only' }, { service: 'spotify', status: 'no' },
    { service: 'youtube_cdn', status: 'yes' },
    { service: 'openai', status: 'yes' }, { service: 'claude', status: 'failed' },
    { service: 'bybit', status: 'yes' }, { service: 'binance', status: 'banned' }, { service: 'okx', status: 'yes', region: 'HK' },
    { service: 'reddit', status: 'banned' }, { service: 'future_service', status: 'yes' },
    { service: 'steam', status: 'yes' },
  ]
  const categories = unlockCategorySummaries(input)
  assert.deepEqual(categories, [
    { key: 'streaming', label: '流媒体', total: 4, unlocked: 3, failed: 0, partial: 1, info: 1 },
    { key: 'ai', label: 'AI', total: 2, unlocked: 1, failed: 1, partial: 0, info: 0 },
    { key: 'exchange', label: '交易所', total: 3, unlocked: 2, failed: 0, partial: 0, info: 1 },
    { key: 'other', label: '其他', total: 3, unlocked: 2, failed: 0, partial: 0, info: 1 },
  ])
  const total = unlockSummary(normalizeUnlocks(input))
  for (const key of ['unlocked', 'failed', 'partial', 'info']) assert.equal(categories.reduce((sum, cat) => sum + cat[key], 0), total[key])
  assert.equal(categories.reduce((sum, cat) => sum + cat.total, 0), total.total + total.failed)
})
test('折叠栏区分无检测数据、仅信息查询与已检测但零解锁', () => {
  for (const input of [undefined, null, {}, []]) {
    const categories = unlockCategorySummaries(input)
    assert.equal(categories.length, 4)
    for (const category of categories) assert.equal(category.total, 0)
  }
  const categories = unlockCategorySummaries([{ service: 'openai', status: 'no' }, { service: 'steam', status: 'yes' }])
  assert.deepEqual(categories.map(({ total, unlocked, info }) => ({ total, unlocked, info })), [
    { total: 0, unlocked: 0, info: 0 }, { total: 1, unlocked: 0, info: 0 }, { total: 0, unlocked: 0, info: 0 }, { total: 1, unlocked: 1, info: 1 },
  ])
})
test('锁图标遵循主控全解锁/部分/零解锁判定，0/0 不变金色', () => {
  const indicator = input => unlockIndicator(unlockSummary(normalizeUnlocks(input)))
  for (const input of [undefined, null, [], [{}]]) assert.equal(indicator(input), 'none')
  assert.equal(indicator([{ service: 'netflix', status: 'yes' }]), 'all', 'only returned results count, no fixed service total')
  assert.equal(indicator([{ service: 'netflix', status: 'originals_only' }, { service: 'steam', status: 'yes' }]), 'all')
  assert.equal(indicator([{ service: 'steam', status: 'yes' }]), 'all', 'successful info-only result follows master')
  for (const status of ['no', 'banned', 'failed', 'future_status']) {
    assert.equal(indicator([{ service: 'netflix', status }]), 'none')
    assert.equal(indicator([{ service: 'netflix', status: 'yes' }, { service: 'youtube_cdn', status }]), ['no', 'banned'].includes(status) ? 'some' : 'all', 'only valid blocked results prevent gold; failures are reported separately')
  }
})
test('21 项旧主控结构按新口径统计 15/20，单独保留 1 项检测失败', () => {
  const info = ['iqiyi', 'youtube_cdn', 'netflix_cdn', 'bing', 'apple', 'google_play', 'steam', 'onetrust']
  const services = ['netflix', 'disneyplus', 'youtube_premium', 'prime_video', 'tvb_anywhere', 'dazn', 'openai', 'gemini', 'claude', 'wikipedia', 'google_search', 'reddit', 'sdggge']
  const items = normalizeUnlocks([
    ...services.map((service, i) => ({ service, status: i < 8 ? 'yes' : 'no' })),
    ...info.map(service => ({ service, status: service === 'youtube_cdn' ? 'failed' : 'yes' })),
  ])
  assert.deepEqual(unlockSummary(items), { total: 20, unlocked: 15, failed: 1, partial: 0, info: 8 })
  assert.equal(unlockIndicator(unlockSummary(items)), 'some')
  const categories = unlockCategorySummaries(items)
  assert.equal(categories.reduce((sum, cat) => sum + cat.unlocked, 0), 15)
  assert.equal(categories.reduce((sum, cat) => sum + cat.total, 0), 21)
})
test('状态刷新后计数与锁图标同步变化，不保留过期的全解锁状态', () => {
  const results = ['yes', 'no', 'failed', 'originals_only'].map(status => unlockSummary([{ service: 'netflix', status }, { service: 'openai', status: 'yes' }]))
  assert.deepEqual(results.map(summary => summary.unlocked), [2, 1, 1, 2])
  assert.deepEqual(results.map(summary => summary.total), [2, 2, 1, 2])
  assert.deepEqual(results.map(summary => summary.failed), [0, 0, 1, 0])
  assert.deepEqual(results.map(unlockIndicator), ['all', 'some', 'all', 'all'])
})
test('交易所服务独立分类，OKX 成功显示地区而非已解锁，缺地区不编造', () => {
  for (const [key, label] of [['bybit', 'Bybit'], ['binance', 'Binance'], ['okx', 'OKX']]) {
    assert.equal(unlockService(key).category, 'exchange')
    assert.equal(unlockService(key).label, label)
  }
  assert.deepEqual(unlockStatus({ service: 'okx', status: 'yes', region: 'JP' }), { label: 'JP', tone: 'info' })
  assert.deepEqual(unlockStatus({ service: 'okx', status: 'yes' }), { label: '—', tone: 'info' })
  assert.deepEqual(unlockStatus({ service: 'okx', status: 'failed' }), { label: '检测失败', tone: 'muted' })
  assert.deepEqual(unlockStatus({ service: 'bybit', status: 'yes' }), { label: '已解锁', tone: 'ok' })
})
test('24 项新主控结构：23 成功、1 失败为金色 23/23，四类仍保留 24 项', () => {
  const keys = ['netflix', 'disneyplus', 'youtube_premium', 'prime_video', 'tvb_anywhere', 'iqiyi', 'dazn', 'youtube_cdn', 'netflix_cdn', 'openai', 'gemini', 'claude', 'bybit', 'binance', 'okx', 'bing', 'apple', 'wikipedia', 'google_play', 'google_search', 'steam', 'reddit', 'onetrust', 'sdggge']
  const items = normalizeUnlocks(keys.map(service => ({ service, status: service === 'netflix_cdn' ? 'failed' : 'yes' })))
  const summary = unlockSummary(items)
  assert.deepEqual(summary, { total: 23, unlocked: 23, failed: 1, partial: 0, info: 9 })
  assert.equal(unlockIndicator(summary), 'all')
  assert.deepEqual(unlockCategorySummaries(items).map(({ key, total, unlocked, failed }) => ({ key, total, unlocked, failed })), [
    { key: 'streaming', total: 9, unlocked: 8, failed: 1 },
    { key: 'ai', total: 3, unlocked: 3, failed: 0 },
    { key: 'exchange', total: 3, unlocked: 3, failed: 0 },
    { key: 'other', total: 9, unlocked: 9, failed: 0 },
  ])
})
test('全失败与未知状态只计失败，不误报全解锁；no/banned 不作为检测失败排除', () => {
  const items = normalizeUnlocks(['failed', 'future_status', 'constructor', '__proto__'].map((status, i) => ({ service: `service_${i}`, status })))
  assert.deepEqual(unlockSummary(items), { total: 0, unlocked: 0, failed: 4, partial: 0, info: 0 })
  assert.equal(unlockIndicator(unlockSummary(items)), 'none')
  assert.equal(unlockCategorySummaries(items).find(cat => cat.key === 'other').total, 4)
  assert.deepEqual(unlockSummary([{ service: 'bybit', status: 'no' }, { service: 'binance', status: 'banned' }]), { total: 2, unlocked: 0, failed: 0, partial: 0, info: 0 })
})
test('服务目录保留官方名称、分类与旧版 Spotify 兼容图标', () => {
  const keys = ['netflix', 'disneyplus', 'youtube_premium', 'prime_video', 'tvb_anywhere', 'iqiyi', 'dazn', 'youtube_cdn', 'netflix_cdn', 'spotify', 'openai', 'gemini', 'claude', 'bybit', 'binance', 'okx', 'bing', 'apple', 'wikipedia', 'google_play', 'google_search', 'steam', 'reddit', 'onetrust', 'sdggge']
  assert.equal(keys.length, 25)
  for (const key of keys) assert.notEqual(unlockService(key).label, key)
  for (const key of keys) {
    const icon = unlockBrandIcon(key)
    assert.ok(icon, `${key} has a brand icon`)
    if ('path' in icon) assert.match(icon.path, /^[Mm]/)
    else {
      assert.ok(icon.src.startsWith('/unlock-icons/'), `${key} must not load a third-party icon`)
      const file = new URL(`../public${icon.src}`, import.meta.url)
      assert.ok(existsSync(file), `${key} image exists`)
      const data = readFileSync(file)
      assert.ok(data.length > 40)
      assert.ok(!data.toString('utf8', 0, 120).toLowerCase().includes('<html'), `${key} must not contain an error page`)
    }
  }
  for (const key of ['future_service', '__proto__', 'constructor']) assert.equal(unlockBrandIcon(key), undefined)
})
