import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isStale, staleDataLabel, STALE_AFTER_MS } from './stale-data.ts'

test('只有连接出错且数据超过 20 秒没更新才提示', () => {
  const now = 1_000_000
  assert.equal(isStale(undefined, now - 60_000, now), false, '没有错误不提示')
  assert.equal(isStale('HTTP 502', undefined, now), false, '从未拿到数据由加载页处理')
  assert.equal(isStale('HTTP 502', now - STALE_AFTER_MS + 1, now), false, '偶发失败不打扰')
  assert.equal(isStale('HTTP 502', now - STALE_AFTER_MS, now), true)
})

test('提示文案按秒、分钟、小时显示数据年龄', () => {
  const at = new Date(2026, 9, 4, 9, 5).getTime()
  assert.match(staleDataLabel(42_000, at), /正在显示 42 秒前（09:05）的数据/)
  assert.match(staleDataLabel(5 * 60_000 + 30_000, at), /5 分钟前/)
  assert.match(staleDataLabel(2 * 3600_000, at), /2 小时前/)
})
