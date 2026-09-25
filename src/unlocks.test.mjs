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
  assert.deepEqual(unlockSummary(items), { total: 12, unlocked: 10, partial: 1, info: 8 })
})
test('信息查询与解锁状态分别展示；未知服务和状态可降级', () => {
  assert.deepEqual(unlockStatus({ service: 'steam', status: 'yes' }), { label: '信息', tone: 'info' })
  assert.deepEqual(unlockStatus({ service: 'apple', status: 'no' }), { label: '查询失败', tone: 'muted' })
  for (const [status, label] of [['yes', '已解锁'], ['originals_only', '仅自制剧'], ['no', '未解锁'], ['banned', 'IP 被封禁'], ['future_status', '检测失败']]) assert.equal(unlockStatus({ service: 'netflix', status }).label, label)
  for (const key of ['future_service', 'constructor', '__proto__']) assert.deepEqual(unlockService(key), { label: key, category: 'other' })
})
test('折叠栏按主控口径统计三类，与完整面板总数相加一致', () => {
  const input = [
    { service: 'netflix', status: 'no' }, { service: 'netflix', status: 'yes' },
    { service: 'disneyplus', status: 'originals_only' }, { service: 'spotify', status: 'no' },
    { service: 'youtube_cdn', status: 'yes' },
    { service: 'openai', status: 'yes' }, { service: 'claude', status: 'failed' },
    { service: 'reddit', status: 'banned' }, { service: 'future_service', status: 'yes' },
    { service: 'steam', status: 'yes' },
  ]
  const categories = unlockCategorySummaries(input)
  assert.deepEqual(categories, [
    { key: 'streaming', label: '流媒体', total: 4, unlocked: 3, partial: 1, info: 1 },
    { key: 'ai', label: 'AI', total: 2, unlocked: 1, partial: 0, info: 0 },
    { key: 'other', label: '其他', total: 3, unlocked: 2, partial: 0, info: 1 },
  ])
  const total = unlockSummary(normalizeUnlocks(input))
  for (const key of ['total', 'unlocked', 'partial', 'info']) assert.equal(categories.reduce((sum, cat) => sum + cat[key], 0), total[key])
})
test('折叠栏区分无检测数据、仅信息查询与已检测但零解锁', () => {
  for (const input of [undefined, null, {}, []]) {
    const categories = unlockCategorySummaries(input)
    assert.equal(categories.length, 3)
    for (const category of categories) assert.equal(category.total, 0)
  }
  const categories = unlockCategorySummaries([{ service: 'openai', status: 'no' }, { service: 'steam', status: 'yes' }])
  assert.deepEqual(categories.map(({ total, unlocked, info }) => ({ total, unlocked, info })), [
    { total: 0, unlocked: 0, info: 0 }, { total: 1, unlocked: 0, info: 0 }, { total: 1, unlocked: 1, info: 1 },
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
    assert.equal(indicator([{ service: 'netflix', status: 'yes' }, { service: 'youtube_cdn', status }]), 'some', 'failed info result prevents gold')
  }
})
test('21 项实测结构按主控统计 15/21，而非旧口径 8/13', () => {
  const info = ['iqiyi', 'youtube_cdn', 'netflix_cdn', 'bing', 'apple', 'google_play', 'steam', 'onetrust']
  const services = ['netflix', 'disneyplus', 'youtube_premium', 'prime_video', 'tvb_anywhere', 'dazn', 'openai', 'gemini', 'claude', 'wikipedia', 'google_search', 'reddit', 'sdggge']
  const items = normalizeUnlocks([
    ...services.map((service, i) => ({ service, status: i < 8 ? 'yes' : 'no' })),
    ...info.map(service => ({ service, status: service === 'youtube_cdn' ? 'failed' : 'yes' })),
  ])
  assert.deepEqual(unlockSummary(items), { total: 21, unlocked: 15, partial: 0, info: 8 })
  assert.equal(unlockIndicator(unlockSummary(items)), 'some')
  const categories = unlockCategorySummaries(items)
  assert.equal(categories.reduce((sum, cat) => sum + cat.unlocked, 0), 15)
  assert.equal(categories.reduce((sum, cat) => sum + cat.total, 0), 21)
})
test('状态刷新后计数与锁图标同步变化，不保留过期的全解锁状态', () => {
  const results = ['yes', 'failed', 'originals_only'].map(status => unlockSummary([{ service: 'netflix', status }, { service: 'openai', status: 'yes' }]))
  assert.deepEqual(results.map(summary => summary.unlocked), [2, 1, 2])
  assert.deepEqual(results.map(unlockIndicator), ['all', 'some', 'all'])
})
test('服务目录保留官方名称、分类与旧版 Spotify 兼容图标', () => {
  const keys = ['netflix', 'disneyplus', 'youtube_premium', 'prime_video', 'tvb_anywhere', 'iqiyi', 'dazn', 'youtube_cdn', 'netflix_cdn', 'spotify', 'openai', 'gemini', 'claude', 'bing', 'apple', 'wikipedia', 'google_play', 'google_search', 'steam', 'reddit', 'onetrust', 'sdggge']
  assert.equal(keys.length, 22)
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
