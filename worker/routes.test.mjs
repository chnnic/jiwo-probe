import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'

// 打包真实 Worker，用替身 fetch 记录发往主控的请求，不连接主控也不使用真实密钥。
const bundle = await build({ entryPoints: [new URL('./index.ts', import.meta.url).pathname], bundle: true, write: false, format: 'esm', platform: 'neutral' })
const { default: worker } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)

const TOKEN = 'test-probe-token'
const env = assetCalls => ({
  MMWX_ORIGIN: 'https://panel.test',
  PROBE_TOKEN: TOKEN,
  ASSETS: { fetch: async request => { assetCalls.push(new URL(request.url).pathname); return new Response('<!doctype html>', { headers: { 'Content-Type': 'text/html' } }) } },
})

async function withUpstream(handler, run) {
  const calls = []
  const original = globalThis.fetch
  globalThis.fetch = async request => { calls.push(request); return handler(request) }
  try { return await run(calls) } finally { globalThis.fetch = original }
}

test('/api/forward 只读代理到主控 probe-forward 并带上探针密钥', async () => {
  await withUpstream(() => Response.json({ chains: [] }), async calls => {
    const response = await worker.fetch(new Request('https://probe.test/api/forward'), env([]), { waitUntil() {} })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { chains: [] })
    assert.equal(calls.length, 1)
    assert.equal(new URL(calls[0].url).pathname, '/api/public/probe-forward')
    assert.equal(calls[0].method, 'GET')
    assert.equal(calls[0].headers.get('X-MMwx-Probe-Token'), TOKEN)
  })
})

test('/api/forward 拒绝非 GET 请求且不访问主控', async () => {
  await withUpstream(() => Response.json({}), async calls => {
    const response = await worker.fetch(new Request('https://probe.test/api/forward', { method: 'POST', body: '{}' }), env([]), { waitUntil() {} })
    assert.equal(response.status, 405)
    assert.equal(calls.length, 0)
  })
})

test('未知的 /api 路径返回 404，不回落到首页也不访问主控', async () => {
  const assetCalls = []
  await withUpstream(() => Response.json({}), async calls => {
    for (const path of ['/api/nodes', '/api/rpc2', '/api/public/probe-servers', '/api/admin/remote-servers']) {
      const response = await worker.fetch(new Request(`https://probe.test${path}`), env(assetCalls), { waitUntil() {} })
      assert.equal(response.status, 404, path)
      assert.notEqual(response.headers.get('Content-Type'), 'text/html')
    }
    assert.equal(calls.length, 0)
    assert.deepEqual(assetCalls, [])
  })
})

test('非 /api 路径仍交给静态资源（SPA 路由照常工作）', async () => {
  const assetCalls = []
  const response = await worker.fetch(new Request('https://probe.test/server/3'), env(assetCalls), { waitUntil() {} })
  assert.equal(response.status, 200)
  assert.deepEqual(assetCalls, ['/server/3'])
})

test('Passkey 鉴权转发不携带只读探针密钥和访客 Cookie', async () => {
  await withUpstream(() => Response.json({ ok: true }), async calls => {
    // 不带请求体：Node 的 Request 转发流式请求体需要 duplex 参数，Workers 运行时不需要；这里只验证请求头。
    const request = new Request('https://probe.test/api/login/passkey/begin', {
      method: 'POST',
      headers: { 'X-MMwx-Probe-Token': 'forged', Cookie: 'session=visitor', 'Content-Type': 'application/json' },
    })
    const response = await worker.fetch(request, env([]), { waitUntil() {} })
    assert.equal(response.status, 200)
    assert.equal(calls.length, 1)
    assert.equal(new URL(calls[0].url).pathname, '/api/login/passkey/begin')
    assert.equal(calls[0].headers.get('X-MMwx-Probe-Token'), null)
    assert.equal(calls[0].headers.get('Cookie'), null)
  })
})
