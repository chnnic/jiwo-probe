import type { KomariMe, KomariNode, KomariPublicConfig, KomariWSPayload } from '@/types/komari'

const BOUND_PREVIEW_ORIGIN = 'https://5d7d439f-mmwx-probe.eutopiazen.workers.dev'

/**
 * Resolve API base — defaults to current origin (theme served by Komari).
 * In dev (vite), VITE_KOMARI_BASE can override to point at a real Komari host.
 */
export function apiBase(): string {
  const env = (import.meta as { env?: Record<string, string> }).env?.VITE_KOMARI_BASE
  if (env) return env.replace(/\/+$/, '')
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host.endsWith('.workers.dev') && host.includes('-mmwx-probe.')) {
      return BOUND_PREVIEW_ORIGIN
    }
    return window.location.origin
  }
  return ''
}

export function wsUrl(path: string): string {
  const base = apiBase()
  if (base.startsWith('http')) {
    return base.replace(/^http/, 'ws') + path
  }
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${window.location.host}${path}`
  }
  return path
}

/** Komari wraps responses in {status, message, data}. Unwrap if present. */
async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    credentials: apiBase() === BOUND_PREVIEW_ORIGIN ? 'omit' : 'include',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`)
  const body = await res.json()
  if (body && typeof body === 'object' && 'data' in body) {
    return (body as { data: T }).data
  }
  return body as T
}

export async function fetchNodes(): Promise<KomariNode[]> {
  const data = await getJson<KomariNode[]>('/api/nodes')
  return Array.isArray(data) ? data : []
}

export async function fetchPublic(): Promise<KomariPublicConfig> {
  try {
    return await getJson<KomariPublicConfig>('/api/public')
  } catch {
    return {}
  }
}

/** /api/me — current session info. Komari returns logged_in: false for
 *  anonymous visitors; admins get logged_in: true plus a username. We use
 *  this to gate visibility of hidden-flagged nodes (admins see everything,
 *  visitors see only public nodes). */
export async function fetchMe(): Promise<KomariMe> {
  try {
    return await getJson<KomariMe>('/api/me')
  } catch {
    return { logged_in: false }
  }
}

/** /api/records/ping?hours=N — global ping records across all nodes & tasks */
export interface PingTask {
  id: number
  name: string
  interval: number
  /** Loss percent (0..100) computed by backend across the queried window. */
  loss: number
  /** Average latency ms across the queried window (when available). */
  avg?: number
  /** Min/max latency ms across the queried window (when available). */
  min?: number
  max?: number
  /** Total samples in the queried window (when available). */
  total?: number
  /** Probe type: usually 'icmp' or 'tcp'. */
  type?: string
  /** ISP label supplied by the MMWX probe target. */
  isp?: string
}

export interface PingRecord {
  task_id: number
  /** ISO 8601 timestamp */
  time: string
  /** Latency in ms */
  value: number
  /** Bucket loss percentage; null means the bucket has no data. */
  loss?: number | null
  /** Optional uuid — present when fetched without uuid filter */
  client?: string
}

export interface PingHistory {
  count: number
  tasks: PingTask[]
  records: PingRecord[]
}

export interface MmwxPingSeries {
  key?: string
  label: string
  isp?: string
  current_ms: number
  loss_pct: number
  buckets: Array<{ ms: number; loss: number }>
}

interface MmwxMetricPoint {
  t: number
  value: number
}

interface MmwxSystemSeries {
  cpu_pct?: MmwxMetricPoint[]
  mem_used?: MmwxMetricPoint[]
  mem_total?: MmwxMetricPoint[]
  upload_speed?: MmwxMetricPoint[]
  download_speed?: MmwxMetricPoint[]
  cumulative_up?: MmwxMetricPoint[]
  cumulative_down?: MmwxMetricPoint[]
}

export async function fetchPingHistory(hours = 1): Promise<PingHistory> {
  try {
    return await getJson<PingHistory>(`/api/records/ping?hours=${hours}`)
  } catch {
    return { count: 0, tasks: [], records: [] }
  }
}

/** Per-node ping history — pings for one specific probe over `hours`. */
export async function fetchNodePingHistory(uuid: string, hours = 1): Promise<PingHistory> {
  if (uuid.startsWith('mmwx-')) {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('ui')?.includes('snapshot')) {
      return { count: 0, tasks: [], records: [] }
    }
    const server = Number(uuid.slice('mmwx-'.length))
    if (!Number.isInteger(server) || server < 0) return { count: 0, tasks: [], records: [] }
    const range = hours <= 1 ? '1h' : hours <= 6 ? '6h' : '24h'
    try {
      const payload = await getJson<{
        success?: boolean
        generated_at?: number
        bucket_sec?: number
        series?: MmwxPingSeries
        all_series?: MmwxPingSeries[]
      }>(`/api/series?server=${server}&range=${range}&all=1`)
      if (!payload.success) return { count: 0, tasks: [], records: [] }
      const source = payload.all_series?.length ? payload.all_series : payload.series ? [payload.series] : []
      const generatedAt = payload.generated_at ?? Math.floor(Date.now() / 1000)
      const bucketSec = payload.bucket_sec ?? 300
      const tasks: PingTask[] = []
      const records: PingRecord[] = []
      source.forEach((line, lineIndex) => {
        const taskId = lineIndex + 1
        tasks.push({
          id: taskId,
          name: line.label || `线路 ${taskId}`,
          interval: bucketSec,
          loss: line.loss_pct,
          avg: line.current_ms >= 0 ? line.current_ms : undefined,
          isp: line.isp,
        })
        line.buckets.forEach((bucket, bucketIndex) => {
          records.push({
            task_id: taskId,
            time: new Date((generatedAt - (line.buckets.length - 1 - bucketIndex) * bucketSec) * 1000).toISOString(),
            value: bucket.ms,
            loss: bucket.loss < 0 ? null : bucket.loss,
            client: uuid,
          })
        })
      })
      return { count: records.length, tasks, records }
    } catch {
      return { count: 0, tasks: [], records: [] }
    }
  }
  try {
    return await getJson<PingHistory>(
      `/api/records/ping?uuid=${encodeURIComponent(uuid)}&hours=${hours}`,
    )
  } catch {
    return { count: 0, tasks: [], records: [] }
  }
}

/** /api/records/load?uuid=…&hours=N — flat per-node load history.
 * Each record carries cpu / ram / disk as percent (0..100), bytes for net totals. */
export interface LoadRecord {
  /** ISO 8601 */
  time: string
  cpu?: number
  ram?: number
  ram_total?: number
  disk?: number
  disk_total?: number
  swap?: number
  swap_total?: number
  load?: number
  net_in?: number
  net_out?: number
  net_total_up?: number
  net_total_down?: number
  process?: number
  connections?: number
  connections_udp?: number
}

export interface LoadHistory {
  count: number
  records: LoadRecord[]
}

export async function fetchNodeLoadHistory(uuid: string, hours = 1): Promise<LoadHistory> {
  if (uuid.startsWith('mmwx-')) {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('ui')?.includes('snapshot')) {
      return { count: 0, records: [] }
    }
    const server = Number(uuid.slice('mmwx-'.length))
    if (!Number.isInteger(server) || server < 0) return { count: 0, records: [] }
    const range = hours <= 1 ? '1h' : hours <= 6 ? '6h' : '24h'
    try {
      const payload = await getJson<{
        success?: boolean
        series?: MmwxSystemSeries
      }>(`/api/series?server=${server}&range=${range}&metric=system`)
      if (!payload.success || !payload.series) return { count: 0, records: [] }

      const byTime = new Map<number, LoadRecord>()
      const apply = (
        points: MmwxMetricPoint[] | undefined,
        key: keyof Omit<LoadRecord, 'time'>,
      ) => {
        for (const point of points ?? []) {
          if (!Number.isFinite(point.t) || !Number.isFinite(point.value)) continue
          const record = byTime.get(point.t) ?? { time: new Date(point.t * 1000).toISOString() }
          record[key] = point.value
          byTime.set(point.t, record)
        }
      }

      apply(payload.series.cpu_pct, 'cpu')
      apply(payload.series.mem_used, 'ram')
      apply(payload.series.mem_total, 'ram_total')
      // MMWX names these from the server's perspective: upload is outbound,
      // download is inbound. Komari's chart model uses net_out / net_in.
      apply(payload.series.upload_speed, 'net_out')
      apply(payload.series.download_speed, 'net_in')
      apply(payload.series.cumulative_up, 'net_total_up')
      apply(payload.series.cumulative_down, 'net_total_down')

      const records = [...byTime.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, record]) => record)
      return { count: records.length, records }
    } catch {
      return { count: 0, records: [] }
    }
  }
  try {
    return await getJson<LoadHistory>(
      `/api/records/load?uuid=${encodeURIComponent(uuid)}&hours=${hours}`,
    )
  } catch {
    return { count: 0, records: [] }
  }
}

export interface LiveSocket {
  close: () => void
}

/**
 * WebSocket /api/clients — sends "get" on open + every second to poll for updates.
 * Komari's WS is request-response style, not streaming, so we have to poll.
 * Reconnects with exponential backoff up to 15s.
 */
export function openLiveSocket(opts: {
  onMessage: (payload: KomariWSPayload) => void
  onStatus?: (s: 'connecting' | 'open' | 'closed' | 'error') => void
}): LiveSocket {
  let ws: WebSocket | null = null
  let closed = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let attempt = 0

  const stopPoll = () => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  const connect = () => {
    if (closed) return
    opts.onStatus?.('connecting')
    try {
      ws = new WebSocket(wsUrl('/api/clients'))
    } catch (err) {
      console.warn('[ran] ws construct failed', err)
      schedule()
      return
    }
    ws.onopen = () => {
      attempt = 0
      opts.onStatus?.('open')
      try {
        ws?.send('get')
      } catch {
        /* ignore */
      }
      // Poll every 1s — Komari WS doesn't push, it replies on demand.
      stopPoll()
      pollTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          try {
            ws.send('get')
          } catch {
            /* ignore */
          }
        }
      }, 1000)
    }
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as { status?: string; data?: KomariWSPayload }
        if (msg?.data) opts.onMessage(msg.data)
      } catch (err) {
        console.warn('[ran] ws parse failed', err)
      }
    }
    ws.onerror = () => opts.onStatus?.('error')
    ws.onclose = () => {
      stopPoll()
      opts.onStatus?.('closed')
      schedule()
    }
  }

  const schedule = () => {
    if (closed) return
    attempt++
    const delay = Math.min(1000 * 2 ** Math.min(attempt, 4), 15000)
    timer = setTimeout(connect, delay)
  }

  connect()

  return {
    close: () => {
      closed = true
      stopPoll()
      if (timer) clearTimeout(timer)
      ws?.close()
    },
  }
}
