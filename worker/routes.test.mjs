import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'

// 打包真实 Worker，用替身 fetch 记录发往主控的请求，不连接主控也不使用真实密钥。
const bundle = await build({ entryPoints: [new URL('./index.ts', import.meta.url).pathname], bundle: true, write: false, format: 'esm', platform: 'neutral' })
const { default: worker } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)

const TOKEN = 'test-probe-token'
// 模拟 not_found_handling 为 none 的静态资源：只有列出的文件存在，其余返回 404
const FILES = {
  '/': ['<!doctype html>', 'text/html'],
  '/map.html': ['<!doctype html><title>map</title>', 'text/html'],
  '/assets/main-abc.js': ['export {}', 'text/javascript'],
}
const env = assetCalls => ({
  MMWX_ORIGIN: 'https://panel.test',
  PROBE_TOKEN: TOKEN,
  ASSETS: { fetch: async request => {
    const path = new URL(request.url).pathname
    assetCalls.push(path)
    const file = FILES[path]
    return file ? new Response(file[0], { headers: { 'Content-Type': file[1] } }) : new Response('', { status: 404 })
  } },
})

async function withUpstream(handler, run) {
  const calls = []
  const original = globalThis.fetch
  globalThis.fetch = async request => { calls.push(request); return handler(request) }
  try { return await run(calls) } finally { globalThis.fetch = original }
}

// 探针自己页面发出的请求：浏览器同源 fetch 会带 Sec-Fetch-Site: same-origin
const ownPage = { 'Sec-Fetch-Site': 'same-origin' }

test('/api/forward 只读代理到主控 probe-forward 并带上探针密钥', async () => {
  await withUpstream(() => Response.json({ chains: [] }), async calls => {
    const response = await worker.fetch(new Request('https://probe.test/api/forward', { headers: ownPage }), env([]), { waitUntil() {} })
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
    const response = await worker.fetch(new Request('https://probe.test/api/forward', { method: 'POST', headers: ownPage }), env([]), { waitUntil() {} })
    assert.equal(response.status, 405)
    assert.equal(calls.length, 0)
  })
})

test('代理接口只放行探针自己页面：同源 Origin、同源 Sec-Fetch-Site 或本站 Referer', async () => {
  await withUpstream(() => Response.json({ chains: [] }), async calls => {
    for (const headers of [{ Origin: 'https://probe.test' }, { 'Sec-Fetch-Site': 'same-origin' }, { Referer: 'https://probe.test/?theme=premium' }]) {
      const response = await worker.fetch(new Request('https://probe.test/api/forward', { headers }), env([]), { waitUntil() {} })
      assert.equal(response.status, 200, JSON.stringify(headers))
    }
    assert.equal(calls.length, 3)
  })
})

test('别的网站和没有来源信息的请求一律 404，不访问主控', async () => {
  await withUpstream(() => Response.json({ chains: [] }), async calls => {
    const rejected = [
      {},
      { Origin: 'https://evil.test' },
      { 'Sec-Fetch-Site': 'cross-site' },
      { 'Sec-Fetch-Site': 'none' },
      { Referer: 'https://evil.test/probe.test' },
      // Origin 优先：同源 Referer 也救不了外站 Origin
      { Origin: 'https://evil.test', Referer: 'https://probe.test/' },
    ]
    for (const headers of rejected) {
      for (const path of ['/api/forward', '/api/probe', '/api/series?server=0']) {
        const response = await worker.fetch(new Request(`https://probe.test${path}`, { headers }), env([]), { waitUntil() {} })
        assert.equal(response.status, 404, `${path} ${JSON.stringify(headers)}`)
        assert.equal(response.headers.get('Cache-Control'), 'no-store')
      }
    }
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

test('不带扩展名的未知路径回落到首页（单页应用路由照常工作）', async () => {
  const assetCalls = []
  const response = await worker.fetch(new Request('https://probe.test/server/3'), env(assetCalls), { waitUntil() {} })
  assert.equal(response.status, 200)
  assert.equal(await response.text(), '<!doctype html>')
  assert.deepEqual(assetCalls, ['/server/3', '/'])
})

test('缺失的构建产物返回不缓存的 404，不回落成首页 HTML', async () => {
  for (const path of ['/assets/LuminaPlusApp-old.js', '/assets/main-old.css', '/twemoji/1f1ed-1f1f0.svg', '/fonts/missing.woff2']) {
    const assetCalls = []
    const response = await worker.fetch(new Request(`https://probe.test${path}`), env(assetCalls), { waitUntil() {} })
    assert.equal(response.status, 404, path)
    assert.equal(response.headers.get('Cache-Control'), 'no-store', path)
    assert.deepEqual(assetCalls, [path], path)
  }
})

test('存在的静态文件原样返回', async () => {
  const response = await worker.fetch(new Request('https://probe.test/assets/main-abc.js'), env([]), { waitUntil() {} })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Content-Type'), 'text/javascript')
  assert.equal((await worker.fetch(new Request('https://probe.test/map.html'), env([]), { waitUntil() {} })).status, 200)
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
