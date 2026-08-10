import { useEffect, useRef, useState } from 'react'

/**
 * VisitorInfo — 从本站 Worker 获取 Cloudflare 已附带的访客网络信息。
 *
 * 请求保持同源，不会把访客 IP 或位置转交给额外的第三方服务。
 * Cloudflare 不提供代理风险评分，所以该字段明确保持未评分状态。
 */

export interface VisitorInfo {
  ip: string
  city?: string
  region?: string
  country?: string
  isp?: string
  lat?: number
  lon?: number
  /** 风险评分 0-100；本站未接入评分服务时为 null。 */
  risk: number | null
  /** VPN/proxy 判定；本站未接入评分服务时为 unknown。 */
  proxy: 'yes' | 'no' | 'unknown'
  /** 链路类型(VPN/Tor/Hosting...);无信息时空串 */
  type?: string
}

interface State {
  data: VisitorInfo | null
  loading: boolean
  error: boolean
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController()
  const tid = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { signal: ctrl.signal })
  } finally {
    clearTimeout(tid)
  }
}

async function fetchVisitorInfo(): Promise<VisitorInfo> {
  const response = await fetchWithTimeout('/api/visitor', 5000)
  if (!response.ok) throw new Error(`visitor info: HTTP ${response.status}`)
  const data = await response.json() as Partial<VisitorInfo>
  return {
    ...data,
    ip: data.ip || 'UNKNOWN',
    risk: typeof data.risk === 'number' ? data.risk : null,
    proxy: data.proxy === 'yes' || data.proxy === 'no' ? data.proxy : 'unknown',
    type: data.type || '',
  }
}

/**
 * useVisitorInfo — 执行一次访客信息查询。
 * `enabled=false` 时完全不发请求(用于"会话内已弹过 → 不再获取"的场景)。
 */
export function useVisitorInfo(enabled: boolean): State {
  const [state, setState] = useState<State>({ data: null, loading: enabled, error: false })
  const cancelled = useRef(false)

  useEffect(() => {
    if (!enabled) return
    cancelled.current = false

    ;(async () => {
      try {
        const data = await fetchVisitorInfo()
        if (cancelled.current) return
        setState({ data, loading: false, error: data.ip === 'UNKNOWN' })
      } catch {
        if (cancelled.current) return
        setState({ data: null, loading: false, error: true })
      }
    })()

    return () => {
      cancelled.current = true
    }
  }, [enabled])

  return state
}

