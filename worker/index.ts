interface Env {
  ASSETS: Fetcher
  MMWX_ORIGIN: string
  PROBE_TOKEN: string
  LOAD_KV: KVNamespace
}

const routes: Record<string, string> = {
  '/api/probe': '/api/public/probe-servers',
  '/api/series': '/api/public/probe-series',
  '/api/stream': '/api/public/probe-ws',
}

function upstreamURL(request: Request, env: Env): URL | null {
  const incoming = new URL(request.url)
  const path = routes[incoming.pathname]
  if (!path) return null

  const origin = new URL(env.MMWX_ORIGIN)
  if (origin.protocol !== 'https:' && origin.hostname !== '127.0.0.1' && origin.hostname !== 'localhost') {
    throw new Error('MMWX_ORIGIN must use HTTPS')
  }
  origin.pathname = path
  origin.search = incoming.search
  return origin
}

// KV key: load:{YYYYMMDDHH}（UTC 小时桶），值: { "0": [[ts,l1,l5,l15], ...], "1": [...] }（按 server 数组下标）
const hourKey = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}`
}

type LoadPoint = [number, number, number, number] // ts(秒), load1, load5, load15

const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1)

// 读负载历史并按 range 聚合（与延迟图同粒度: 1h=12×5m, 6h=36×10m, 24h=48×30m）
async function loadHistory(env: Env, serverIdx: number, range: string): Promise<Response> {
  const bucketSec = range === '6h' ? 600 : range === '24h' ? 1800 : 300
  const count = range === '6h' ? 36 : range === '24h' ? 48 : 12
  const hours = Math.ceil((count * bucketSec) / 3600) + 1
  const now = Date.now()

  const keys: string[] = []
  for (let h = 0; h <= hours; h++) {
    keys.push(`load:${hourKey(new Date(now - h * 3600 * 1000))}`)
  }
  const raw = (await Promise.all(keys.map((k) => env.LOAD_KV.get(k, 'json')))) as (Record<string, LoadPoint[]> | null)[]
  const points: LoadPoint[] = []
  for (const data of raw) {
    const arr = data?.[String(serverIdx)]
    if (arr?.length) points.push(...arr)
  }

  // 按 bucket 对齐取均值
  const buckets = new Map<number, number[][]>()
  for (const [ts, l1, l5, l15] of points) {
    const b = ts - (ts % bucketSec)
    const list = buckets.get(b) ?? []
    list.push([l1, l5, l15])
    buckets.set(b, list)
  }
  const rows = [...buckets.entries()].sort((a, b) => a[0] - b[0]).slice(-count)
  const out = rows.map(([ts, list]) => ({
    ts,
    l1: Number(avg(list.map((x) => x[0])).toFixed(3)),
    l5: Number(avg(list.map((x) => x[1])).toFixed(3)),
    l15: Number(avg(list.map((x) => x[2])).toFixed(3)),
  }))

  return new Response(JSON.stringify({ success: true, points: out, bucket_sec: bucketSec, generated_at: Math.floor(now / 1000) }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

// 采集: 拉主控 probe-servers，把每台 loadavg 写入 KV（按小时分桶），并清理 7 天前的 key
// 同时把每台 daily_traffic 按日期合并进 daily-history（跨周期历史缓存，保留 90 天，单 key）
async function collectLoad(env: Env): Promise<void> {
  const origin = new URL(env.MMWX_ORIGIN)
  origin.pathname = '/api/public/probe-servers'
  const resp = await fetch(origin.toString(), { headers: { 'X-MMwx-Probe-Token': env.PROBE_TOKEN } })
  if (!resp.ok) return
  const payload = (await resp.json()) as { servers?: { loadavg?: string; name?: string; daily_traffic?: { date?: string; uplink?: number; downlink?: number; total?: number }[] }[] }
  const servers = payload.servers ?? []
  if (!servers.length) return

  // --- loadavg 采集（原逻辑）---
  const now = new Date()
  const key = `load:${hourKey(now)}`
  const ts = Math.floor(now.getTime() / 1000)
  const data = ((await env.LOAD_KV.get(key, 'json')) as Record<string, LoadPoint[]> | null) ?? {}

  servers.forEach((s, i) => {
    const parts = (s.loadavg ?? '').trim().split(/\s+/).map(Number)
    if (parts.length < 3 || isNaN(parts[0])) return
    const idx = String(i)
    const arr = data[idx] ?? []
    const last = arr[arr.length - 1]
    // 同桶内 4 分钟内重复采样 → 覆盖最后一点（防 cron 重试/抖动产生重复点）
    if (last && ts - last[0] < 240) arr[arr.length - 1] = [ts, parts[0], parts[1], parts[2]]
    else arr.push([ts, parts[0], parts[1], parts[2]])
    if (arr.length > 14) arr.splice(0, arr.length - 14) // 每 key 每台最多 14 点（70 分钟）
    data[idx] = arr
  })

  await env.LOAD_KV.put(key, JSON.stringify(data))

  // 清理 7 天前的 load key
  const cutoff = Date.now() - 7 * 86400 * 1000
  let cursor: string | undefined
  do {
    const list = await env.LOAD_KV.list({ prefix: 'load:', cursor })
    for (const item of list.keys) {
      const k = item.name.slice('load:'.length)
      if (!/^\d{10}$/.test(k)) continue
      const t = Date.UTC(Number(k.slice(0, 4)), Number(k.slice(4, 6)) - 1, Number(k.slice(6, 8)), Number(k.slice(8, 10)))
      if (t < cutoff) await env.LOAD_KV.delete(item.name)
    }
    cursor = list.list_complete ? undefined : list.cursor
  } while (cursor)

  // --- daily_traffic 跨周期历史采集 ---
  // KV key: daily-history, 值: { "YYYY-MM-DD": { "<serverName>": [uplink, downlink, total] } }（紧凑数组省体积）
  // 上游 daily_traffic = 当前重置周期内，周期重置会清零 → 这里按天合并，跨周期保留 90 天
  const HIST_KEY = 'daily-history'
  const history = ((await env.LOAD_KV.get(HIST_KEY, 'json')) as Record<string, Record<string, [number, number, number]>>) ?? {}
  for (const s of servers) {
    const name = s.name?.trim()
    if (!name || !Array.isArray(s.daily_traffic)) continue
    for (const row of s.daily_traffic) {
      if (!row?.date) continue
      const up = row.uplink ?? 0
      const down = row.downlink ?? 0
      const rec: [number, number, number] = [up, down, row.total ?? up + down]
      history[row.date] = history[row.date] ?? {}
      history[row.date][name] = rec
    }
  }
  const cutoffDate = new Date(now.getTime() - 90 * 86400 * 1000).toISOString().slice(0, 10)
  for (const date of Object.keys(history)) {
    if (date < cutoffDate) delete history[date]
  }
  await env.LOAD_KV.put(HIST_KEY, JSON.stringify(history))
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const incoming = new URL(request.url)
    if (incoming.pathname === '/api/load') {
      if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 })
      const serverIdx = Number(incoming.searchParams.get('server') ?? '0')
      const range = incoming.searchParams.get('range') ?? '1h'
      return loadHistory(env, Number.isFinite(serverIdx) ? serverIdx : 0, range)
    }

    // daily_traffic 跨周期历史（Worker cron 采集，按天合并，保留 90 天）——前端用它补全脉冲图/日流量趋势
    if (incoming.pathname === '/api/daily-history') {
      if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 })
      const history = (await env.LOAD_KV.get('daily-history', 'json')) ?? {}
      return new Response(JSON.stringify({ success: true, history }), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      })
    }

    const target = upstreamURL(request, env)
    if (!target) return env.ASSETS.fetch(request)
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 })
    if (!env.PROBE_TOKEN) {
      return new Response('Probe access secret is not configured', { status: 503 })
    }

    const headers = new Headers(request.headers)
    headers.delete('cookie')
    headers.delete('authorization')
    headers.set('X-Forwarded-Host', new URL(request.url).host)
    headers.set('X-MMwx-Probe-Token', env.PROBE_TOKEN)

    const upstream = await fetch(new Request(target, { method: 'GET', headers }))
    // WebSocket 的 101 Response 必须原样返回，不能重新构造 body/headers。
    if (upstream.status === 101 || upstream.webSocket) return upstream

    const responseHeaders = new Headers(upstream.headers)
    responseHeaders.set('Cache-Control', 'no-store')
    responseHeaders.set('X-Content-Type-Options', 'nosniff')
    responseHeaders.delete('set-cookie')
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    })
  },
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    if (!env.PROBE_TOKEN) return
    try {
      await collectLoad(env)
    } catch (error) {
      console.error('collectLoad failed:', error)
    }
  },
} satisfies ExportedHandler<Env>
