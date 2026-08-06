export type ThemeName = 'pixel' | 'flat' | 'anime' | 'glass'

export interface ProbeAppearance {
  theme: ThemeName
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
