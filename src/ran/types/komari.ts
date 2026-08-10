/**
 * Komari Probe API types (real shape, observed from live panel).
 *
 * Two record shapes coexist:
 *  - Nested (raw, from /api/clients WS): cpu.usage, ram.used, network.up...
 *  - Flat (after normalization): cpu, memory_used, network_tx...
 *
 * We always normalize to flat shape for components.
 */

export type NodeStatus = 'good' | 'warn' | 'bad'

export interface NodeReturnRoute {
  carrier: 'telecom' | 'unicom' | 'mobile'
  region?: string
  route_type: string
  tested_at?: string
}

/** /api/nodes — node metadata */
export interface KomariNode {
  uuid: string
  name?: string
  /** OS string from agent boot */
  os?: string
  cpu_name?: string
  cpu_model?: string
  cpu_cores?: number
  cpu_threads?: number
  kernel?: string
  arch?: string
  ip?: string
  region?: string
  region_country?: string
  region_name?: string
  region_city?: string
  group?: string
  /** Bandwidth/traffic labels: "1Gbps<green>;5T<blue>" */
  tags?: string
  /** ISO date — node expiry */
  expired_at?: string
  price?: number
  /**
   * Billing cycle in **days** (Komari quirk: numeric, not "monthly"/"yearly"):
   * 30=月, 90=季, 180=半年, 365=年, 1095=三年, -1=免费机.
   * The API surface is sometimes stringified, so we accept both.
   */
  billing_cycle?: number | string
  /** Currency symbol — e.g. "$", "¥", "€". From Komari node settings. */
  currency?: string
  /**
   * Traffic threshold in **bytes** (Komari 1.2.6+, admin "流量阈值" field).
   * 0 (or absent) means unlimited — Komari's own UI disables the traffic
   * progress bar in that case, and so do we.
   */
  traffic_limit?: number
  /** Total traffic usage supplied by mmwx when cumulative TX/RX are not split. */
  traffic_used?: number
  /** Actual traffic split for the current reset/billing period. */
  traffic_used_up?: number
  traffic_used_down?: number
  traffic_used_total?: number
  /** Current reset period, start inclusive and end exclusive. */
  period_start?: string
  period_end?: string
  /**
   * How usage is measured against `traffic_limit`:
   *   'max' (取最大) — compare max(up, down) against the limit
   *   'sum' (求和)   — compare up + down against the limit
   */
  traffic_limit_type?: 'max' | 'sum' | string
  /** VPS / hosting provider name — Hetzner, Vultr, OVH, etc. May not be in Komari yet. */
  provider?: string
  provider_url?: string
  telecom_paid_peer?: boolean
  return_routes?: NodeReturnRoute[]
  daily_traffic?: Array<{
    date: string
    uplink: number
    downlink: number
    total: number
  }>
  weight?: number
  /** When true, node is hidden from anonymous viewers */
  hidden?: boolean
  /** Country code; sometimes present, sometimes derived from region */
  flag?: string
}

/** Raw nested record from Komari WebSocket /api/clients */
export interface KomariRecordRaw {
  cpu?: { usage?: number }
  ram?: { used?: number; total?: number }
  swap?: { used?: number; total?: number }
  disk?: { used?: number; total?: number }
  network?: { up?: number; down?: number; totalUp?: number; totalDown?: number }
  connections?: { tcp?: number; udp?: number }
  load?: { load1?: number; load5?: number; load15?: number }
  uptime?: number
  process?: number
  os?: string
  cpu_model?: string
  message?: string
  updated_at?: string
}

/** Normalized flat record — what components consume */
export interface KomariRecord {
  uuid: string
  online: boolean
  /** CPU usage percent 0..100 */
  cpu?: number
  memory_used?: number
  memory_total?: number
  swap_used?: number
  swap_total?: number
  disk_used?: number
  disk_total?: number
  /** Bytes per second, instantaneous */
  network_tx?: number
  network_rx?: number
  /** Cumulative bytes since boot — resets on reboot */
  network_total_up?: number
  network_total_down?: number
  /** Current billing-period traffic used (up/down), bytes */
  traffic_period_up?: number
  traffic_period_down?: number
  tcp?: number
  udp?: number
  load1?: number
  load5?: number
  load15?: number
  uptime?: number
  process?: number
  os?: string
  cpu_model?: string
  message?: string
  updated_at?: string
  /** Recent ping ms (from /api/records/ping) */
  ping?: number
  /** Packet loss percent */
  loss?: number
}

/** /api/public — site config */
export interface KomariPublicConfig {
  site_name?: string
  sitename?: string
  description?: string
  /** Record retention in HOURS (not days). e.g. 720 = 30 days. */
  record_preserve_time?: number
  /** Ping record retention in HOURS. */
  ping_record_preserve_time?: number
  record_enabled?: boolean
  custom_css?: string
  custom_head?: string
  custom_body?: string
  footer_text?: string
  announce_text?: string
  theme?: string
  theme_settings?: Record<string, unknown>
}

export interface KomariMe {
  logged_in?: boolean
  username?: string
}

/** Envelope from WS /api/clients */
export interface KomariWSPayload {
  online?: string[]
  data?: Record<string, KomariRecordRaw | KomariRecord>
}
