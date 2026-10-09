export type ThemeName = 'pixel' | 'flat' | 'anime' | 'glass' | 'lumina' | 'premium' | 'ran' | 'glassmorphism' | 'emerald' | 'lite' | 'luminaplus'

export interface ProbeBackgroundAppearance {
  url: string
  /** 0 = 原图，1 = 完全被主题底色覆盖。 */
  overlay?: number
  /** CSS background-position，默认 center。 */
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right'
  /** all 或逗号分隔后得到的主题名；省略时应用到全部主题。 */
  themes?: string[]
}

export interface ProbeAppearance {
  theme: ThemeName
  color_mode?: 'light' | 'dark' | 'system'
  revision?: string
  background?: ProbeBackgroundAppearance
}

export interface ProbeBucket {
  ms: number
  loss: number
}

export interface ProbePingSeries {
  key?: string
  label: string
  isp?: string
  current_ms: number
  loss_pct: number
  buckets: ProbeBucket[]
}

/** 主控连接数近 1 小时：12 个 5 分钟均值，旧到新；null 为缺样。 */
export interface ProbeConnHistory {
  tcp: (number | null)[]
  udp: (number | null)[]
}

export interface ProbeServer {
  name?: string
  region?: string
  region_country?: string
  region_name?: string
  region_city?: string
  online: boolean
  upload_speed?: number
  download_speed?: number
  traffic_used?: number
  traffic_used_up?: number
  traffic_used_down?: number
  traffic_used_total?: number
  traffic_limit?: number
  traffic_source?: 'xray' | 'system'
  traffic_stats_mode?: 'both' | 'upload' | 'download' | 'max'
  traffic_adjustment?: number
  traffic_used_scope?: 'configured_period' | 'counter_since_reset' | string
  traffic_used_estimated?: boolean
  period_start?: string
  period_end?: string
  daily_traffic_scope?:
    | 'configured_period_and_recent_7d'
    | 'recent_7d'
    | string
  daily_traffic_start?: string
  daily_traffic_end?: string
  daily_traffic_estimated?: boolean
  boot_traffic_up?: number
  boot_traffic_down?: number
  boot_traffic_scope?: 'current_boot' | string
  cumulative_up?: number
  cumulative_down?: number
  cumulative_traffic_scope?: 'current_boot' | string
  daily_traffic?: Array<{
    date: string
    uplink: number
    downlink: number
    total: number
  }>
  cpu_pct?: number
  loadavg?: string
  mem_used?: number
  mem_total?: number
  disk_used?: number
  disk_total?: number
  uptime?: number
  cpu_model?: string
  cpu_cores?: number
  cpu_threads?: number
  os?: string
  kernel?: string
  arch?: string
  /** 整机 TCP ESTABLISHED 连接数，不等于代理用户数。 */
  tcp_connections?: number
  /** 整机 UDP socket 数。 */
  udp_connections?: number
  /** 主控关闭连接数折线图时不下发此字段。 */
  conn_history?: ProbeConnHistory
  unlocks?: ProbeUnlock[]
  ping?: ProbePingSeries[]
  expires_at?: string
  renewal_price?: number
  renewal_price_cny?: number
  renewal_cycle?: 'month' | 'quarter' | 'half_year' | 'year' | 'two_year' | 'three_year' | 'permanent'
  renewal_currency?: string
  provider_name?: string
  provider_url?: string
  telecom_paid_peer?: boolean
  return_routes?: ProbeReturnRoute[]
}

export interface ProbeUnlock {
  service: string
  status: string
  region?: string
  tested_at?: string
}

export interface ProbeReturnRoute {
  carrier: 'telecom' | 'unicom' | 'mobile'
  region?: string
  route_type: string
  tested_at?: string
}

export interface ProbePayload {
  enabled: boolean
  block_login?: boolean
  show_name?: boolean
  show_globe?: boolean
  show_forward?: boolean
  show_daily_trend?: boolean
  show_traffic_hotspots?: boolean
  show_traffic_7d?: boolean
  show_resource_heatmap?: boolean
  show_traffic_quota?: boolean
  show_renewal_timeline?: boolean
  show_health_score?: boolean
  /** Controller history retention in days (1–7); absent on older controllers. */
  history_days?: number
  title?: string
  logo?: string
  icon?: string
  appearance?: ProbeAppearance
  license_badge?: {
    name?: string
    display_name?: string
  } | Array<{
    name?: string
    display_name?: string
  }>
  forward?: ForwardChainData[]
  servers?: ProbeServer[]
}

export interface ForwardChainServerData {
  name: string
  to_next_ms: number
  healthy: boolean
  /** 主控 v0.5.6-beta.4 起：本台到下一跳的丢包率 */
  loss_pct?: number
  /** 选路段分叉组成员当前走的路名（如「路1」） */
  route?: string
}

export interface ForwardChainGroupData {
  name: string
  role: 'entry' | 'mid' | 'exit'
  to_next_ms: number
  /** 主控 v0.5.6-beta.4 起 */
  loss_pct?: number
  servers: ForwardChainServerData[]
}

/** 选路段里的一条路（主控 v0.5.6-beta.4 起，#1136）。via 为绕经的中转组名，空数组表示直连下一组。 */
export interface ForwardChainRoute {
  name: string
  via: string[]
  latency_ms: number
  loss_pct: number
  selected: boolean
  /** 当前走这条路的分叉组成员 */
  selected_by?: string[]
}

export interface ForwardChainBucket {
  ts: number
  e2e_ms: number
  loss: number
}

export interface ForwardTrafficServer {
  name: string
  group: string
  role: string
  daily_gb: number[]
  total_gb: number
}

export interface ForwardChainTraffic {
  days: string[]
  servers: ForwardTrafficServer[]
  total_gb: number
}

export interface ForwardChainData {
  name: string
  end_to_end_ms: number
  loss_pct: number
  groups: ForwardChainGroupData[]
  bucket_sec: number
  trend: ForwardChainBucket[]
  traffic?: ForwardChainTraffic | null
  /** 选路段：groups[route_hop] 之后分叉成 routes，汇合到 groups[route_hop + 1] */
  route_hop?: number
  route_policy?: string
  failover_ms?: number
  routes?: ForwardChainRoute[]
  /** 主控 v0.5.6-beta.6 起：入口在这条链上的实时上行 / 下行（byte/s） */
  speed_up?: number
  speed_down?: number
  /** 主控 v0.5.6-beta.6 起：近 24 小时可用率（0–1）；这条链没有历史时为 null */
  availability_24h?: number | null
  /** 主控 v0.5.6-beta.6 起：近 24 小时状态条，72 个字符、20 分钟一格（o 正常、d 降级、b 中断、n 无数据） */
  cells?: string
  /** 主控 v0.5.6-beta.6 起：最近一次采样的端到端抖动（ms）；超过 2 分钟没采到为 null */
  jitter_ms?: number | null
}
