import { test } from 'node:test'
import assert from 'node:assert/strict'
import { translateText } from './translate-dom.ts'
import { ZH_EXACT, ZH_PATTERNS } from './zh.ts'

test('精确词条与带数字的模板都能翻译，保留首尾空白', () => {
  assert.equal(translateText('Overview'), '总览')
  assert.equal(translateText('  ACTIVE ALERTS '), '  活跃告警 ')
  assert.equal(translateText('14s ago'), '14 秒前')
  assert.equal(translateText('7,512 records'), '7,512 条记录')
  assert.equal(translateText('57 NODES · 9 REGIONS · GEO TRACKING'), '57 个节点 · 9 个地区 · 地理追踪')
  assert.equal(translateText('INVENTORY · 57 NODES · GRID'), '清单 · 57 个节点 · 网格')
  assert.equal(translateText('46 SUBSCRIPTIONS · $1031.12/MO · NEXT 14D'), '46 项订阅 · 每月 $1031.12 · 最近 14 天后到期')
})

test('不认识的英文、数据和已是中文的文本原样保留', () => {
  assert.equal(translateText('DataWave-JP-STD'), null)
  assert.equal(translateText('CPU'), null)
  assert.equal(translateText('12.3 GB'), null)
  assert.equal(translateText('总览'), null)
})

test('译文不会再被当成英文二次翻译', () => {
  for (const value of Object.values(ZH_EXACT)) assert.equal(translateText(value), null, value)
  for (const [, replacer] of ZH_PATTERNS) if (typeof replacer === 'string') assert.ok(!/[A-Za-z]{3,}/.test(replacer.replace(/\$\d|CPU|UUID/g, '')), replacer)
})
