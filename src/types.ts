export type ThemeName = 'pixel' | 'flat' | 'anime' | 'glass' | 'lumina' | 'premium' | 'ran' | 'glassmorphism'

export interface ProbeAppearance {
  // theme 是主控下发名，可为任意自定义主题名（探针挂 theme-{name} 类，无对应 CSS 时回退默认）
  theme: string
  color_mode?: 'light' | 'dark' | 'system'
  revision?: string
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
  traffic_limit?: number
  traffic_used_up?: number
  traffic_used_down?: number
  traffic_used_total?: number
  period_start?: string
  period_end?: string
  cumulative_up?: number
  cumulative_down?: number
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
  ping?: ProbePingSeries[]
  expires_at?: string
  renewal_price?: number
  renewal_price_cny?: number
  renewal_cycle?: 'month' | 'quarter' | 'half_year' | 'year'
  renewal_currency?: string
  provider_name?: string
  provider_url?: string
  telecom_paid_peer?: boolean
  return_routes?: ProbeReturnRoute[]
}

export interface ProbeReturnRoute {
  carrier: 'telecom' | 'unicom' | 'mobile'
  region?: string
  route_type: string
  tested_at?: string
}

export interface ProbePayload {
  enabled: boolean
  show_globe?: boolean
  show_daily_trend?: boolean
  show_traffic_hotspots?: boolean
  show_traffic_7d?: boolean
  show_resource_heatmap?: boolean
  show_traffic_quota?: boolean
  show_renewal_timeline?: boolean
  show_health_score?: boolean
  title?: string
  logo?: string
  appearance?: ProbeAppearance
  license_badge?: {
    name?: string
    display_name?: string
  } | Array<{
    name?: string
    display_name?: string
  }>
  servers?: ProbeServer[]
}
