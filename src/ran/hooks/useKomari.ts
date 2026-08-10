import { useEffect, useMemo, useState } from 'react'
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
}

export function useKomari(): KomariState {
  const probe = useProbe()
  const [lastUpdate, setLastUpdate] = useState<number | null>(null)

  useEffect(() => {
    if (probe.data) setLastUpdate(Date.now())
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
    }
  }, [lastUpdate, probe.data, probe.error])
}
