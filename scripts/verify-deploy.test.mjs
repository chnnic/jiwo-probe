import assert from 'node:assert/strict'
import test from 'node:test'
import { mainAssetOf, waitForAsset } from './verify-deploy.mjs'

const page = asset => `<script type="module" crossorigin src="${asset}"></script>`
const respond = html => async () => ({ ok: true, text: async () => html })
const noSleep = async () => {}

test('从 index.html 中取出 main 入口脚本', () => {
  assert.equal(mainAssetOf(page('/assets/main-BRHB17Wx.js')), '/assets/main-BRHB17Wx.js')
  assert.equal(mainAssetOf('<html></html>'), null)
})

test('线上哈希与本地一致时立即通过', async () => {
  const result = await waitForAsset('https://probe.test/', '/assets/main-a.js', { fetchImpl: respond(page('/assets/main-a.js')), sleep: noSleep })
  assert.deepEqual(result, { ok: true, seen: '/assets/main-a.js' })
})

test('边缘传播期间先返回旧版本，之后更新即通过', async () => {
  const pages = [page('/assets/main-old.js'), page('/assets/main-old.js'), page('/assets/main-new.js')]
  const fetchImpl = async () => ({ ok: true, text: async () => pages.shift() })
  const result = await waitForAsset('https://probe.test/', '/assets/main-new.js', { fetchImpl, sleep: noSleep, intervalMs: 0 })
  assert.equal(result.ok, true)
})

test('超时仍未更新时报告看到的旧版本', async () => {
  const result = await waitForAsset('https://probe.test/', '/assets/main-new.js', { fetchImpl: respond(page('/assets/main-old.js')), sleep: noSleep, timeoutMs: 0 })
  assert.deepEqual(result, { ok: false, seen: '/assets/main-old.js' })
})

test('网络错误不会中断重试', async () => {
  let calls = 0
  const fetchImpl = async () => {
    calls += 1
    if (calls === 1) throw new Error('network')
    return { ok: true, text: async () => page('/assets/main-a.js') }
  }
  const result = await waitForAsset('https://probe.test/', '/assets/main-a.js', { fetchImpl, sleep: noSleep, intervalMs: 0 })
  assert.equal(result.ok, true)
  assert.equal(calls, 2)
})

test('请求带随机参数且不使用缓存', async () => {
  let seenUrl, seenInit
  const fetchImpl = async (url, init) => { seenUrl = url; seenInit = init; return { ok: true, text: async () => page('/assets/main-a.js') } }
  await waitForAsset('https://probe.test/', '/assets/main-a.js', { fetchImpl, sleep: noSleep })
  assert.ok(seenUrl.searchParams.has('_verify'))
  assert.equal(seenInit.cache, 'no-store')
})
