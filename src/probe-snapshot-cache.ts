import type { ProbePayload } from './types'

// 回访秒开：把最近一帧快照存进 IndexedDB，下次打开先显示它，实时数据到了立刻替换。
// 快照约 700 KB，放 localStorage 会同步阻塞主线程，也容易撑满配额。
// 这里存的就是公开探针接口返回给访客的数据，不含额外信息；任何一步失败都只是退回到等待实时数据。
const DB_NAME = 'jiwo-probe'
const STORE_NAME = 'snapshot'
const RECORD_KEY = 'latest'

export const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000
export const SNAPSHOT_WRITE_INTERVAL_MS = 60_000

export interface CachedProbeSnapshot {
  payload: ProbePayload
  savedAt: number
}

/** 校验存储记录并还原成可显示的快照；过期或损坏时返回 undefined。 */
export function parseCachedSnapshot(record: unknown, now: number): CachedProbeSnapshot | undefined {
  const { savedAt, json } = (record ?? {}) as { savedAt?: unknown; json?: unknown }
  if (typeof savedAt !== 'number' || typeof json !== 'string') return undefined
  if (savedAt > now || now - savedAt > SNAPSHOT_MAX_AGE_MS) return undefined
  try {
    const payload = JSON.parse(json) as ProbePayload
    return staleSnapshot(payload, savedAt)
  } catch {
    return undefined
  }
}

/** 把一份过去的数据整理成可显示的快照（IndexedDB 记录和 Worker 冷启动给的旧快照共用）。 */
export function staleSnapshot(payload: ProbePayload | null | undefined, savedAt: number): CachedProbeSnapshot | undefined {
  if (!payload || !Array.isArray(payload.servers)) return undefined
  // 实时网速不能隔着时间显示，否则还会被算进「本页打开后」的网速曲线和峰值。
  return { savedAt, payload: { ...payload, servers: payload.servers.map((server) => ({ ...server, upload_speed: 0, download_speed: 0 })) } }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('IndexedDB blocked'))
  })
}

export async function readProbeSnapshot(): Promise<CachedProbeSnapshot | undefined> {
  try {
    const database = await openDatabase()
    const record = await new Promise<unknown>((resolve, reject) => {
      const request = database.transaction(STORE_NAME).objectStore(STORE_NAME).get(RECORD_KEY)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    database.close()
    return parseCachedSnapshot(record, Date.now())
  } catch {
    return undefined
  }
}

let lastWriteAt = 0

/** 收到实时帧时调用：最多每分钟写一次，并且放到空闲时做，不和渲染抢主线程。 */
export function rememberProbeSnapshot(payload: ProbePayload): void {
  const now = Date.now()
  if (now - lastWriteAt < SNAPSHOT_WRITE_INTERVAL_MS) return
  lastWriteAt = now
  const write = async () => {
    try {
      const json = JSON.stringify(payload)
      const database = await openDatabase()
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put({ savedAt: now, json }, RECORD_KEY)
      transaction.oncomplete = transaction.onerror = transaction.onabort = () => database.close()
    } catch {
      // 隐私模式或配额不足时不缓存，下次打开照常等实时数据。
    }
  }
  if ('requestIdleCallback' in window) window.requestIdleCallback(() => void write(), { timeout: 3000 })
  else setTimeout(() => void write(), 500)
}
