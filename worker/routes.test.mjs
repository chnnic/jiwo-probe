import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'

// 打包真实 Worker，用替身 fetch 记录发往主控的请求，不连接主控也不使用真实密钥。
const bundle = await build({ entryPoints: [new URL('./index.ts', import.meta.url).pathname], bundle: true, write: false, format: 'esm', platform: 'neutral' })
const { default: worker, ProbeHub } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)

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

test('占位值或缺失的设置返回 503 并说明缺哪项，不连接主控也不暴露值', async () => {
  const cases = [
    [{ MMWX_ORIGIN: '待填写', PROBE_TOKEN: '待填写' }, 'MMWX_ORIGIN,PROBE_TOKEN'],
    [{ MMWX_ORIGIN: undefined, PROBE_TOKEN: TOKEN }, 'MMWX_ORIGIN'],
    [{ MMWX_ORIGIN: 'panel.test', PROBE_TOKEN: TOKEN }, 'MMWX_ORIGIN'],
    [{ MMWX_ORIGIN: 'http://panel.test', PROBE_TOKEN: TOKEN }, 'MMWX_ORIGIN'],
    [{ MMWX_ORIGIN: 'https://panel.test', PROBE_TOKEN: '待填写' }, 'PROBE_TOKEN'],
  ]
  for (const [settings, missing] of cases) {
    await withUpstream(() => new Response('{}'), async calls => {
      const response = await worker.fetch(new Request('https://probe.test/api/probe'), { ...env([]), ...settings }, {})
      assert.equal(response.status, 503)
      assert.equal(response.headers.get('X-Probe-Setup'), missing)
      const body = await response.text()
      assert.ok(body.includes(missing))
      assert.ok(!body.includes(TOKEN))
      assert.equal(calls.length, 0)
    })
  }
})

test('占位设置下静态页面仍能打开，登录入口回到探针首页', async () => {
  const placeholders = { ...env([]), MMWX_ORIGIN: '待填写', PROBE_TOKEN: '待填写' }
  const page = await worker.fetch(new Request('https://probe.test/'), placeholders, {})
  assert.equal(page.status, 200)
  const login = await worker.fetch(new Request('https://probe.test/login'), placeholders, {})
  assert.equal(login.status, 302)
  assert.equal(login.headers.get('Location'), 'https://probe.test/')
})

// ProbeHub 的替身运行环境：内存存储、收集 waitUntil、没有 WebSocket 连接
function hubState(storage = new Map()) {
  const pending = []
  return {
    storage,
    pending,
    state: {
      storage: {
        get: async key => storage.get(key),
        put: async (key, value) => { storage.set(key, structuredClone(value)) },
        getAlarm: async () => 1,
        setAlarm: async () => {},
      },
      blockConcurrencyWhile: fn => fn(),
      waitUntil: promise => { pending.push(Promise.resolve(promise).catch(() => {})) },
      getWebSockets: () => [],
      getTags: () => [],
    },
  }
}

test('ProbeHub 冷启动先返回上一份快照并标明年龄，后台刷新后恢复实时数据', async () => {
  const realNow = Date.now
  let now = 1_800_000_000_000
  Date.now = () => now
  const hubEnv = { MMWX_ORIGIN: 'https://panel.test', PROBE_TOKEN: TOKEN }
  const snapshotRequest = () => new Request('https://probe-hub.internal/snapshot')
  let version = 1
  let release
  try {
    await withUpstream(async () => {
      if (release === null) await new Promise(resolve => { release = resolve })
      return Response.json({ enabled: true, version: version++, servers: [] })
    }, async calls => {
      const first = hubState()
      const hub = new ProbeHub(first.state, hubEnv)
      // 从没取过数据：只能等主控
      const cold = await hub.fetch(snapshotRequest())
      assert.equal(cold.headers.has('X-Probe-Stale-Age'), false)
      assert.equal((await cold.json()).version, 1)
      await Promise.all(first.pending)
      assert.equal(first.storage.has('probe-last-snapshot-v1'), true)

      // 12 秒内算新鲜，不标旧也不再访问主控
      now += 5_000
      const fresh = await hub.fetch(snapshotRequest())
      assert.equal(fresh.headers.has('X-Probe-Stale-Age'), false)
      assert.equal(calls.length, 1)

      // 闲置 5 分钟后主控变慢：立即拿到旧快照，主控请求在后台进行
      now += 300_000
      release = null
      const stale = await hub.fetch(snapshotRequest())
      assert.equal(stale.headers.get('X-Probe-Stale-Age'), '305')
      assert.equal((await stale.json()).version, 1)
      assert.equal(calls.length, 2)
      // 刷新还没回来时再来一位访客：仍是旧快照，不重复打主控
      const again = await hub.fetch(snapshotRequest())
      assert.equal(again.headers.get('X-Probe-Stale-Age'), '305')
      assert.equal(calls.length, 2)
      release()
      await Promise.all(first.pending)
      const refreshed = await hub.fetch(snapshotRequest())
      assert.equal(refreshed.headers.has('X-Probe-Stale-Age'), false)
      assert.equal((await refreshed.json()).version, 2)

      // Durable Object 被回收后的新实例：从存储取回快照，照样立即应答
      now += 120_000
      const second = hubState(first.storage)
      const revived = new ProbeHub(second.state, hubEnv)
      await new Promise(resolve => setTimeout(resolve, 0))
      release = null
      const fromStorage = await revived.fetch(snapshotRequest())
      assert.ok(Number(fromStorage.headers.get('X-Probe-Stale-Age')) >= 120)
      release()
      await Promise.all(second.pending)

      // 超过 30 分钟的快照不再拿出来，宁可等主控
      now += 31 * 60_000
      release = undefined
      const tooOld = await revived.fetch(snapshotRequest())
      assert.equal(tooOld.headers.has('X-Probe-Stale-Age'), false)
    })
  } finally {
    Date.now = realNow
  }
})

test('/api/probe 透传旧快照年龄且不写入微缓存', async () => {
  const puts = []
  const originalCaches = globalThis.caches
  globalThis.caches = { default: { match: async () => undefined, put: async (...args) => { puts.push(args) } } }
  try {
    const hub = { fetch: async () => new Response('{"servers":[]}', { headers: { 'Content-Type': 'application/json', 'X-Probe-Stale-Age': '42' } }) }
    const response = await worker.fetch(new Request('https://probe.test/api/probe', { headers: ownPage }), { ...env([]), PROBE_HUB: { getByName: () => hub } }, { waitUntil() {} })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('X-Probe-Stale-Age'), '42')
    assert.equal(response.headers.get('X-Probe-Cache'), 'BYPASS')
    assert.equal(puts.length, 0)
  } finally {
    globalThis.caches = originalCaches
  }
})

test('ProbeHub 广播：delta=2 的连接收第 2 版增量帧，delta=1 收第 1 版，其余和刚连上的收完整帧', async () => {
  const client = (tags, attachment = null) => ({ tags, attachment, sent: [], readyState: WebSocket.OPEN,
    send(data) { this.sent.push(JSON.parse(data)) }, deserializeAttachment() { return this.attachment }, serializeAttachment(value) { this.attachment = value } })
  const v2 = client(['probe-client', 'probe-delta2'])
  const v1 = client(['probe-client', 'probe-delta'])
  const plain = client(['probe-client'])
  const fresh = client(['probe-client', 'probe-delta2'], { needsFull: true })
  const sockets = [v2, v1, plain, fresh]
  const base = hubState()
  base.state.getWebSockets = tag => sockets.filter(socket => !tag || socket.tags.includes(tag))
  base.state.getTags = socket => socket.tags
  const server = cpu => ({ name: 'a', cpu_pct: cpu, os: 'Debian', cumulative_up: 1, cumulative_down: 1, ping: [{ key: 'k', label: 'K', current_ms: 10, loss_pct: 0, buckets: [{ ms: 10, loss: 0 }] }] })
  let cpu = 1
  await withUpstream(() => Response.json({ enabled: true, title: 't', servers: [server(cpu++)] }), async () => {
    const hub = new ProbeHub(base.state, { MMWX_ORIGIN: 'https://panel.test', PROBE_TOKEN: TOKEN })
    await hub.alarm()
    for (const socket of sockets) assert.equal(socket.sent.at(-1).delta, undefined)
    assert.equal(fresh.attachment, null)
    await hub.alarm()
    assert.equal(v2.sent.at(-1).delta, 2)
    assert.deepEqual(v2.sent.at(-1).servers, [{ cpu_pct: 2 }])
    assert.equal('title' in v2.sent.at(-1), false)
    assert.equal(v1.sent.at(-1).delta, 1)
    assert.equal(v1.sent.at(-1).servers[0].os, 'Debian')
    assert.equal(plain.sent.at(-1).delta, undefined)
    assert.equal(plain.sent.at(-1).servers[0].cpu_pct, 2)
    assert.equal(fresh.sent.at(-1).delta, 2)
  })
})
