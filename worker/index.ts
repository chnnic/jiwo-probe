import { parsePingGroupConfig } from '../src/ping-groups'

interface Env {
  ASSETS: Fetcher
  MMWX_ORIGIN: string
  PROBE_TOKEN: string
  PROBE_HUB: DurableObjectNamespace
  PROBE_POLL_INTERVAL_SECONDS?: string
  PROBE_BACKGROUND_URL?: string
  PROBE_BACKGROUND_OVERLAY?: string
  PROBE_BACKGROUND_POSITION?: string
  PROBE_BACKGROUND_THEMES?: string
  PROBE_PING_GROUP_COUNT?: string
  PROBE_PING_DEFAULT_TARGETS?: string
  PROBE_PING_INTL_TARGETS?: string
}

const PROBE_CACHE_TTL_SECONDS = 3
const HUB_SNAPSHOT_MAX_AGE_MS = 12_000
const HUB_IDLE_CLOSE_MS = 30_000
const HUB_DEFAULT_POLL_MS = 3_000
const HUB_MIN_POLL_MS = 3_000
const HUB_MAX_POLL_MS = 60_000
const HUB_NAME = 'global'
const HUB_CLIENT_TAG = 'probe-client'
const ESTIMATED_TRAFFIC_STORAGE_KEY = 'probe-estimated-daily-traffic-v1'
const ESTIMATED_TRAFFIC_RETENTION_DAYS = 30
const ESTIMATED_TRAFFIC_FLUSH_MS = 5 * 60 * 1_000
const BACKGROUND_POSITIONS = new Set(['center', 'top', 'bottom', 'left', 'right'])
const DEFAULT_BACKGROUND_THEMES = 'pixel,flat,anime,glass,lumina,premium,ran,glassmorphism,emerald'

function runtimeThemeConfig(env: Env): Record<string, unknown> {
  return {
    ...runtimeBackgroundConfig(env),
    pingGroups: parsePingGroupConfig({
      count: env.PROBE_PING_GROUP_COUNT,
      defaultTargets: env.PROBE_PING_DEFAULT_TARGETS,
      intlTargets: env.PROBE_PING_INTL_TARGETS,
    }),
  }
}

function runtimeBackgroundConfig(env: Env): Record<string, unknown> {
  const rawUrl = env.PROBE_BACKGROUND_URL?.trim()
  if (!rawUrl) return {}

  let url: string
  try {
    if (rawUrl.startsWith('/') && !rawUrl.startsWith('//')) {
      url = rawUrl
    } else {
      const parsed = new URL(rawUrl)
      if (parsed.protocol !== 'https:') return {}
      url = parsed.toString()
    }
  } catch {
    return {}
  }

  const parsedOverlay = Number(env.PROBE_BACKGROUND_OVERLAY)
  const overlay = Number.isFinite(parsedOverlay)
    ? Math.min(0.95, Math.max(0, parsedOverlay))
    : 0.32
  const requestedPosition = env.PROBE_BACKGROUND_POSITION?.trim().toLowerCase() || 'center'
  const position = BACKGROUND_POSITIONS.has(requestedPosition) ? requestedPosition : 'center'
  const themes = (env.PROBE_BACKGROUND_THEMES || DEFAULT_BACKGROUND_THEMES)
    .split(',')
    .map((theme) => theme.trim().toLowerCase())
    .filter((theme) => theme === 'all' || /^[a-z0-9_-]{1,64}$/.test(theme))

  return {
    background: {
      url,
      overlay,
      position,
      themes: themes.length ? themes : DEFAULT_BACKGROUND_THEMES.split(','),
    },
  }
}

interface EstimatedDailyTrafficRow {
  uplink: number
  downlink: number
  total: number
}

interface EstimatedServerTraffic {
  lastUp: number
  lastDown: number
  lastSeenAt: number
  days: Record<string, EstimatedDailyTrafficRow>
}

type EstimatedTrafficState = Record<string, EstimatedServerTraffic>

type MutableProbeServer = Record<string, unknown> & {
  name?: string
  period_start?: string
  period_end?: string
  daily_traffic?: Array<{
    date?: string
    uplink?: number
    downlink?: number
    total?: number
  }>
}

interface MutableProbePayload {
  servers?: MutableProbeServer[]
}

function finiteCounter(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  return value
}

function hasReportedDailyTraffic(server: MutableProbeServer): boolean {
  return (server.daily_traffic || []).some((row) =>
    (finiteCounter(row.uplink) || 0) > 0 ||
    (finiteCounter(row.downlink) || 0) > 0 ||
    (finiteCounter(row.total) || 0) > 0,
  )
}

function needsEstimatedTraffic(server: MutableProbeServer): boolean {
  if (hasReportedDailyTraffic(server)) return false
  const split = [
    finiteCounter(server.traffic_used_up),
    finiteCounter(server.traffic_used_down),
    finiteCounter(server.traffic_used_total),
  ]
  return split.every((value) => value === null || value === 0)
}

function pruneEstimatedDays(days: Record<string, EstimatedDailyTrafficRow>, now: number): void {
  const cutoff = new Date(now - (ESTIMATED_TRAFFIC_RETENTION_DAYS - 1) * 86_400_000)
    .toISOString()
    .slice(0, 10)
  for (const date of Object.keys(days)) {
    if (date < cutoff) delete days[date]
  }
}

type CloudflareCacheStorage = CacheStorage & { default: Cache }

function edgeCache(): Cache {
  return (caches as CloudflareCacheStorage).default
}

const routes: Record<string, string> = {
  '/api/probe': '/api/public/probe-servers',
  '/api/series': '/api/public/probe-series',
  '/api/stream': '/api/public/probe-ws',
}

// Passkey 是探针唯一允许向主控 POST 的公开鉴权端点；不携带只读 PROBE_TOKEN。
const authRoutes = new Set([
  '/api/login/passkey/begin',
  '/api/login/passkey/finish',
])

function originURL(env: Env, pathname: string, search = ''): URL {
  const origin = new URL(env.MMWX_ORIGIN)
  if (origin.protocol !== 'https:' && origin.hostname !== '127.0.0.1' && origin.hostname !== 'localhost') {
    throw new Error('MMWX_ORIGIN must use HTTPS')
  }
  origin.pathname = pathname
  origin.search = search
  return origin
}

function upstreamURL(request: Request, env: Env): URL | null {
  const incoming = new URL(request.url)
  const path = routes[incoming.pathname]
  return path ? originURL(env, path, incoming.search) : null
}

function upstreamHeaders(request: Request, env: Env): Headers {
  const headers = new Headers(request.headers)
  headers.delete('cookie')
  headers.delete('authorization')
  headers.set('X-Forwarded-Host', new URL(request.url).host)
  headers.set('X-MMwx-Probe-Token', env.PROBE_TOKEN)
  return headers
}

async function proxyAuth(request: Request, incoming: URL, env: Env): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const target = originURL(env, incoming.pathname, incoming.search)
  const headers = new Headers(request.headers)
  headers.delete('cookie')
  headers.delete('authorization')
  headers.delete('X-MMwx-Probe-Token')
  headers.set('X-Forwarded-Host', incoming.host)
  headers.set('X-Forwarded-Proto', 'https')

  const upstream = await fetch(new Request(target, {
    method: 'POST',
    headers,
    body: request.body,
  }))
  const responseHeaders = new Headers(upstream.headers)
  responseHeaders.set('Cache-Control', 'no-store')
  responseHeaders.set('X-Content-Type-Options', 'nosniff')
  responseHeaders.delete('set-cookie')

  // 仅在 Passkey 校验成功后返回主控地址，供前端把 token 通过 URL fragment 带回主控。
  if (incoming.pathname.endsWith('/finish') && upstream.ok) {
    try {
      const payload = (await upstream.json()) as Record<string, unknown>
      payload.master_origin = env.MMWX_ORIGIN
      return Response.json(payload, { status: upstream.status, headers: responseHeaders })
    } catch {
      return new Response('Bad upstream response', { status: 502 })
    }
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  })
}

function probeCacheKey(request: Request): Request | null {
  const incoming = new URL(request.url)
  if (incoming.pathname !== '/api/probe') return null
  // /api/probe 没有查询参数语义。统一 cache key，避免随机查询串绕过微缓存。
  incoming.search = ''
  return new Request(incoming.toString(), { method: 'GET' })
}

function clientResponse(
  response: Response,
  cacheStatus: 'HIT' | 'MISS' | 'BYPASS',
  source?: 'hub' | 'origin-fallback' | 'origin',
): Response {
  const headers = new Headers(response.headers)
  // Cache API 的副本可共享 3 秒；浏览器端仍不落盘，避免显示陈旧状态。
  headers.set('Cache-Control', 'private, no-store')
  headers.set('X-Probe-Cache', cacheStatus)
  if (source) headers.set('X-Probe-Source', source)
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.delete('set-cookie')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function sanitizedResponse(response: Response): Response {
  const headers = new Headers(response.headers)
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.delete('set-cookie')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function hubStub(env: Env): DurableObjectStub {
  return env.PROBE_HUB.getByName(HUB_NAME)
}

function hubPollIntervalMs(env: Env): number {
  if (!env.PROBE_POLL_INTERVAL_SECONDS) return HUB_DEFAULT_POLL_MS
  const milliseconds = Number(env.PROBE_POLL_INTERVAL_SECONDS) * 1_000
  if (!Number.isFinite(milliseconds)) return HUB_DEFAULT_POLL_MS
  return Math.min(HUB_MAX_POLL_MS, Math.max(HUB_MIN_POLL_MS, Math.round(milliseconds)))
}

async function directUpstream(request: Request, env: Env, target: URL): Promise<Response> {
  return fetch(new Request(target, {
    method: 'GET',
    headers: upstreamHeaders(request, env),
  }))
}

async function shouldBlockOriginLogin(request: Request, env: Env): Promise<boolean> {
  if (!env.PROBE_TOKEN) return true
  try {
    const response = await directUpstream(
      request,
      env,
      originURL(env, '/api/public/probe-servers'),
    )
    if (!response.ok) return true
    const payload = await response.json() as { block_login?: boolean }
    return payload.block_login === true
  } catch {
    // 无法确认开关状态时不暴露主控登录页。
    return true
  }
}

/**
 * 全局 ProbeHub：无论 Worker 有多少访问域名或边缘节点，固定名称都映射到同一个
 * Durable Object。所有浏览器共享同一个定时快照采集器。
 */
export class ProbeHub implements DurableObject {
  private readonly state: DurableObjectState
  private readonly env: Env
  private readonly pollIntervalMs: number
  private idleTimer: ReturnType<typeof setTimeout> | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private latestPayload: string | null = null
  private latestAt = 0
  private snapshotRequest: Promise<string> | null = null
  private estimatedTraffic: EstimatedTrafficState = {}
  private estimatedTrafficReady: Promise<void>
  private estimatedTrafficDirty = false
  private estimatedTrafficLastFlushAt = 0

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.env = env
    this.pollIntervalMs = hubPollIntervalMs(env)
    this.estimatedTrafficReady = this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<EstimatedTrafficState>(ESTIMATED_TRAFFIC_STORAGE_KEY)
      if (stored && typeof stored === 'object') this.estimatedTraffic = stored
      if (await this.state.storage.getAlarm() === null) {
        await this.state.storage.setAlarm(Date.now() + ESTIMATED_TRAFFIC_FLUSH_MS)
      }
    })
  }

  async alarm(): Promise<void> {
    try {
      await this.forceSnapshotRefresh()
    } finally {
      await this.state.storage.setAlarm(Date.now() + ESTIMATED_TRAFFIC_FLUSH_MS)
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/stream') return this.openClient(request)
    if (url.pathname === '/snapshot') return this.snapshot()
    return new Response('Not found', { status: 404 })
  }

  webSocketClose(ws: WebSocket): void {
    try {
      ws.close(1000, 'client disconnected')
    } catch {
      // Socket may already be fully closed.
    }
    this.onClientCountChanged()
  }

  webSocketError(ws: WebSocket): void {
    try {
      ws.close(1011, 'client websocket error')
    } catch {
      // Socket may already be fully closed.
    }
    this.onClientCountChanged()
  }

  private openClient(request: Request): Response {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.state.acceptWebSocket(server, [HUB_CLIENT_TAG])
    this.cancelIdleClose()

    if (this.latestPayload && Date.now() - this.latestAt <= HUB_SNAPSHOT_MAX_AGE_MS) {
      server.send(this.latestPayload)
    } else {
      this.state.waitUntil(this.seedClientsFromSnapshot())
    }
    this.startPolling()

    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: { 'X-Probe-Hub': 'shared' },
    })
  }

  private async snapshot(): Promise<Response> {
    try {
      const payload = await this.ensureSnapshot()
      return new Response(payload, {
        headers: {
          'Cache-Control': 'private, no-store',
          'Content-Type': 'application/json; charset=utf-8',
          'X-Probe-Source': 'hub',
        },
      })
    } catch (error) {
      console.error('ProbeHub snapshot failed', error)
      return new Response('ProbeHub snapshot unavailable', { status: 502 })
    }
  }

  private clients(): WebSocket[] {
    return this.state.getWebSockets(HUB_CLIENT_TAG).filter((socket) => socket.readyState === WebSocket.OPEN)
  }

  private async seedClientsFromSnapshot(): Promise<void> {
    try {
      await this.ensureSnapshot()
    } catch (error) {
      // The scheduled poll will retry after a failed initial snapshot.
      console.warn('ProbeHub initial snapshot failed', error)
    }
  }

  private async ensureSnapshot(): Promise<string> {
    if (this.latestPayload && Date.now() - this.latestAt <= HUB_SNAPSHOT_MAX_AGE_MS) {
      return this.latestPayload
    }
    if (this.snapshotRequest) return this.snapshotRequest

    this.snapshotRequest = this.fetchSnapshot()
    try {
      return await this.snapshotRequest
    } finally {
      this.snapshotRequest = null
    }
  }

  private async fetchSnapshot(): Promise<string> {
    const response = await fetch(originURL(this.env, '/api/public/probe-servers'), {
      headers: { 'X-MMwx-Probe-Token': this.env.PROBE_TOKEN },
    })
    if (!response.ok) throw new Error(`upstream snapshot returned ${response.status}`)
    const upstreamPayload = await response.text()
    if (!upstreamPayload) throw new Error('upstream snapshot was empty')
    const payload = await this.addEstimatedDailyTraffic(upstreamPayload)
    this.rememberAndBroadcast(payload)
    return payload
  }

  /**
   * API Push 节点可能只上报系统累计计数，daily_traffic 与周期上下行保持为 0。
   * ProbeHub 以累计计数差值生成共享日流量；主控一旦返回任意真实日流量即原样透传。
   */
  private async addEstimatedDailyTraffic(rawPayload: string): Promise<string> {
    await this.estimatedTrafficReady

    let payload: MutableProbePayload
    try {
      payload = JSON.parse(rawPayload) as MutableProbePayload
    } catch {
      return rawPayload
    }
    if (!Array.isArray(payload.servers)) return rawPayload

    const now = Date.now()
    const today = new Date(now).toISOString().slice(0, 10)

    for (const server of payload.servers) {
      const name = server.name?.trim()
      const currentUp = finiteCounter(server.cumulative_up)
      const currentDown = finiteCounter(server.cumulative_down)
      if (!name || currentUp === null || currentDown === null) continue

      let estimate = this.estimatedTraffic[name]
      if (!estimate) {
        estimate = {
          lastUp: currentUp,
          lastDown: currentDown,
          lastSeenAt: now,
          days: { [today]: { uplink: 0, downlink: 0, total: 0 } },
        }
        this.estimatedTraffic[name] = estimate
        this.estimatedTrafficDirty = true
      } else {
        const uplinkDelta = currentUp >= estimate.lastUp ? currentUp - estimate.lastUp : 0
        const downlinkDelta = currentDown >= estimate.lastDown ? currentDown - estimate.lastDown : 0
        const row = estimate.days[today] || { uplink: 0, downlink: 0, total: 0 }
        if (uplinkDelta > 0 || downlinkDelta > 0 || !estimate.days[today]) {
          row.uplink += uplinkDelta
          row.downlink += downlinkDelta
          row.total = row.uplink + row.downlink
          estimate.days[today] = row
          this.estimatedTrafficDirty = true
        }
        estimate.lastUp = currentUp
        estimate.lastDown = currentDown
        estimate.lastSeenAt = now
      }

      pruneEstimatedDays(estimate.days, now)
      if (!needsEstimatedTraffic(server)) continue

      const estimatedRows = Object.entries(estimate.days)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, row]) => ({ date, ...row }))
      if (!estimatedRows.length) continue

      let cycleRows = estimatedRows.filter((row) =>
        (!server.period_start || row.date >= server.period_start) &&
        (!server.period_end || row.date < server.period_end),
      )
      // 个别 Push 节点会把 period_start 下发成次日；范围不含当天时，
      // 至少展示补偿启用以来的累计值，避免“日流量有值、周期流量仍为 0”。
      if (!cycleRows.length) cycleRows = estimatedRows
      const cycle = cycleRows.reduce(
        (sum, row) => ({
          uplink: sum.uplink + row.uplink,
          downlink: sum.downlink + row.downlink,
          total: sum.total + row.total,
        }),
        { uplink: 0, downlink: 0, total: 0 },
      )

      server.daily_traffic = estimatedRows
      server.daily_traffic_start = estimatedRows[0].date
      server.daily_traffic_end = estimatedRows[estimatedRows.length - 1].date
      server.daily_traffic_scope = 'probe_estimated_from_cumulative'
      server.daily_traffic_estimated = true
      server.traffic_used_up = cycle.uplink
      server.traffic_used_down = cycle.downlink
      server.traffic_used_total = cycle.total
      server.traffic_used_scope = 'probe_estimated_from_cumulative'
      server.traffic_used_estimated = true
    }

    if (
      this.estimatedTrafficDirty &&
      now - this.estimatedTrafficLastFlushAt >= ESTIMATED_TRAFFIC_FLUSH_MS
    ) {
      await this.state.storage.put(ESTIMATED_TRAFFIC_STORAGE_KEY, this.estimatedTraffic)
      this.estimatedTrafficDirty = false
      this.estimatedTrafficLastFlushAt = now
    }

    return JSON.stringify(payload)
  }

  private async forceSnapshotRefresh(): Promise<void> {
    if (this.snapshotRequest) {
      await this.snapshotRequest
      return
    }
    this.snapshotRequest = this.fetchSnapshot()
    try {
      await this.snapshotRequest
    } catch (error) {
      console.error('ProbeHub scheduled snapshot failed', error)
    } finally {
      this.snapshotRequest = null
    }
  }

  private startPolling(): void {
    if (this.pollTimer) return
    this.state.waitUntil(this.forceSnapshotRefresh())
    this.pollTimer = setInterval(() => {
      this.state.waitUntil(this.forceSnapshotRefresh())
    }, this.pollIntervalMs)
  }

  private stopPolling(): void {
    if (!this.pollTimer) return
    clearInterval(this.pollTimer)
    this.pollTimer = null
  }

  private rememberAndBroadcast(payload: string): void {
    this.latestPayload = payload
    this.latestAt = Date.now()
    for (const client of this.clients()) {
      try {
        client.send(payload)
      } catch {
        try {
          client.close(1011, 'broadcast failed')
        } catch {
          // Client is already gone.
        }
      }
    }
  }

  private onClientCountChanged(): void {
    if (this.clients().length) {
      this.cancelIdleClose()
      this.startPolling()
    } else {
      this.scheduleIdleClose()
    }
  }

  private scheduleIdleClose(): void {
    if (this.idleTimer) return
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null
      if (this.clients().length) return
      this.stopPolling()
    }, HUB_IDLE_CLOSE_MS)
  }

  private cancelIdleClose(): void {
    if (!this.idleTimer) return
    clearTimeout(this.idleTimer)
    this.idleTimer = null
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const incoming = new URL(request.url)
    if (incoming.pathname === '/login') {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method not allowed', { status: 405 })
      }
      if (await shouldBlockOriginLogin(request, env)) {
        return Response.redirect(new URL('/', incoming).toString(), 302)
      }
      return Response.redirect(new URL('/login', env.MMWX_ORIGIN).toString(), 302)
    }

    if (authRoutes.has(incoming.pathname)) {
      return proxyAuth(request, incoming, env)
    }

    // 运行时主题配置只包含公开的显示参数，不返回任何 Worker Secret。
    if (incoming.pathname === '/api/theme-config') {
      if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 })
      return Response.json(runtimeThemeConfig(env), {
        headers: {
          'Cache-Control': 'public, max-age=60',
          'Content-Type': 'application/json; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }

    // 访客信息（Ran 主题访客浮卡用）——直接读 CF 请求头，不调用第三方
    if (incoming.pathname === '/api/visitor') {
      if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 })
      const cf = request.cf
      const optionalNumber = (value: unknown): number | undefined => {
        if (typeof value !== 'string' && typeof value !== 'number') return undefined
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : undefined
      }
      return Response.json(
        {
          ip: request.headers.get('CF-Connecting-IP') || 'UNKNOWN',
          city: cf?.city,
          region: cf?.region,
          country: cf?.country,
          isp: cf?.asOrganization,
          lat: optionalNumber(cf?.latitude),
          lon: optionalNumber(cf?.longitude),
          risk: null,
          proxy: 'unknown',
          type: '',
        },
        {
          headers: {
            'Cache-Control': 'private, no-store',
            'Content-Type': 'application/json; charset=utf-8',
            'X-Content-Type-Options': 'nosniff',
          },
        },
      )
    }

    const target = upstreamURL(request, env)
    if (!target) return env.ASSETS.fetch(request)
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 })
    if (!env.PROBE_TOKEN) {
      return new Response('Probe access secret is not configured', { status: 503 })
    }

    const cacheKey = probeCacheKey(request)
    if (cacheKey) {
      const cached = await edgeCache().match(cacheKey)
      if (cached) return clientResponse(cached, 'HIT')
    }

    if (incoming.pathname === '/api/stream') {
      try {
        const hubResponse = await hubStub(env).fetch(new Request('https://probe-hub.internal/stream', {
          method: 'GET',
          headers: request.headers,
        }))
        if (hubResponse.status === 101 && hubResponse.webSocket) return hubResponse
        console.warn(`ProbeHub stream returned ${hubResponse.status}; using direct upstream`)
      } catch (error) {
        console.error('ProbeHub stream unavailable; using direct upstream', error)
      }
      return directUpstream(request, env, target)
    }

    let upstream: Response
    let source: 'hub' | 'origin-fallback' | 'origin' = 'origin'
    if (cacheKey) {
      try {
        upstream = await hubStub(env).fetch('https://probe-hub.internal/snapshot')
        if (!upstream.ok) throw new Error(`ProbeHub snapshot returned ${upstream.status}`)
        source = 'hub'
      } catch (error) {
        console.error('ProbeHub snapshot unavailable; using direct upstream', error)
        upstream = await directUpstream(request, env, target)
        source = 'origin-fallback'
      }
    } else {
      upstream = await directUpstream(request, env, target)
    }

    // WebSocket 的 101 Response 必须原样返回，不能重新构造 body/headers。
    if (upstream.status === 101 || upstream.webSocket) return upstream
    const response = sanitizedResponse(upstream)

    if (cacheKey && upstream.ok) {
      const cacheCopy = response.clone()
      const cacheHeaders = new Headers(cacheCopy.headers)
      cacheHeaders.set('Cache-Control', `public, max-age=${PROBE_CACHE_TTL_SECONDS}`)
      cacheHeaders.set('X-Probe-Source', source)
      ctx.waitUntil(edgeCache().put(cacheKey, new Response(cacheCopy.body, {
        status: cacheCopy.status,
        statusText: cacheCopy.statusText,
        headers: cacheHeaders,
      })))
      return clientResponse(response, 'MISS', source)
    }

    return clientResponse(response, 'BYPASS', source)
  },
} satisfies ExportedHandler<Env>
