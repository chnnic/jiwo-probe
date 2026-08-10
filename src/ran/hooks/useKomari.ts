import { useEffect, useMemo, useRef, useState } from 'react'
import { useProbe } from '../../use-probe'
import { toMmwxNode, toMmwxPingHistory, toMmwxRecord, uuidFor } from '@/api/mmwx-adapter'
import type { PingHistory } from '@/api/client'
import type { KomariMe, KomariNode, KomariPublicConfig, KomariRecord } from '@/types/komari'

export type ConnStatus = 'connecting' | 'open' | 'closed' | 'error' | 'idle'

interface KomariState {
  nodes: KomariNode[]
  records: Record<string, KomariRecord>
  config: KomariPublicConfig
  me: KomariMe
  conn: ConnStatus
  error: string | null
  ping: PingHistory
  lastUpdate: number | null
  /** Local ping history derived from probe snapshots (avg of all lines per poll).
   *  Komari's metric store has no ping data on MMWX, so we accumulate our own. */
  pingByNode: Record<string, number[]>
  pingLossByNode: Record<string, number[]>
}

// 24h worth of 5s polls — window selector (1H/6H/1D) slices this per window.
const MAX_PING_POINTS = 24 * 60 * 12 // 17280 @ 5s ≈ 24h

export function useKomari(): KomariState {
  const probe = useProbe()
  const [lastUpdate, setLastUpdate] = useState<number | null>(null)

  useEffect(() => {
    if (probe.data) setLastUpdate(Date.now())
  }, [probe.data])

  // Accumulate per-node avg latency / avg loss from each probe snapshot.
  const pingByNodeRef = useRef<Record<string, number[]>>({})
  const pingLossByNodeRef = useRef<Record<string, number[]>>({})
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const servers = probe.data?.enabled === false ? [] : (probe.data?.servers ?? [])
    if (!servers.length) return
    for (const [index, server] of servers.entries()) {
      const uuid = uuidFor(index)
      const lines = server.ping ?? []
      const ms = lines.filter((l) => l.current_ms >= 0).map((l) => l.current_ms)
      const loss = lines.filter((l) => l.loss_pct >= 0).map((l) => l.loss_pct)
      if (ms.length) {
        const avgMs = ms.reduce((a, b) => a + b, 0) / ms.length
        const arr = pingByNodeRef.current[uuid] ?? []
        arr.push(avgMs)
        if (arr.length > MAX_PING_POINTS) arr.shift()
        pingByNodeRef.current[uuid] = arr
      }
      if (loss.length) {
        const avgLoss = loss.reduce((a, b) => a + b, 0) / loss.length
        const arr = pingLossByNodeRef.current[uuid] ?? []
        arr.push(avgLoss)
        if (arr.length > MAX_PING_POINTS) arr.shift()
        pingLossByNodeRef.current[uuid] = arr
      }
    }
    setTick((t) => t + 1)
  }, [probe.data])

  return useMemo(() => {
    const servers = probe.data?.enabled === false ? [] : (probe.data?.servers ?? [])
    const nodes = servers.map(toMmwxNode)
    const records = Object.fromEntries(servers.map((server, index) => [uuidFor(index), toMmwxRecord(server, index)]))
    const config: KomariPublicConfig = {
      site_name: probe.data?.title || 'UTOPIA',
      description: 'MMWX Probe · Ran Interface',
      record_enabled: true,
      record_preserve_time: 24,
      ping_record_preserve_time: 24,
      theme_settings: {
        default_view: 'v2',
        default_theme: 'ran-mist',
        visitor_alert: 'on',
        bps_unit: 'auto',
        version_tag: 'UTOPIA',
      },
    }
    return {
      nodes,
      records,
      config,
      me: { logged_in: false },
      conn: probe.data ? 'open' : probe.error ? 'error' : 'connecting',
      error: probe.error ?? null,
      ping: toMmwxPingHistory(servers),
      lastUpdate,
      pingByNode: pingByNodeRef.current,
      pingLossByNode: pingLossByNodeRef.current,
    }
    // tick 让 ref 变更触发重渲染
  }, [lastUpdate, probe.data, probe.error, tick])
}
