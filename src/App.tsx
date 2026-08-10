import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Lottie from 'lottie-react'
import { Activity, ArrowDown, ArrowDownUp, ArrowUp, BadgeDollarSign, Calendar, CalendarClock, Check, CheckCircle2, ChevronDown, ChevronUp, CircleDollarSign, Clock, Clock3, Cpu, Database, Gauge, Globe2, HardDrive, LayoutGrid, List, MapPin, MemoryStick, Monitor, Moon, MoveHorizontal, Palette, PieChart, RefreshCw, Rows3, Rows4, Search, Server, Sun, TrendingUp, Trophy, Unplug, Wallet, Wifi, XCircle, ZoomIn, ZoomOut } from 'lucide-react'
import { siAlmalinux, siAlpinelinux, siApple, siArchlinux, siCentos, siDebian, siFedora, siFreebsd, siGentoo, siKalilinux, siLinux, siLinuxmint, siNixos, siOpensuse, siProxmox, siRedhat, siRockylinux, siUbuntu } from 'simple-icons'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ProbeBucket, ProbePingSeries, ProbeReturnRoute, ProbeServer, ThemeName } from './types'
import { getActiveTheme, getDarkOverride, getThemeOverride, setDarkOverride, setTheme, useProbe } from './use-probe'
import { Twemoji } from './Twemoji'
import { ServerDetail } from './ServerDetail'
import { computeRemainingValue, formatMoney } from './value'
import commonRouteAnimation from './assets/return-route/common.json'
import premiumRouteAnimation from './assets/return-route/premium.json'

const colors = ['#8b5cf6', '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#ec4899']
const RegionGlobe = lazy(() => import('./RegionGlobe').then((module) => ({ default: module.RegionGlobe })))
const ranges = [
  {
    key: '1h',
    label: '1 小时',
    bucketLabel: (index: number, count: number) => `-${(count - index) * 5}m`,
  },
  {
    key: '6h',
    label: '6 小时',
    bucketLabel: (index: number, count: number) => `-${(((count - index) * 10) / 60).toFixed(1)}h`,
  },
  {
    key: '24h',
    label: '24 小时',
    bucketLabel: (index: number, count: number) => `-${(((count - index) * 30) / 60).toFixed(0)}h`,
  },
] as const
type RangeKey = (typeof ranges)[number]['key']

export function formatAxisDateTime(unixSeconds: number, showMinutes = true): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    ...(showMinutes ? { minute: '2-digit' } : {}),
    hour12: false,
  }).format(new Date(unixSeconds * 1000))
}

export function HorizontalChart({ children, width }: { children: React.ReactNode; width: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; left: number } | null>(null)
  return (
    <div className="chart-scroll-frame">
      <div className="chart-fixed-y-axis" aria-hidden="true">
        <div className="chart-scroll-inner" style={{ width, minWidth: '100%' }}>
          {children}
        </div>
      </div>
      <div
        ref={ref}
        className="chart-scroll"
        style={{ touchAction: 'pan-x pan-y' }}
        onPointerDown={(e) => {
          if (e.pointerType !== 'mouse' || !ref.current) return
          drag.current = { x: e.clientX, left: ref.current.scrollLeft }
          ref.current.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (drag.current && ref.current)
            ref.current.scrollLeft = drag.current.left - (e.clientX - drag.current.x)
        }}
        onPointerUp={(e) => {
          drag.current = null
          ref.current?.releasePointerCapture(e.pointerId)
        }}
        onPointerCancel={() => {
          drag.current = null
        }}
      >
        <div className="chart-scroll-inner" style={{ width, minWidth: '100%' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

export function bytes(value = 0, decimal = true): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let n = Math.max(0, value)
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  if (i === 4) {
    return `${Math.abs(n - Math.round(n)) < 1e-9 ? n.toFixed(0) : n.toFixed(2)} ${units[i]}`
  }
  // 整数不标 .0 (如 1000 GB 而非 1000.0 GB, 含 toFixed 后恰为 X.0 的值)
  let out = n.toFixed(decimal && i >= 2 ? 1 : 0)
  if (out.endsWith('.0')) out = out.slice(0, -2)
  return `${out} ${units[i]}`
}

export function speed(value = 0): string {
  return `${bytes(value)}/s`
}
function bitSpeed(bytesPerSecond = 0): string {
  let value = Math.max(0, bytesPerSecond) * 8
  const units = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps']
  let unit = 0
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000
    unit++
  }
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(digits)} ${units[unit]}`
}
function speedScale(bytesPerSecond: number): {
  percent: number
  label: string
} {
  const bps = Math.max(0, bytesPerSecond) * 8
  const steps = [1e6, 10e6, 100e6, 1e9, 10e9, 100e9, 1e12]
  const ceiling = steps.find((value) => bps <= value) || steps[steps.length - 1]
  return {
    percent: Math.min(100, (bps / ceiling) * 100),
    label: bitSpeed(ceiling / 8),
  }
}
const cycleLabel = {
  month: '月',
  quarter: '季',
  half_year: '半年',
  year: '年',
} as const
export function expiring(server: ProbeServer): boolean {
  if (!server.expires_at) return false
  const days = (new Date(`${server.expires_at}T23:59:59`).getTime() - Date.now()) / 86400000
  return days >= 0 && days <= 30
}
export function expired(server: ProbeServer): boolean {
  return !!server.expires_at && new Date(`${server.expires_at}T23:59:59`).getTime() < Date.now()
}
export function remainingDays(value?: string): string {
  if (!value) return ''
  const days = Math.ceil((new Date(`${value}T23:59:59`).getTime() - Date.now()) / 86400000)
  if (days < 0) return `已过期 ${Math.abs(days)} 天`
  if (days === 0) return '今天到期'
  return `剩余 ${days} 天`
}
export function regionFlag(region?: string): string {
  const points = [...(region?.trim() || '')].map((char) => char.codePointAt(0) || 0)
  if (points.length === 2 && points.every((point) => point >= 0x1f1e6 && point <= 0x1f1ff)) return region!.trim()
  const country = region
    ?.trim()
    .split(/[·,\s]+/)[0]
    ?.toUpperCase()
  if (!country || !/^[A-Z]{2}$/.test(country)) return ''
  return String.fromCodePoint(...[...country].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65))
}
export function hasLeadingFlag(value: string): boolean {
  return /^\p{Regional_Indicator}{2}/u.test(value.trim())
}
export function regionLabel(server: ProbeServer): string {
  const city = server.region_city?.trim()
  const area = server.region_name?.trim()
  const country = server.region_country?.trim()
  if (!city && !area) return ''
  return [city, area].filter(Boolean).join(' · ')
}
export function regionCountryLabel(server: ProbeServer): string {
  return server.region_country?.trim() || ''
}

function RegionSelect({ regions, value, onChange }: { regions: string[]; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const wrapRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])
  const toggle = useCallback(() => {
    if (!open && wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect()
      const estHeight = Math.min(320, regions.length * 29 + 10)
      let top = rect.bottom + 5
      if (top + estHeight > window.innerHeight - 8 && rect.top - estHeight - 5 > 0) {
        top = rect.top - estHeight - 5
      }
      setPos({ top, left: rect.left, width: rect.width })
    }
    setOpen((v) => !v)
  }, [open, regions.length])

  useEffect(() => {
    if (!open) return
    const handle = (event: MouseEvent) => {
      if (wrapRef.current?.contains(event.target as Node)) return
      if (menuRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', handle)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open, close])

  const selected = value === 'all' ? null : value
  return (
    <div className="region-select" ref={wrapRef}>
      <button type="button" className="region-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={toggle}>
        <MapPin size={14} />
        <span className="region-trigger-value">
          <Twemoji>{selected || '🌍'}</Twemoji>
          <em>{selected ? '所选地区' : '全部地区'}</em>
        </span>
        <ChevronDown size={13} className={open ? 'rotated' : ''} />
      </button>
      {open &&
        createPortal(
          <div className="region-menu" ref={menuRef} style={{ top: pos.top, left: pos.left, minWidth: pos.width }} role="listbox">
            <button type="button" role="option" aria-selected={value === 'all'} onClick={() => { onChange('all'); setOpen(false) }}>
              <Twemoji>🌍</Twemoji>
              <span>全部地区</span>
            </button>
            {regions.map((item) => (
              <button type="button" role="option" aria-selected={value === item} key={item} onClick={() => { onChange(item); setOpen(false) }}>
                <Twemoji>{item}</Twemoji>
                <span>{item}</span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}

const THEME_OPTIONS: { value: ThemeName; label: string }[] = [
  { value: 'pixel', label: '像素' },
  { value: 'flat', label: '扁平' },
  { value: 'anime', label: '动漫' },
  { value: 'glass', label: '玻璃' },
  { value: 'lumina', label: 'Lumina' },
]

function ThemeSelect({ value, onChange }: { value: ThemeName | null; onChange: (name: ThemeName | null) => void }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const wrapRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])
  const toggle = useCallback(() => {
    if (!open && wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect()
      const estHeight = Math.min(320, (THEME_OPTIONS.length + 1) * 29 + 10)
      let top = rect.bottom + 5
      if (top + estHeight > window.innerHeight - 8 && rect.top - estHeight - 5 > 0) {
        top = rect.top - estHeight - 5
      }
      setPos({ top, left: rect.left, width: rect.width })
    }
    setOpen((v) => !v)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handle = (event: MouseEvent) => {
      if (wrapRef.current?.contains(event.target as Node)) return
      if (menuRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', handle)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open, close])

  const selectedLabel = value ? THEME_OPTIONS.find((opt) => opt.value === value)?.label || value : '跟随主控'
  return (
    <div className="theme-select" ref={wrapRef}>
      <button
        type="button"
        className="theme-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="切换主题"
        title={`主题: ${selectedLabel}`}
        onClick={toggle}
      >
        <Palette size={18} />
        <ChevronDown size={13} className={open ? 'rotated' : ''} />
      </button>
      {open &&
        createPortal(
          <div className="region-menu theme-menu" ref={menuRef} style={{ top: pos.top, left: pos.left }} role="listbox">
            <button type="button" role="option" aria-selected={value === null} onClick={() => { onChange(null); setOpen(false) }}>
              <span>跟随主控</span>
              {value === null && <Check size={14} className="theme-menu-check" />}
            </button>
            {THEME_OPTIONS.map((opt) => (
              <button type="button" role="option" aria-selected={value === opt.value} key={opt.value} onClick={() => { onChange(opt.value); setOpen(false) }}>
                <span>{opt.label}</span>
                {value === opt.value && <Check size={14} className="theme-menu-check" />}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}

function SpeedSummary({ label, value, direction }: { label: string; value: number; direction: 'up' | 'down' }) {
  const scale = speedScale(value)
  return (
    <div className={`speed-summary ${direction}`}>
      <div>
        <span>
          {direction === 'up' ? <ArrowUp size={19} /> : <ArrowDown size={19} />}
          {label}
        </span>
        <strong>{bitSpeed(value)}</strong>
      </div>
      <div className="speed-progress">
        <i style={{ width: `${scale.percent}%` }} />
        <small>{scale.label}</small>
      </div>
    </div>
  )
}

function AssetsSummary({ servers }: { servers: ProbeServer[] }) {
  const stats = useMemo(() => {
    let totalValue = 0
    let totalMonthly = 0
    let priced = 0
    for (const server of servers) {
      const rv = computeRemainingValue(server)
      if (!rv) continue
      priced++
      totalValue += rv.value
      totalMonthly += rv.daily * 30
    }
    return { totalValue, totalMonthly, priced }
  }, [servers])
  if (stats.priced === 0) return null
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('probe-summary-assets') === '1')
  const toggle = () => {
    setCollapsed((value) => {
      const next = !value
      localStorage.setItem('probe-summary-assets', next ? '1' : '0')
      return next
    })
  }
  return (
    <article className={`summary-card collapse-card${collapsed ? ' collapsed' : ' open'}`}>
      <button
        className="summary-toggle"
        type="button"
        aria-expanded={!collapsed}
        aria-label={collapsed ? '展开资产总揽' : '折叠资产总揽'}
        onClick={toggle}
      >
        <span>
          <BadgeDollarSign size={18} />
          资产总揽
        </span>
        <span className="summary-toggle-info">
          {collapsed && (
            <>
              <b>{formatMoney(stats.totalValue, 'CNY', true)}</b>
              <em>月均 {formatMoney(stats.totalMonthly, 'CNY', true)}</em>
            </>
          )}
          <ChevronDown size={17} />
        </span>
      </button>
      {!collapsed && (
        <div className="collapse-body">
          <div className="assets-stats">
            <div className="assets-main">
              <span>总剩余价值</span>
              <strong>{formatMoney(stats.totalValue, 'CNY', true)}</strong>
            </div>
            <div className="assets-sub">
              <span>
                月均成本 <b>{formatMoney(stats.totalMonthly, 'CNY', true)}</b>
              </span>
              <span>
                覆盖 <b>{stats.priced}</b> / {servers.length} 台
              </span>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}
export function pct(used = 0, total = 0): number {
  return total > 0 ? Math.min(100, (used * 100) / total) : 0
}

export function Meter({ icon, label, value, percent }: { icon: React.ReactNode; label: string; value: string; percent: number }) {
  return (
    <div className="metric">
      <div className="metric-head">
        <span>
          {icon}
          {label}
        </span>
        <strong>{value}</strong>
      </div>
      <div className="meter">
        <i style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
      </div>
    </div>
  )
}

export function averagePing(series: ProbePingSeries[]): ProbePingSeries {
  const count = series[0]?.buckets.length || 0
  const buckets: ProbeBucket[] = Array.from({ length: count }, (_, index) => {
    const values = series.map((item) => item.buckets[index]).filter(Boolean)
    const ms = values.filter((v) => v.ms >= 0).map((v) => v.ms)
    const loss = values.filter((v) => v.loss >= 0).map((v) => v.loss)
    return {
      ms: ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : -1,
      loss: loss.length ? loss.reduce((a, b) => a + b, 0) / loss.length : -1,
    }
  })
  const current = series.filter((item) => item.current_ms >= 0).map((item) => item.current_ms)
  return {
    key: '__avg__',
    label: '平均',
    current_ms: current.length ? current.reduce((a, b) => a + b, 0) / current.length : -1,
    loss_pct: series.length ? series.reduce((sum, item) => sum + item.loss_pct, 0) / series.length : 0,
    buckets,
  }
}

type LeaderboardKey = 'cpu' | 'mem' | 'disk' | 'load' | 'traffic' | 'usage' | 'speed' | 'uptime' | 'today' | 'week' | 'loss-cn' | 'loss-idc' | 'cost' | 'expiry' | 'ping-cn' | 'ping-idc'

const isCnLabel = (label: string) => /电信|联通|移动/.test(label)

function groupedPingAvg(ping: ProbePingSeries[], cn: boolean): number {
  const list = (ping || []).filter((item) => isCnLabel(item.label) === cn)
  const current = list.filter((item) => item.current_ms >= 0).map((item) => item.current_ms)
  return current.length ? current.reduce((a, b) => a + b, 0) / current.length : -1
}

const CYCLE_MONTHS: Record<string, number> = { month: 1, quarter: 3, half_year: 6, year: 12 }

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return h > 0 ? `${d}天${h}小时` : `${d}天`
  if (h > 0) return m > 0 ? `${h}小时${m}分` : `${h}小时`
  return `${Math.max(1, m)}分`
}

function monthlyCost(server: ProbeServer): number {
  const price = server.renewal_price_cny ?? server.renewal_price
  if (price === undefined || price === null) return -1
  const months = CYCLE_MONTHS[server.renewal_cycle || 'month'] || 1
  return price / months
}

function todayTraffic(server: ProbeServer): number {
  const daily = server.daily_traffic
  return daily?.length ? daily[daily.length - 1].total ?? -1 : -1
}

function weekTraffic(server: ProbeServer): number {
  const daily = server.daily_traffic || []
  const week = daily.slice(-7)
  return week.length ? week.reduce((a, b) => a + (b.total ?? 0), 0) : -1
}

function load1m(server: ProbeServer): number {
  const parts = (server.loadavg || '').split(/\s+/).map(Number).filter((v) => Number.isFinite(v))
  return parts.length ? parts[0] : -1
}

function daysLeft(server: ProbeServer): number {
  if (!server.expires_at) return -1
  return Math.ceil((new Date(`${server.expires_at}T23:59:59`).getTime() - Date.now()) / 86400000)
}

function avgLossPct(server: ProbeServer, cn: boolean): number {
  const losses = (server.ping || [])
    .filter((item) => isCnLabel(item.label) === cn)
    .map((item) => item.loss_pct)
    .filter((value) => value >= 0)
  return losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : -1
}

const LEADERBOARD_TABS: { key: LeaderboardKey; label: string; icon: React.ReactNode }[] = [
  { key: 'cpu', label: 'CPU', icon: <Cpu size={13} /> },
  { key: 'mem', label: '内存', icon: <MemoryStick size={13} /> },
  { key: 'disk', label: '磁盘', icon: <HardDrive size={13} /> },
  { key: 'load', label: '负载', icon: <Server size={13} /> },
  { key: 'traffic', label: '流量', icon: <PieChart size={13} /> },
  { key: 'usage', label: '流量使用率', icon: <Database size={13} /> },
  { key: 'speed', label: '实时速度', icon: <ArrowDownUp size={13} /> },
  { key: 'uptime', label: '在线时长', icon: <Clock size={13} /> },
  { key: 'today', label: '今日流量', icon: <CalendarClock size={13} /> },
  { key: 'week', label: '近7日流量', icon: <TrendingUp size={13} /> },
  { key: 'loss-cn', label: '内地丢包率', icon: <Activity size={13} /> },
  { key: 'loss-idc', label: '海外丢包率', icon: <Wifi size={13} /> },
  { key: 'cost', label: '月成本', icon: <Wallet size={13} /> },
  { key: 'expiry', label: '到期时间', icon: <Calendar size={13} /> },
  { key: 'ping-cn', label: '内地延迟', icon: <Gauge size={13} /> },
  { key: 'ping-idc', label: '海外延迟', icon: <Globe2 size={13} /> },
]

function Leaderboard({ servers }: { servers: ProbeServer[] }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<LeaderboardKey>('cpu')
  const [desc, setDesc] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const selectTab = (key: LeaderboardKey) => {
    if (key === tab) {
      setDesc((value) => !value)
    } else {
      setTab(key)
      setDesc(key !== 'expiry') // 到期时间默认升序(最快到期在前)
    }
    setExpanded(null)
  }
  const pingTab = tab === 'ping-cn' || tab === 'ping-idc'
  const lossTab = tab === 'loss-cn' || tab === 'loss-idc'
  const rows = useMemo(() => {
    const indexed = servers.map((server, index) => {
      const avg = averagePing(server.ping || [])
      const value =
        tab === 'cpu' ? server.cpu_pct ?? -1
        : tab === 'mem' ? pct(server.mem_used, server.mem_total)
        : tab === 'disk' ? pct(server.disk_used, server.disk_total)
        : tab === 'load' ? load1m(server)
        : tab === 'traffic' ? server.traffic_used ?? -1
        : tab === 'usage' ? pct(server.traffic_used, server.traffic_limit)
        : tab === 'speed' ? (server.download_speed ?? 0) + (server.upload_speed ?? 0)
        : tab === 'uptime' ? server.uptime ?? -1
        : tab === 'today' ? todayTraffic(server)
        : tab === 'week' ? weekTraffic(server)
        : tab === 'loss-cn' ? avgLossPct(server, true)
        : tab === 'loss-idc' ? avgLossPct(server, false)
        : tab === 'cost' ? monthlyCost(server)
        : tab === 'expiry' ? daysLeft(server)
        : tab === 'ping-cn' ? groupedPingAvg(server.ping || [], true)
        : tab === 'ping-idc' ? groupedPingAvg(server.ping || [], false)
        : avg.current_ms
      const lines = pingTab || lossTab
        ? (server.ping || [])
            .filter((item) => isCnLabel(item.label) === (tab === 'ping-cn' || tab === 'loss-cn'))
            .map((item) => ({ label: item.label, ms: item.current_ms, loss: item.loss_pct }))
        : []
      return { server, index, value, lines }
    })
    return indexed
      .filter((row) => row.value >= 0)
      .sort((a, b) => (desc ? b.value - a.value : a.value - b.value))
      .slice(0, 10)
  }, [servers, tab, desc, pingTab])
  const format = (value: number, server: ProbeServer) =>
    tab === 'cpu' || tab === 'mem' || tab === 'disk' ? `${value.toFixed(1)}%`
    : tab === 'load' ? value.toFixed(2)
    : tab === 'traffic' ? bytes(value, false)
    : tab === 'usage' ? `${value.toFixed(1)}%`
    : tab === 'speed' ? `↓${speed(server.download_speed ?? 0)} ↑${speed(server.upload_speed ?? 0)}`
    : tab === 'uptime' ? formatUptime(value)
    : tab === 'today' || tab === 'week' ? bytes(value, false)
    : tab === 'loss-cn' || tab === 'loss-idc' ? `${value.toFixed(2)}%`
    : tab === 'cost' ? `¥${value.toFixed(0)}/月`
    : tab === 'expiry' ? `${Math.round(value)} 天`
    : `${value.toFixed(0)} ms`
  return (
    <section className={`leaderboard-card ${open ? 'open' : ''}`}>
      <button className="globe-toggle" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span>
          <Trophy size={18} />
          多维榜单
        </span>
        <span>
          Top 10
          <ChevronDown size={17} />
        </span>
      </button>
      {open && (
        <div className="leaderboard-body">
          <div className="leaderboard-tabs">
            {LEADERBOARD_TABS.map((item) => (
              <button key={item.key} className={tab === item.key ? 'active' : ''} onClick={() => selectTab(item.key)}>
                {item.icon}
                {item.label}
                {tab === item.key && <span className="sort-arrow">{desc ? '↓' : '↑'}</span>}
              </button>
            ))}
          </div>
          <ol className="leaderboard-list">
            {rows.map(({ server, index, value, lines }, rank) => (
              <li key={`${server.name}-${index}`}>
                <div className="lb-row">
                  <button type="button" className="lb-main" onClick={() => (location.hash = `#/server/${index}`)}>
                    <span className="rank">{rank + 1}</span>
                    <span className="lb-name">
                      <Twemoji>
                        {regionFlag(server.region) && !hasLeadingFlag(server.name || '') ? `${regionFlag(server.region)} ${server.name}` : server.name}
                      </Twemoji>
                    </span>
                    <span className="lb-value">
                      {format(value, server)}
                      {(pingTab || lossTab) && lines.length > 0 && <em className="lb-lines-count">{lines.filter((l) => l.ms >= 0).length}线</em>}
                    </span>
                  </button>
                  {(pingTab || lossTab) && lines.length > 0 && (
                    <button
                      type="button"
                      className={`lb-expand${expanded === index ? ' open' : ''}`}
                      aria-label={expanded === index ? '收起线路明细' : '展开线路明细'}
                      onClick={() => setExpanded((prev) => (prev === index ? null : index))}
                    >
                      <ChevronDown size={13} />
                    </button>
                  )}
                </div>
                {(pingTab || lossTab) && expanded === index && (
                  <div className="lb-lines">
                    {lines.map((line) => (
                      <span
                        key={line.label}
                        className={lossTab ? (line.loss < 0 ? 'timeout' : '') : line.ms < 0 ? 'timeout' : ''}
                      >
                        {line.label}
                        <b>
                          {lossTab
                            ? line.loss < 0
                              ? '—'
                              : `${line.loss.toFixed(2)}%`
                            : line.ms < 0
                              ? '超时'
                              : `${line.ms.toFixed(0)} ms`}
                        </b>
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
            {!rows.length && (
              <li className="lb-empty">
                {tab === 'uptime' || tab === 'today' ? '等待探针数据上报' : '暂无数据'}
              </li>
            )}
          </ol>
        </div>
      )}
    </section>
  )
}

export function lossScale(rows: Array<Record<string, string | number | null>>) {
  const peak = Math.max(
    0,
    ...rows.flatMap((row) =>
      Object.entries(row)
        .filter(([key]) => key !== 'time')
        .map(([, value]) => (typeof value === 'number' ? value : 0)),
    ),
  )
  const scales = [
    { max: 0.1, step: 0.025 },
    { max: 0.2, step: 0.05 },
    { max: 0.5, step: 0.1 },
    { max: 1, step: 0.25 },
    { max: 2, step: 0.5 },
    { max: 5, step: 1 },
    { max: 10, step: 2 },
    { max: 20, step: 5 },
    { max: 50, step: 10 },
    { max: 100, step: 25 },
  ]
  const selected = scales.find((item) => peak <= item.max) ?? scales[scales.length - 1]
  return {
    max: selected.max,
    ticks: Array.from(
      { length: Math.round(selected.max / selected.step) + 1 },
      (_, index) => Number((index * selected.step).toFixed(3)),
    ),
  }
}

export function formatLossTick(value: number): string {
  const digits = value < 0.1 ? 3 : value < 1 ? 2 : value < 10 ? 1 : 0
  return `${value.toFixed(digits).replace(/\.?0+$/, '')}%`
}

const TRAFFIC_LINES = [
  { key: 'total', label: '总流量', stroke: '#3b82f6' },
  { key: 'uplink', label: '上行流量', stroke: '#f97316' },
  { key: 'downlink', label: '下行流量', stroke: '#22c55e' },
] as const

export function TrafficChart({ daily, containerClass = 'detail-chart' }: { daily: ProbeServer['daily_traffic']; containerClass?: string }) {
  const rows = daily || []
  const chartRef = useRef<HTMLDivElement>(null)
  const [trafficRange, setTrafficRange] = useState<'all' | '7d' | '30d'>('7d')
  const [zoom, setZoom] = useState(1)
  const [isFit, setIsFit] = useState(true)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const shown = useMemo(() => {
    if (!rows.length) return []
    if (trafficRange === 'all') return rows
    const days = trafficRange === '7d' ? 7 : 30
    return rows.slice(-days)
  }, [rows, trafficRange])
  const fitZoom = () => {
    const el = chartRef.current
    if (!el || !shown.length) return
    const target = el.clientWidth / (shown.length * 82)
    setZoom(Math.max(0.05, Math.min(8, target)))
    setIsFit(true)
  }
  useEffect(() => {
    if (shown.length) {
      const raf = requestAnimationFrame(fitZoom)
      return () => cancelAnimationFrame(raf)
    }
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trafficRange, shown.length])
  const toggleLine = (key: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  if (!rows.length) {
    return <div className="chart-empty">暂无日流量数据</div>
  }
  return (
    <>
      <div className="ranges">
        <button type="button" className={trafficRange === 'all' ? 'active' : ''} onClick={() => setTrafficRange('all')}>
          全部
        </button>
        <button type="button" className={trafficRange === '7d' ? 'active' : ''} onClick={() => setTrafficRange('7d')}>
          7日
        </button>
        <button type="button" className={trafficRange === '30d' ? 'active' : ''} onClick={() => setTrafficRange('30d')}>
          30日
        </button>
        <span className="ranges-sep" />
        <button
          type="button"
          className="zoom-btn"
          aria-label="缩小横轴"
          title={`缩小横轴（当前 ${Math.round(zoom * 100)}%）`}
          onClick={() => {
            setZoom((value) => Math.max(0.05, Math.round((value - 0.1) * 10) / 10))
            setIsFit(false)
          }}
        >
          <ZoomOut size={13} />
        </button>
        <button
          type="button"
          className={`zoom-btn${isFit ? ' active' : ''}`}
          aria-label="适应屏幕宽度"
          title="适应屏幕宽度"
          onClick={fitZoom}
        >
          <MoveHorizontal size={13} />
        </button>
        <button
          type="button"
          className="zoom-btn"
          aria-label="放大横轴"
          title={`放大横轴（当前 ${Math.round(zoom * 100)}%）`}
          onClick={() => {
            setZoom((value) => Math.min(8, Math.round((value + 0.1) * 10) / 10))
            setIsFit(false)
          }}
        >
          <ZoomIn size={13} />
        </button>
      </div>
      <div className={containerClass} ref={chartRef}>
        <HorizontalChart width={Math.max(120, shown.length * 82 * zoom)}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={shown} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={28} />
              <YAxis width={52} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value) => bytes(Number(value), false)} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8 }}
                labelFormatter={(value) => String(value)}
                formatter={(value, _name, item) => [bytes(Number(value)), (item as { dataKey?: string } | undefined)?.dataKey === 'total' ? '总流量' : (item as { dataKey?: string } | undefined)?.dataKey === 'uplink' ? '上行' : '下行']}
              />
              {TRAFFIC_LINES.filter((line) => !hidden.has(line.key)).map((line) => (
                <Line key={line.key} type="monotone" dataKey={line.key} name={line.label} stroke={line.stroke} strokeWidth={2} dot={false} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </HorizontalChart>
      </div>
      <div className="traffic-line-toggle">
        {TRAFFIC_LINES.map((line) => (
          <button
            type="button"
            key={line.key}
            className={hidden.has(line.key) ? 'off' : 'active'}
            style={{ '--line-color': line.stroke } as React.CSSProperties}
            onClick={() => toggleLine(line.key)}
          >
            <span className="dot" />
            {line.label}
          </button>
        ))}
      </div>
    </>
  )
}

function TrafficDialog({ server, close }: { server: ProbeServer; close: () => void }) {
  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={close}>
      <section className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <header>
          <h2>{server.name} · 日流量趋势</h2>
          <button aria-label="关闭" onClick={close}>
            ×
          </button>
        </header>
        <TrafficChart daily={server.daily_traffic || []} containerClass="chart" />
      </section>
    </div>,
    document.body,
  )
}

function systemTitle(server: ProbeServer): string {
  return (
    [server.os, server.kernel, server.arch].filter(Boolean).join(' · ') ||
    '系统信息未上报'
  )
}
const systemIcons = [
  { terms: ['alma'], icon: siAlmalinux },
  { terms: ['alpine'], icon: siAlpinelinux },
  { terms: ['arch'], icon: siArchlinux },
  { terms: ['centos'], icon: siCentos },
  { terms: ['debian'], icon: siDebian },
  { terms: ['fedora'], icon: siFedora },
  { terms: ['freebsd'], icon: siFreebsd },
  { terms: ['gentoo'], icon: siGentoo },
  { terms: ['kali'], icon: siKalilinux },
  { terms: ['mint'], icon: siLinuxmint },
  { terms: ['nixos', 'nix os'], icon: siNixos },
  { terms: ['opensuse', 'open suse', 'suse'], icon: siOpensuse },
  { terms: ['proxmox'], icon: siProxmox },
  { terms: ['red hat', 'redhat', 'rhel'], icon: siRedhat },
  { terms: ['rocky'], icon: siRockylinux },
  { terms: ['ubuntu'], icon: siUbuntu },
  { terms: ['darwin', 'macos', 'mac os'], icon: siApple },
]
export function SystemIcon({ server }: { server: ProbeServer }) {
  const os = (server.os || '').toLowerCase()
  if (os.includes('windows')) return <Monitor size={16} />
  const icon =
    systemIcons.find(({ terms }) => terms.some((term) => os.includes(term)))?.icon ?? siLinux
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      role="img"
      viewBox="0 0 24 24"
      fill={`#${icon.hex}`}
    >
      <path d={icon.path} />
    </svg>
  )
}

function TrendDialog({ serverIndex, initial, targetKey, title, mode, close }: { serverIndex: number; initial: ProbePingSeries[]; targetKey: string; title: string; mode: 'latency' | 'loss'; close: () => void }) {
  const [range, setRange] = useState<RangeKey>('1h')
  const [group, setGroup] = useState<'all' | 'cn' | 'idc'>('all')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [series, setSeries] = useState<ProbePingSeries[]>(initial)
  const [loading, setLoading] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [isFit, setIsFit] = useState(true)
  const chartRef = useRef<HTMLDivElement>(null)
  const [timeMeta, setTimeMeta] = useState({
    generatedAt: Math.floor(Date.now() / 1000),
    bucketSec: 300,
  })

  const isCnLabel = (label: string) => /电信|联通|移动/.test(label)
  const groupSeries = useMemo(() => {
    const list = series.map((item, index) => ({ item, index }))
    if (group === 'all') return list
    const cn = group === 'cn'
    return list.filter(({ item }) => item.key !== '__avg__' && isCnLabel(item.label) === cn)
  }, [series, group])
  const displaySeries = useMemo(
    () => groupSeries.filter(({ item }) => !hidden.has(item.key || item.label)),
    [groupSeries, hidden],
  )
  const toggleHidden = (key: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    void fetch(`/api/series?server=${serverIndex}&range=${range}&all=1`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<{
          success: boolean
          series?: ProbePingSeries
          all_series?: ProbePingSeries[]
          generated_at?: number
          bucket_sec?: number
        }>
      })
      .then((payload) => {
        if (payload.success) {
          setSeries([...(payload.series ? [{ ...payload.series, key: '__avg__', label: '平均' }] : []), ...(payload.all_series || [])])
          setTimeMeta({
            generatedAt: payload.generated_at ?? Math.floor(Date.now() / 1000),
            bucketSec: payload.bucket_sec ?? (range === '1h' ? 300 : range === '6h' ? 600 : 1800),
          })
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [range, serverIndex])

  const rows = useMemo(
    () =>
      Array.from({ length: displaySeries[0]?.item.buckets.length || 0 }, (_, index) => {
        const ts =
          timeMeta.generatedAt -
          (timeMeta.generatedAt % timeMeta.bucketSec) -
          ((displaySeries[0]?.item.buckets.length || 0) - 1 - index) * timeMeta.bucketSec
        const row: Record<string, string | number | null> = {
          time: formatAxisDateTime(ts, range === '1h'),
          ts,
        }
        for (const { item } of displaySeries) {
          const bucket = item.buckets[index]
          const value = mode === 'loss' ? bucket?.loss : bucket?.ms
          row[item.key || item.label] = value !== undefined && value >= 0 ? value : null
        }
        return row
      }),
    [displaySeries, mode, timeMeta, range],
  )
  const dynamicLossScale = useMemo(() => lossScale(rows), [rows])
  const fitZoom = () => {
    const el = chartRef.current
    if (!el || !rows.length) return
    const target = el.clientWidth / (rows.length * 82)
    setZoom(Math.max(0.05, Math.min(8, target)))
    setIsFit(true)
  }
  // 每个时间范围默认适应屏幕宽度；用户手动 +/- 后不再自动覆盖（与详情页 PingTrendChart 一致）
  useEffect(() => {
    if (!loading && displaySeries.length) {
      const raf = requestAnimationFrame(fitZoom)
      return () => cancelAnimationFrame(raf)
    }
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, loading])

  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={close}>
      <section className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <h2>
            {title} · {mode === 'loss' ? '丢包率趋势' : '延迟趋势'}
          </h2>
          <button aria-label="关闭" onClick={close}>
            ×
          </button>
        </header>
        <div className="ranges">
          {ranges.map((item) => (
            <button type="button" className={range === item.key ? 'active' : ''} onClick={() => setRange(item.key)} key={item.key}>
              {item.label}
            </button>
          ))}
          <span className="ranges-sep" />
          <button type="button" className={group === 'all' ? 'active' : ''} onClick={() => setGroup('all')}>
            全部
          </button>
          <button type="button" className={group === 'cn' ? 'active' : ''} onClick={() => setGroup('cn')}>
            内地
          </button>
          <button type="button" className={group === 'idc' ? 'active' : ''} onClick={() => setGroup('idc')}>
            海外
          </button>
          <span className="ranges-sep" />
          <button
            type="button"
            className="zoom-btn"
            aria-label="缩小横轴"
            title={`缩小横轴（当前 ${Math.round(zoom * 100)}%）`}
            onClick={() => {
              setZoom((value) => Math.max(0.05, Math.round((value - 0.1) * 10) / 10))
              setIsFit(false)
            }}
          >
            <ZoomOut size={13} />
          </button>
          <button
            type="button"
            className={`zoom-btn${isFit ? ' active' : ''}`}
            aria-label="适应屏幕宽度"
            title="适应屏幕宽度"
            onClick={fitZoom}
          >
            <MoveHorizontal size={13} />
          </button>
          <button
            type="button"
            className="zoom-btn"
            aria-label="放大横轴"
            title={`放大横轴（当前 ${Math.round(zoom * 100)}%）`}
            onClick={() => {
              setZoom((value) => Math.min(8, Math.round((value + 0.1) * 10) / 10))
              setIsFit(false)
            }}
          >
            <ZoomIn size={13} />
          </button>
        </div>
        <div className="chart" ref={chartRef}>
          {loading && <div className="loading-overlay">加载中…</div>}
          {!loading && !displaySeries.length && (
            <div className="chart-empty">
              该服务器未配置{group === 'cn' ? '内地' : '海外'}探测点
            </div>
          )}
          <HorizontalChart width={Math.max(120, rows.length * 82 * zoom)}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <XAxis dataKey="time" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={28} />
                <YAxis
                  width={52}
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  unit={mode === 'loss' ? undefined : 'ms'}
                  domain={mode === 'loss' ? [0, dynamicLossScale.max] : undefined}
                  ticks={mode === 'loss' ? dynamicLossScale.ticks : undefined}
                  tickFormatter={mode === 'loss' ? (value) => formatLossTick(Number(value)) : undefined}
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  formatter={(value, _name, item) => [`${Number(value).toFixed(mode === 'loss' ? 1 : 0)}${mode === 'loss' ? '%' : 'ms'}`, series.find((line) => (line.key || line.label) === item.dataKey)?.label || String(item.dataKey)]}
                  labelFormatter={(_value, payload) => formatAxisDateTime(Number((payload?.[0]?.payload as { ts?: number } | undefined)?.ts ?? 0), true)}
                />
                {displaySeries.map(({ item, index }) => {
                  const key = item.key || item.label
                  const active = key === targetKey
                  return <Line key={key} type="monotone" dataKey={key} name={item.label} stroke={key === '__avg__' ? 'var(--foreground, #2f2350)' : colors[index % colors.length]} strokeWidth={active ? 2.5 : 1} strokeOpacity={active ? 1 : 0.45} dot={false} connectNulls={false} isAnimationActive={false} />
                })}
              </LineChart>
            </ResponsiveContainer>
          </HorizontalChart>
        </div>
        {groupSeries.length > 0 && (
          <div className="legend">
            {groupSeries.map(({ item, index }) => {
              const key = item.key || item.label
              const off = hidden.has(key)
              return (
                <button
                  type="button"
                  className={`${key === targetKey ? 'active' : ''}${off ? ' off' : ''}`}
                  key={key}
                  onClick={() => toggleHidden(key)}
                  title={off ? '点击显示' : '点击隐藏'}
                >
                  <i
                    style={{
                      background: key === '__avg__' ? 'var(--foreground, #2f2350)' : colors[index % colors.length],
                    }}
                  />
                  {item.label}
                </button>
              )
            })}
          </div>
        )}
      </section>
    </div>,
    document.body,
  )
}

const LOAD_LINES = [
  { key: 'l1', label: '1 分钟', color: 'var(--primary, #8b5cf6)' },
  { key: 'l5', label: '5 分钟', color: '#f59e0b' },
  { key: 'l15', label: '15 分钟', color: '#22c55e' },
] as const

// 负载历史曲线（数据来自 /api/load，Worker cron 自建采集）。详情页与 Lumina 弹窗共用，containerClass 控制容器（详情页 detail-chart / 弹窗 chart）
export function LoadTrendChart({ serverName, containerClass = 'detail-chart' }: { serverName: string; containerClass?: string }) {
  const [range, setRange] = useState<RangeKey>('1h')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [rows, setRows] = useState<{ ts: number; time: string; l1: number | null; l5: number | null; l15: number | null }[]>([])
  const [loading, setLoading] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [isFit, setIsFit] = useState(true)
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    void fetch(`/api/load?server=${encodeURIComponent(serverName)}&range=${range}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<{
          success: boolean
          points?: { ts: number; l1: number; l5: number; l15: number }[]
        }>
      })
      .then((payload) => {
        if (payload.success && payload.points) {
          setRows(
            payload.points.map((p) => ({
              ts: p.ts,
              time: formatAxisDateTime(p.ts, range === '1h'),
              l1: p.l1 ?? null,
              l5: p.l5 ?? null,
              l15: p.l15 ?? null,
            })),
          )
        } else {
          setRows([])
        }
      })
      .catch(() => setRows([]))
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [range, serverName])

  const fitZoom = () => {
    const el = chartRef.current
    if (!el || !rows.length) return
    const target = el.clientWidth / (rows.length * 82)
    setZoom(Math.max(0.05, Math.min(8, target)))
    setIsFit(true)
  }
  useEffect(() => {
    if (!loading && rows.length) {
      const raf = requestAnimationFrame(fitZoom)
      return () => cancelAnimationFrame(raf)
    }
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, loading])

  const toggleHidden = (key: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <>
      <div className="ranges">
        {ranges.map((item) => (
          <button type="button" className={range === item.key ? 'active' : ''} onClick={() => setRange(item.key)} key={item.key}>
            {item.label}
          </button>
        ))}
        <span className="ranges-sep" />
        <button
          type="button"
          className="zoom-btn"
          aria-label="缩小横轴"
          title={`缩小横轴（当前 ${Math.round(zoom * 100)}%）`}
          onClick={() => {
            setZoom((value) => Math.max(0.05, Math.round((value - 0.1) * 10) / 10))
            setIsFit(false)
          }}
        >
          <ZoomOut size={13} />
        </button>
        <button type="button" className={`zoom-btn${isFit ? ' active' : ''}`} aria-label="适应屏幕宽度" title="适应屏幕宽度" onClick={fitZoom}>
          <MoveHorizontal size={13} />
        </button>
        <button
          type="button"
          className="zoom-btn"
          aria-label="放大横轴"
          title={`放大横轴（当前 ${Math.round(zoom * 100)}%）`}
          onClick={() => {
            setZoom((value) => Math.min(8, Math.round((value + 0.1) * 10) / 10))
            setIsFit(false)
          }}
        >
          <ZoomIn size={13} />
        </button>
      </div>
      <div className={containerClass} ref={chartRef}>
        {loading && <div className="loading-overlay">加载中…</div>}
        {!loading && !rows.length && <div className="chart-empty">暂无负载历史（采集约 5 分钟后出数据）</div>}
        <HorizontalChart width={Math.max(120, rows.length * 82 * zoom)}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <XAxis dataKey="time" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={28} />
              <YAxis width={40} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 'auto']} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8 }}
                formatter={(value, _name, item) => [
                  Number(value).toFixed(2),
                  LOAD_LINES.find((l) => l.key === item.dataKey)?.label || String(item.dataKey),
                ]}
                labelFormatter={(_value, payload) => formatAxisDateTime(Number((payload?.[0]?.payload as { ts?: number } | undefined)?.ts ?? 0), true)}
              />
              {LOAD_LINES.map((line) =>
                hidden.has(line.key) ? null : (
                  <Line
                    key={line.key}
                    type="monotone"
                    dataKey={line.key}
                    name={line.label}
                    stroke={line.color}
                    strokeWidth={line.key === 'l1' ? 2.5 : 1.5}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ),
              )}
            </LineChart>
          </ResponsiveContainer>
        </HorizontalChart>
      </div>
      <div className="legend">
        {LOAD_LINES.map((line) => {
          const off = hidden.has(line.key)
          return (
            <button type="button" className={off ? 'off' : ''} key={line.key} onClick={() => toggleHidden(line.key)} title={off ? '点击显示' : '点击隐藏'}>
              <i style={{ background: line.color }} />
              {line.label}
            </button>
          )
        })}
      </div>
    </>
  )
}

// 系统指标历史曲线（数据来自 /api/series?metric=system，beta3 上游原生支持）。metric='cpu' 单线 CPU%，'mem' 单线内存占用百分比
const SYSTEM_LINES = {
  cpu: { label: 'CPU 使用率', color: 'var(--progress-cpu, #3b82f6)' },
  mem: { label: '内存使用率', color: 'var(--progress-memory, #8b5cf6)' },
} as const
export function SystemTrendChart({ serverIndex, metric, containerClass = 'detail-chart' }: { serverIndex: number; metric: 'cpu' | 'mem'; containerClass?: string }) {
  const [range, setRange] = useState<RangeKey>('1h')
  const [hidden, setHidden] = useState(false)
  const [rows, setRows] = useState<{ ts: number; time: string; value: number | null }[]>([])
  const [loading, setLoading] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [isFit, setIsFit] = useState(true)
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    void fetch(`/api/series?server=${serverIndex}&range=${range}&metric=system`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<{ success: boolean; series?: Record<string, { t: number; value: number }[]> }>
      })
      .then((payload) => {
        if (payload.success && payload.series) {
          const raw = payload.series
          const pts =
            metric === 'cpu'
              ? raw.cpu_pct || []
              : (raw.mem_used || []).map((u, i) => {
                  const t = raw.mem_total?.[i]
                  return { t: u.t, value: t && t.value > 0 ? (u.value / t.value) * 100 : null }
                })
          setRows(pts.map((p) => ({ ts: p.t, time: formatAxisDateTime(p.t, range === '1h'), value: p.value ?? null })))
        } else {
          setRows([])
        }
      })
      .catch(() => setRows([]))
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [range, serverIndex, metric])

  const fitZoom = () => {
    const el = chartRef.current
    if (!el || !rows.length) return
    const target = el.clientWidth / (rows.length * 82)
    setZoom(Math.max(0.05, Math.min(8, target)))
    setIsFit(true)
  }
  useEffect(() => {
    if (!loading && rows.length) {
      const raf = requestAnimationFrame(fitZoom)
      return () => cancelAnimationFrame(raf)
    }
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, loading])

  const line = SYSTEM_LINES[metric]
  return (
    <>
      <div className="ranges">
        {ranges.map((item) => (
          <button type="button" className={range === item.key ? 'active' : ''} onClick={() => setRange(item.key)} key={item.key}>
            {item.label}
          </button>
        ))}
        <span className="ranges-sep" />
        <button
          type="button"
          className="zoom-btn"
          aria-label="缩小横轴"
          title={`缩小横轴（当前 ${Math.round(zoom * 100)}%）`}
          onClick={() => {
            setZoom((value) => Math.max(0.05, Math.round((value - 0.1) * 10) / 10))
            setIsFit(false)
          }}
        >
          <ZoomOut size={13} />
        </button>
        <button type="button" className={`zoom-btn${isFit ? ' active' : ''}`} aria-label="适应屏幕宽度" title="适应屏幕宽度" onClick={fitZoom}>
          <MoveHorizontal size={13} />
        </button>
        <button
          type="button"
          className="zoom-btn"
          aria-label="放大横轴"
          title={`放大横轴（当前 ${Math.round(zoom * 100)}%）`}
          onClick={() => {
            setZoom((value) => Math.min(8, Math.round((value + 0.1) * 10) / 10))
            setIsFit(false)
          }}
        >
          <ZoomIn size={13} />
        </button>
      </div>
      <div className={containerClass} ref={chartRef}>
        {loading && <div className="loading-overlay">加载中…</div>}
        {!loading && !rows.length && <div className="chart-empty">暂无{metric === 'cpu' ? 'CPU' : '内存'}历史</div>}
        <HorizontalChart width={Math.max(120, rows.length * 82 * zoom)}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <XAxis dataKey="time" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={28} />
              <YAxis width={40} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, metric === 'mem' ? 100 : 'auto']} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8 }}
                formatter={(value, _name, item) => [item.dataKey === 'value' ? `${Number(value).toFixed(1)}%` : Number(value).toFixed(1), line.label]}
                labelFormatter={(_value, payload) => formatAxisDateTime(Number((payload?.[0]?.payload as { ts?: number } | undefined)?.ts ?? 0), true)}
              />
              {!hidden && (
                <Line type="monotone" dataKey="value" name={line.label} stroke={line.color} strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </HorizontalChart>
      </div>
      <div className="legend">
        <button type="button" className={hidden ? 'off' : ''} onClick={() => setHidden((v) => !v)} title={hidden ? '点击显示' : '点击隐藏'}>
          <i style={{ background: line.color }} />
          {line.label}
        </button>
      </div>
    </>
  )
}

function LoadTrendDialog({ serverName, title, close }: { serverName: string; title: string; close: () => void }) {
  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={close}>
      <section className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <h2>{title} · 负载趋势</h2>
          <button aria-label="关闭" onClick={close}>
            ×
          </button>
        </header>
        <LoadTrendChart serverName={serverName} containerClass="chart" />
      </section>
    </div>,
    document.body,
  )
}

function SystemTrendDialog({ serverIndex, title, metric, close }: { serverIndex: number; title: string; metric: 'cpu' | 'mem'; close: () => void }) {
  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={close}>
      <section className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <h2>{title} · {metric === 'cpu' ? 'CPU' : '内存'}趋势</h2>
          <button aria-label="关闭" onClick={close}>
            ×
          </button>
        </header>
        <SystemTrendChart serverIndex={serverIndex} metric={metric} containerClass="chart" />
      </section>
    </div>,
    document.body,
  )
}

function PingPanel({ ping, serverIndex }: { ping: ProbePingSeries[]; serverIndex: number }) {
  const [mode, setMode] = useState<'latency' | 'loss' | null>(null)
  const [selected, setSelected] = useState('__avg__')
  const average = averagePing(ping)
  const lines = [{ ...average, key: '__avg__' }, ...ping]
  const current = selected === '__avg__' ? average : ping.find((item) => (item.key || item.label) === selected) || average
  const blocks = (kind: 'latency' | 'loss') =>
    current.buckets.map((bucket, index) => {
      const value = kind === 'loss' ? bucket.loss : bucket.ms
      const level = value < 0 ? 'none' : kind === 'loss' ? (value >= 20 ? 'bad' : value > 0 ? 'warn' : 'good') : value >= 200 ? 'warn' : 'good'
      return <i key={index} className={level} />
    })
  return (
    <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <div className="ping-grid">
        <div className="ping-head">
          <span>
            <Clock size={14} />
            <select value={selected} onChange={(event) => setSelected(event.target.value)}>
              <option value="__avg__">平均</option>
              {ping.map((item) => (
                <option key={item.key || item.label} value={item.key || item.label}>
                  {item.label}
                </option>
              ))}
            </select>
          </span>
          <strong>{current.current_ms < 0 ? '超时' : `${current.current_ms.toFixed(0)} ms`}</strong>
        </div>
        <div className="ping-head">
          <span>
            <Wifi size={14} />
            丢包率
          </span>
          <strong className={current.loss_pct > 0 ? 'warning' : ''}>{current.loss_pct.toFixed(1)}%</strong>
        </div>
        <button className="ping-blocks" type="button" aria-label="查看延迟趋势" onClick={() => setMode('latency')}>
          {blocks('latency')}
        </button>
        <button className="ping-blocks" type="button" aria-label="查看丢包率趋势" onClick={() => setMode('loss')}>
          {blocks('loss')}
        </button>
      </div>
      {mode && <TrendDialog serverIndex={serverIndex} initial={lines} targetKey={selected} title={current.label} mode={mode} close={() => setMode(null)} />}
    </div>
  )
}

const routeCarrierLabels = {
  telecom: '电信',
  unicom: '联通',
  mobile: '移动',
} as const
const goldRoutes = new Set(['CN2GIA', 'CTGGIA', '9929', 'CMIN2', '163PP'])
function displayReturnRoute(route: string): string {
  return route.toUpperCase().replace(/[^A-Z0-9]/g, '') === 'CMIN' ? 'CMI' : route
}

function ReturnRouteIcon({ premium }: { premium: boolean }) {
  return <Lottie animationData={premium ? premiumRouteAnimation : commonRouteAnimation} aria-hidden="true" className="route-badge-icon" loop />
}

export function ReturnRouteBadges({ routes, telecomPaidPeer, variant }: { routes: ProbeReturnRoute[]; telecomPaidPeer?: boolean; variant?: 'lumina' | 'anime' }) {
  const byCarrier = new Map(routes.map((route) => [route.carrier, route]))
  const items = (['telecom', 'unicom', 'mobile'] as const).map((carrier) => {
    const route = byCarrier.get(carrier)
    const detectedRouteType = displayReturnRoute(route?.route_type || 'Unknown')
    const routeType = carrier === 'telecom' && telecomPaidPeer && detectedRouteType === '163' ? '163 PP' : detectedRouteType
    return { carrier, route, routeType, premium: goldRoutes.has(routeType.toUpperCase().replace(/[^A-Z0-9]/g, '')) }
  })
  if (variant === 'lumina' || variant === 'anime') {
    // 扁平版勋章：无 Lottie 动画、无渐变、无阴影。lumina=细边框低饱和 chip；anime=直角+紫色调 chip
    const flat = variant === 'lumina' ? 'lumina-route' : 'anime-route'
    return (
      <div className={`${flat}-badges`}>
        {items.map(({ carrier, route, routeType, premium }) => (
          <span className={`${flat}-chip${premium ? ' gold' : ''}`} key={carrier} title={route?.region ? `${route.region} · ${routeType}` : routeType}>
            <small>{routeCarrierLabels[carrier]}</small>
            <strong>{routeType}</strong>
          </span>
        ))}
      </div>
    )
  }
  return (
    <div className="return-route-badges">
      {items.map(({ carrier, route, routeType, premium }) => (
        <div className="route-badge" key={carrier} title={route?.region ? `${route.region} · ${routeType}` : routeType}>
          <div className={premium ? 'route-badge-animation gold' : 'route-badge-animation silver'}><ReturnRouteIcon premium={premium} /></div>
          <div className={premium ? 'route-badge-text gold' : 'route-badge-text silver'}>
            <small>{routeCarrierLabels[carrier]}</small>
            <strong>{routeType}</strong>
          </div>
        </div>
      ))}
    </div>
  )
}

const LUMINA_QUOTA_SEGMENTS = 18
// 每段取 OKLCH heat 渐变(绿→黄→橙→红)的 1/18 切片作为段色,与 LuminaPlus 的
// trafficQuotaSegmentColor 语义一致:颜色只看段的位置,与主题无关。
const LUMINA_HEAT_GRADIENT =
  'linear-gradient(to right in oklch, oklch(0.72 0.16 150) 0%, oklch(0.72 0.16 150) 10%, oklch(0.8 0.18 128) 28%, oklch(0.86 0.18 110) 44%, oklch(0.8 0.18 85) 58%, oklch(0.72 0.19 62) 72%, oklch(0.65 0.21 40) 86%, oklch(0.6 0.22 27) 100%)'

function luminaQuotaLitCount(fraction: number): number {
  let count = 0
  for (let i = 0; i < LUMINA_QUOTA_SEGMENTS; i++) {
    if ((i + 0.5) / LUMINA_QUOTA_SEGMENTS <= fraction) count += 1
    else break
  }
  return count
}

function LuminaMetricBar({
  icon,
  label,
  value,
  detail,
  paint,
  fraction,
}: {
  icon: React.ReactNode
  label: string
  value: string
  detail?: string
  paint: string
  fraction: number
}) {
  const fill = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0))
  return (
    <div className="lumina-metric" title={detail ? `${label} ${value} · ${detail}` : `${label} ${value}`}>
      <div className="lumina-metric-head">
        <span className="lumina-metric-label">
          {icon}
          <span>{label}</span>
        </span>
        <strong className="tabular">{value}</strong>
      </div>
      <div className="lumina-meter" aria-hidden>
        <i style={{ '--lumina-fill': `${fill * 100}%`, '--lumina-paint': paint } as React.CSSProperties} />
      </div>
    </div>
  )
}

function luminaPulseColor(level: number): string {
  // 相对峰值分档: 无流量灰 → 低绿 → 中蓝 → 高琥珀 → 极高暖橙(琥珀+30%红, 避免刺眼红)
  if (level <= 0.01) return 'var(--progress-bg)'
  if (level < 0.3) return 'var(--status-success)'
  if (level < 0.6) return 'var(--traffic-up)'
  if (level < 0.85) return 'var(--status-warning)'
  return 'color-mix(in srgb, var(--status-warning) 70%, var(--status-error) 30%)'
}

function LuminaTrafficPulse({ samples }: { samples: ProbeServer['daily_traffic'] }) {
  const dots = 16
  const list = (samples || []).slice(-dots)
  const max = Math.max(1, ...list.map((item) => item.total ?? 0))
  return (
    <span className="lumina-traffic-pulse" aria-hidden>
      {Array.from({ length: dots }, (_, index) => {
        const sample = list[index - Math.max(0, dots - list.length)]
        // 无数据的天(历史不足16天): 渲染空白格, 不画灰条(避免"没流量"假象)
        if (!sample) return <span key={index} className="lumina-pulse-empty" />
        const value = sample.total ?? 0
        const level = value / max
        return (
          <span
            key={index}
            data-active={value > 0 ? 'true' : 'false'}
            title={`${sample.date}\n上行 ${bytes(sample.uplink)}\n下行 ${bytes(sample.downlink)}`}
            style={
              {
                '--pulse-h': `${Math.max(4, Math.round((0.45 + level * 0.95) * 20))}px`,
                '--pulse-color': luminaPulseColor(level),
                opacity: value > 0 ? 0.55 + level * 0.45 : 0.35,
              } as React.CSSProperties
            }
          />
        )
      })}
    </span>
  )
}

function luminaHeatColor(kind: 'latency' | 'loss', value: number): string {
  // 与延迟/丢包数值同色系(status tokens, 阈值仿原版 latency/loss bounds)
  if (kind === 'latency') {
    if (value < 100) return 'var(--status-success)'
    if (value < 150) return '#a3e635'
    if (value < 200) return 'var(--status-warning)'
    if (value < 300) return '#fb923c'
    return 'var(--status-error)'
  }
  if (value < 1) return 'var(--status-success)'
  if (value < 3) return '#a3e635'
  if (value < 5) return 'var(--status-warning)'
  if (value < 10) return '#fb923c'
  return 'var(--status-error)'
}

function LuminaHealthBars({ buckets, kind }: { buckets: ProbeBucket[]; kind: 'latency' | 'loss' }) {
  const bars = buckets.slice(-LUMINA_QUOTA_SEGMENTS)
  const values = bars.map((b) => (kind === 'latency' ? b.ms : b.loss)).filter((v) => v >= 0)
  const max = Math.max(1, ...values)
  return (
    <span className="lumina-health-bars" data-kind={kind} aria-hidden>
      {bars.map((bucket, index) => {
        const raw = kind === 'latency' ? bucket.ms : bucket.loss
        const height = raw >= 0 ? (raw / max) * 100 : 8
        return (
          <span
            key={index}
            title={raw >= 0 ? (kind === 'latency' ? `延迟 ${Math.round(raw)} ms` : `丢包 ${raw.toFixed(1)}%`) : '无数据'}
            style={
              {
                '--bar-h': `${height}%`,
                '--bar-c': raw >= 0 ? luminaHeatColor(kind, raw) : 'var(--progress-bg)',
              } as React.CSSProperties
            }
          />
        )
      })}
    </span>
  )
}

function ServerCardLumina({ server, index }: { server: EnrichedServer; index: number }) {
  const [trafficOpen, setTrafficOpen] = useState(false)
  const [loadOpen, setLoadOpen] = useState(false)
  const [cpuOpen, setCpuOpen] = useState(false)
  const [memOpen, setMemOpen] = useState(false)
  const [healthTarget, setHealthTarget] = useState('__avg__')
  const [healthTrend, setHealthTrend] = useState<'latency' | 'loss' | null>(null)
  const name = server.name || `服务器 ${index + 1}`
  const flag = regionFlag(server.region)
  const isOffline = !server.online
  const cores = server.cpu_cores ?? 0
  const loadParts = (server.loadavg || '').split(/\s+/).map(Number).filter((v) => Number.isFinite(v))
  const load1 = loadParts[0]
  const loadFraction = load1 !== undefined && cores > 0 ? Math.max(0, Math.min(1, load1 / cores)) : 0
  const pingList = server.ping?.length ? server.ping : []
  const pingCurrent = healthTarget === '__avg__' || !pingList.length
    ? averagePing(pingList)
    : (pingList.find((item) => (item.key || item.label) === healthTarget) || averagePing(pingList))
  const currentMs = pingCurrent.current_ms >= 0 ? pingCurrent.current_ms : null
  const lossAvg = !pingList.length ? -1 : (pingCurrent.loss_pct ?? 0)
  const trafficFraction = server.traffic_limit ? pct(server.traffic_used, server.traffic_limit) / 100 : 0
  const upRate = server.upload_speed
  const downRate = server.download_speed
  const trafficUp = server.cumulative_up
  const trafficDown = server.cumulative_down
  // 当前周期流量(物理口径): 主控 2026-08-10 新增 traffic_used_up/down(40/40 有值, 与Σdaily_traffic 精确一致)，
  // 优先直读字段; 缺失回退 cycle_daily_traffic 每日上下行 sum 比例估算(物理口径), 再回退 cumulative, 再回退 0.5
  // 注意: traffic_used(计费口径, oneway 只算单向) ≠ traffic_used_up+down(物理口径), 上下行展示用物理值
  let cycleUp = server.traffic_used_up
  let cycleDown = server.traffic_used_down
  if (cycleUp === undefined || cycleDown === undefined) {
    const cycleDaily = server.cycle_daily_traffic ?? server.daily_traffic ?? []
    const dailyUp = cycleDaily.reduce((acc, item) => acc + (item.uplink ?? 0), 0)
    const dailyDown = cycleDaily.reduce((acc, item) => acc + (item.downlink ?? 0), 0)
    const cycleRatioUp =
      dailyUp + dailyDown > 0
        ? dailyUp / (dailyUp + dailyDown)
        : trafficUp !== undefined && trafficDown !== undefined && trafficUp + trafficDown > 0
          ? trafficUp / (trafficUp + trafficDown)
          : 0.5
    const base = server.traffic_used !== undefined ? server.traffic_used : server.traffic_used_total
    if (base !== undefined) {
      cycleUp = base * cycleRatioUp
      cycleDown = base * (1 - cycleRatioUp)
    }
  }
  const expireValue = server.expires_at ? remainingDays(server.expires_at) : null
  const renewText =
    server.renewal_price !== undefined
      ? server.renewal_price_cny !== undefined
        ? `¥${server.renewal_price_cny.toFixed(2)}`
        : `${server.renewal_currency || 'CNY'} ${server.renewal_price}`
      : null

  return (
    <>
      <article
        className={`server-card lumina-card${isOffline ? ' is-offline' : ''}`}
        onClick={() => { location.hash = `#/server/${index}` }}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); location.hash = `#/server/${index}` } }}
        title="点击查看详情"
      >
        <header className="lumina-card-header">
          <div className="lumina-title-wrap">
            <span className={server.online ? 'status online' : 'status'} />
            <h2 className="lumina-title">
              <Twemoji>{flag && !hasLeadingFlag(name) ? `${flag} ${name}` : name}</Twemoji>
            </h2>
            {regionLabel(server) && <span className="lumina-subtitle">{regionLabel(server)}</span>}
          </div>
          <span className="lumina-card-actions">
            <span title={systemTitle(server)}>
              <SystemIcon server={server} />
            </span>
            <span className={server.online ? 'lumina-state online' : 'lumina-state'}>
              {server.online ? '在线' : '离线'}
            </span>
          </span>
        </header>

        <div className="lumina-metrics">
          {server.cpu_pct !== undefined && (
            <button
              type="button"
              className="lumina-metric-btn"
              aria-label="查看CPU趋势"
              title="点击查看CPU趋势"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                setCpuOpen(true)
              }}
            >
              <LuminaMetricBar icon={<Cpu size={13} />} label="CPU" value={`${server.cpu_pct.toFixed(1)}%`} detail={`${cores} 核`} paint="var(--progress-cpu)" fraction={server.cpu_pct / 100} />
            </button>
          )}
          {server.mem_total !== undefined && (
            <button
              type="button"
              className="lumina-metric-btn"
              aria-label="查看内存趋势"
              title="点击查看内存趋势"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                setMemOpen(true)
              }}
            >
              <LuminaMetricBar icon={<MemoryStick size={13} />} label="内存" value={`${pct(server.mem_used, server.mem_total).toFixed(1)}%`} detail={`${bytes(server.mem_used)} / ${bytes(server.mem_total)}`} paint="var(--progress-memory)" fraction={pct(server.mem_used, server.mem_total) / 100} />
            </button>
          )}
          {server.disk_total !== undefined && (
            <LuminaMetricBar icon={<HardDrive size={13} />} label="磁盘" value={`${pct(server.disk_used, server.disk_total).toFixed(1)}%`} detail={`${bytes(server.disk_used)} / ${bytes(server.disk_total)}`} paint="var(--progress-disk)" fraction={pct(server.disk_used, server.disk_total) / 100} />
          )}
          {load1 !== undefined && (
            <button
              type="button"
              className="lumina-metric-btn"
              aria-label="查看负载趋势"
              title="点击查看负载趋势"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                setLoadOpen(true)
              }}
            >
              <LuminaMetricBar icon={<Gauge size={13} />} label="负载" value={load1.toFixed(2)} detail={`${loadParts[1]?.toFixed(2) ?? '—'} / ${loadParts[2]?.toFixed(2) ?? '—'}`} paint="var(--progress-load)" fraction={loadFraction} />
            </button>
          )}
        </div>

        {(upRate !== undefined || downRate !== undefined) && (
          <div className="lumina-traffic-section">
            <div className="lumina-traffic-stat" title="上行速率与当前周期上行流量">
              <span className="lumina-traffic-direction">
                <ArrowUp size={15} />
              </span>
              <strong className="tabular" style={{ color: 'var(--traffic-up)' }}>
                {speed(upRate)}
              </strong>
              <small className="tabular">{cycleUp !== undefined ? `周期 ${bytes(cycleUp)}` : ''}</small>
            </div>
            <div className="lumina-traffic-stat" title="下行速率与当前周期下行流量">
              <span className="lumina-traffic-direction">
                <ArrowDown size={15} />
              </span>
              <strong className="tabular" style={{ color: 'var(--traffic-down)' }}>
                {speed(downRate)}
              </strong>
              <small className="tabular">{cycleDown !== undefined ? `周期 ${bytes(cycleDown)}` : ''}</small>
            </div>
            <div className="lumina-traffic-pulse-wrap">
              <button
                type="button"
                className="lumina-pulse-btn"
                aria-label="查看流量趋势"
                title="点击查看流量趋势"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  setTrafficOpen(true)
                }}
              >
                <LuminaTrafficPulse samples={server.daily_traffic} />
              </button>
            </div>
          </div>
        )}

        {server.traffic_used !== undefined && (
          <div className="lumina-quota" title={`流量阈值 · 剩余 ${server.traffic_limit ? bytes(server.traffic_limit - server.traffic_used) : ''}`}>
            <div className="lumina-quota-head">
              <span className="lumina-quota-label">
                <Database size={13} />
                <span>剩余流量</span>
                <strong>{server.traffic_limit ? bytes(Math.max(0, server.traffic_limit - server.traffic_used)) : bytes(server.traffic_used)}</strong>
                {(() => {
                  // 周期重置倒计时 + 重置日 (主控 period_end, 如 2026-08-31)
                  if (!server.period_end) return null
                  const days = Math.ceil((new Date(`${server.period_end}T23:59:59`).getTime() - Date.now()) / 86400000)
                  if (days < 0) return null
                  return <span className="lumina-quota-reset" title={`流量周期 ${server.period_start ?? ''} ~ ${server.period_end}`}>{`重置 ${server.period_end.slice(5)} · 剩 ${days} 天`}</span>
                })()}
              </span>
              <span className="lumina-quota-usage tabular">{server.traffic_limit ? `${bytes(server.traffic_used)} / ${bytes(server.traffic_limit)}` : ''}</span>
            </div>
            <div className="lumina-quota-track" aria-hidden>
              {Array.from({ length: LUMINA_QUOTA_SEGMENTS }, (_, i) => {
                const lit = i < luminaQuotaLitCount(trafficFraction)
                return (
                  <span
                    key={i}
                    className={lit ? 'lit' : ''}
                    style={
                      lit
                        ? {
                            background: LUMINA_HEAT_GRADIENT,
                            backgroundSize: `${LUMINA_QUOTA_SEGMENTS * 100}% 100%`,
                            backgroundPosition: `${(i / (LUMINA_QUOTA_SEGMENTS - 1)) * 100}% 0`,
                          }
                        : undefined
                    }
                  />
                )
              })}
            </div>
          </div>
        )}

        <div className="lumina-health">
          <div className="lumina-health-item">
            <div className="lumina-health-head">
              <span className="lumina-health-label">
                <Clock3 size={13} />
                <select
                  className="lumina-health-select"
                  value={healthTarget}
                  aria-label="延迟展示内容"
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                  onChange={(event) => {
                    event.stopPropagation()
                    setHealthTarget(event.target.value)
                  }}
                >
                  <option value="__avg__">平均延迟</option>
                  {pingList.map((item) => (
                    <option key={item.key || item.label} value={item.key || item.label}>{item.label}</option>
                  ))}
                </select>
                <ChevronDown size={10} className="lumina-health-select-arrow" aria-hidden />
              </span>
              <strong className="tabular" style={{ color: currentMs === null ? 'var(--text-tertiary)' : currentMs < 60 ? 'var(--status-success)' : currentMs < 120 ? 'var(--status-warning)' : 'var(--status-error)' }}>
                {currentMs === null ? '—' : `${Math.round(currentMs)}`}
                <small>ms</small>
              </strong>
            </div>
            <button
              type="button"
              className="lumina-health-bars-btn"
              aria-label="查看延迟趋势"
              title="点击查看延迟趋势"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                setHealthTrend('latency')
              }}
            >
              <LuminaHealthBars buckets={pingCurrent.buckets} kind="latency" />
            </button>
          </div>
          <div className="lumina-health-item">
            <div className="lumina-health-head">
              <span className="lumina-health-label">
                <Unplug size={13} />
                丢包率
              </span>
              <strong className="tabular" style={{ color: lossAvg < 0 ? 'var(--text-tertiary)' : lossAvg < 1 ? 'var(--status-success)' : lossAvg < 5 ? 'var(--status-warning)' : 'var(--status-error)' }}>
                {lossAvg < 0 ? '—' : lossAvg.toFixed(1)}
                <small>%</small>
              </strong>
            </div>
            <button
              type="button"
              className="lumina-health-bars-btn"
              aria-label="查看丢包率趋势"
              title="点击查看丢包率趋势"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                setHealthTrend('loss')
              }}
            >
              <LuminaHealthBars buckets={pingCurrent.buckets} kind="loss" />
            </button>
          </div>
        </div>

        {!!server.return_routes?.length && (
          <ReturnRouteBadges routes={server.return_routes} telecomPaidPeer={server.telecom_paid_peer} variant="lumina" />
        )}

        <footer className="lumina-card-footer">
          <span className="lumina-footer-stat" title="运行时间">
            <RefreshCw size={13} />
            <span>在线</span>
            <strong className="tabular">{server.uptime !== undefined ? formatUptime(server.uptime) : '—'}</strong>
          </span>
          <span className={`lumina-footer-stat${expiring(server) || expired(server) ? ' warn' : ''}`} title="到期时间">
            <Calendar size={13} />
            <span>到期</span>
            <strong className="tabular">{expireValue ?? '—'}</strong>
          </span>
          {renewText && (
            <span className="lumina-price-chip" title="续费价格">
              <CircleDollarSign size={12} />
              {renewText}
            </span>
          )}
        </footer>
      </article>
      {healthTrend && (
        <TrendDialog
          serverIndex={index}
          initial={[{ ...averagePing(pingList), key: '__avg__' }, ...pingList]}
          targetKey={healthTarget}
          title={pingCurrent.label}
          mode={healthTrend}
          close={() => setHealthTrend(null)}
        />
      )}
      {trafficOpen && <TrafficDialog server={server} close={() => setTrafficOpen(false)} />}
      {loadOpen && <LoadTrendDialog serverName={name} title={name} close={() => setLoadOpen(false)} />}
      {cpuOpen && <SystemTrendDialog serverIndex={index} title={name} metric="cpu" close={() => setCpuOpen(false)} />}
      {memOpen && <SystemTrendDialog serverIndex={index} title={name} metric="mem" close={() => setMemOpen(false)} />}
    </>
  )
}

function ServerCard({ server, index }: { server: ProbeServer; index: number }) {
  const [trafficOpen, setTrafficOpen] = useState(false)
  const name = server.name || `服务器 ${index + 1}`
  const flag = regionFlag(server.region)
  return (
    <>
    <article className="server-card" onClick={() => { location.hash = `#/server/${index}` }} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); location.hash = `#/server/${index}` } }} title="点击查看详情">
      <div className="server-title">
        <span className={server.online ? 'status online' : 'status'} />
        <h2>
          <Twemoji>{flag && !hasLeadingFlag(name) ? `${flag} ${name}` : name}</Twemoji>
        </h2>
        <span title={systemTitle(server)} onClick={(event) => event.stopPropagation()}>
          <SystemIcon server={server} />
        </span>
        <span>
          {server.online ? '在线' : '离线'}
          <i className="detail-hint">详情 ›</i>
        </span>
      </div>
      <div className="metrics">
        {server.cpu_pct !== undefined && <Meter icon={<Cpu size={14} />} label="CPU" value={`${server.cpu_pct.toFixed(1)}%`} percent={server.cpu_pct} />}
        {server.mem_total !== undefined && <Meter icon={<MemoryStick size={14} />} label="内存" value={`${pct(server.mem_used, server.mem_total).toFixed(1)}%`} percent={pct(server.mem_used, server.mem_total)} />}
        {server.disk_total !== undefined && <Meter icon={<HardDrive size={14} />} label="硬盘" value={`${pct(server.disk_used, server.disk_total).toFixed(1)}%`} percent={pct(server.disk_used, server.disk_total)} />}
        {server.traffic_used !== undefined && (
          <button
            type="button"
            className="metric metric-button"
            title="查看日流量趋势"
            onClick={(event) => {
              event.stopPropagation()
              setTrafficOpen(true)
            }}
          >
            <div className="metric-head">
              <span>
                <PieChart size={14} />
                流量
              </span>
              <strong>
                {server.traffic_limit ? `${bytes(server.traffic_used, false)} / ${bytes(server.traffic_limit, false)}` : bytes(server.traffic_used, false)}
              </strong>
            </div>
            <div className="meter">
              <i style={{ width: `${pct(server.traffic_used, server.traffic_limit)}%` }} />
            </div>
          </button>
        )}
      </div>
      {(server.upload_speed !== undefined || server.download_speed !== undefined) && (
        <div className="speed">
          <span className="download">
            <ArrowDown size={16} />
            {speed(server.download_speed)}
          </span>
          <span className="upload">
            <ArrowUp size={16} />
            {speed(server.upload_speed)}
          </span>
        </div>
      )}
      {!!server.ping?.length && <PingPanel ping={server.ping} serverIndex={index} />}
      {!!server.return_routes?.length && <ReturnRouteBadges routes={server.return_routes} telecomPaidPeer={server.telecom_paid_peer} variant={document.documentElement.classList.contains('theme-anime') ? 'anime' : undefined} />}
      {(server.expires_at || server.renewal_price !== undefined) && (
        <div className="server-meta" onClick={(event) => event.stopPropagation()}>
          {server.expires_at &&
            (server.provider_url ? (
              <a href={server.provider_url} target="_blank" rel="noopener noreferrer" className={expiring(server) || expired(server) ? 'warning' : ''} title={server.provider_name ? `前往 ${server.provider_name} 续费` : '前往服务商续费'}>
                <CalendarClock size={13} />
                {remainingDays(server.expires_at)}
              </a>
            ) : (
              <span className={expiring(server) || expired(server) ? 'warning' : ''}>
                <CalendarClock size={13} />
                {remainingDays(server.expires_at)}
              </span>
            ))}
          {server.renewal_price !== undefined && (
            <span>
              <Wallet size={13} />
              {server.renewal_price_cny !== undefined ? `¥${server.renewal_price_cny.toFixed(2)}` : `${server.renewal_currency || 'CNY'} ${server.renewal_price}`} / {cycleLabel[server.renewal_cycle || 'month']}
              {server.renewal_price_cny !== undefined && server.renewal_currency !== 'CNY' && (
                <small>
                  （{server.renewal_currency} {server.renewal_price}）
                </small>
              )}
            </span>
          )}
        </div>
      )}
    </article>
    {trafficOpen && <TrafficDialog server={server} close={() => setTrafficOpen(false)} />}
    </>
  )
}

function MiniReturnRoutes({ server }: { server: ProbeServer }) {
  const byCarrier = new Map((server.return_routes || []).map((route) => [route.carrier, route]))
  const carriers = (['telecom', 'unicom', 'mobile'] as const).filter((carrier) => {
    const route = byCarrier.get(carrier)
    return !!route?.route_type && route.route_type.toLowerCase() !== 'unknown'
  })
  if (!carriers.length) return null
  return (
    <span className="mini-routes">
      {carriers.map((carrier) => {
        const route = byCarrier.get(carrier)!
        const detectedRouteType = displayReturnRoute(route.route_type || 'Unknown')
        const routeType = carrier === 'telecom' && server.telecom_paid_peer && detectedRouteType === '163' ? '163 PP' : detectedRouteType
        const premium = goldRoutes.has(routeType.toUpperCase().replace(/[^A-Z0-9]/g, ''))
        return (
          <span key={carrier} className={premium ? 'mini-route gold' : 'mini-route'} title={route.region ? `${route.region} · ${routeType}` : routeType}>
            <small>{routeCarrierLabels[carrier]}</small>
            <strong>{routeType}</strong>
          </span>
        )
      })}
    </span>
  )
}

function ServerMiniCard({ server, index, expanded }: { server: ProbeServer; index: number; expanded: boolean }) {
  const name = server.name || `服务器 ${index + 1}`
  const flag = regionFlag(server.region)
  const memPct = server.mem_total ? pct(server.mem_used, server.mem_total) : undefined
  const diskPct = server.disk_total ? pct(server.disk_used, server.disk_total) : undefined
  const traffic = server.traffic_limit ? `${bytes(server.traffic_used, false)}/${bytes(server.traffic_limit, false)}` : server.traffic_used !== undefined ? bytes(server.traffic_used, false) : undefined
  const dying = server.expires_at && (expiring(server) || expired(server))
  const pingAvg = server.ping?.length ? averagePing(server.ping) : undefined
  return (
    <article className={`server-mini-card${expanded ? ' expanded' : ''}`} onClick={() => { location.hash = `#/server/${index}` }} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); location.hash = `#/server/${index}` } }} title="点击查看详情">
      <div className="mini-top">
        <span className={server.online ? 'status online' : 'status'} />
        <h2 className="mini-name">
          <Twemoji>{flag && !hasLeadingFlag(name) ? `${flag} ${name}` : name}</Twemoji>
        </h2>
        {expanded && <MiniReturnRoutes server={server} />}
        {!expanded && (
          <div className="mini-metrics">
            {server.cpu_pct !== undefined && (
              <span title={`CPU ${server.cpu_pct.toFixed(1)}%`}>
                <Cpu size={12} />
                {server.cpu_pct.toFixed(0)}%
              </span>
            )}
            {memPct !== undefined && (
              <span title={`内存 ${memPct.toFixed(1)}%`}>
                <MemoryStick size={12} />
                {memPct.toFixed(0)}%
              </span>
            )}
            {traffic !== undefined && (
              <span title={`流量 ${traffic}`}>
                <PieChart size={12} />
                {server.traffic_limit ? `${pct(server.traffic_used, server.traffic_limit).toFixed(0)}%` : bytes(server.traffic_used, false)}
              </span>
            )}
            {server.download_speed !== undefined && (
              <span className="mini-speed" title={`下行 ${speed(server.download_speed)}${server.upload_speed !== undefined ? ` / 上行 ${speed(server.upload_speed)}` : ''}`}>
                <ArrowDown size={12} />
                {speed(server.download_speed)}
              </span>
            )}
          </div>
        )}
        {expanded && (
          <span className={server.online ? 'mini-state online' : 'mini-state'}>
            {server.online ? '在线' : '离线'}
          </span>
        )}
        {dying && <span className="mini-expiry">{remainingDays(server.expires_at)}</span>}
      </div>
      {expanded && (
        <div className="mini-detail mini-resources">
          {server.cpu_pct !== undefined && (
            <span title={`CPU ${server.cpu_pct.toFixed(1)}%`}>
              <Cpu size={12} />
              {server.cpu_pct.toFixed(1)}%
            </span>
          )}
          {memPct !== undefined && (
            <span title={`内存 ${bytes(server.mem_used, false)} / ${bytes(server.mem_total, false)}`}>
              <MemoryStick size={12} />
              {memPct.toFixed(1)}%
            </span>
          )}
          {diskPct !== undefined && (
            <span title={`硬盘 ${bytes(server.disk_used, false)} / ${bytes(server.disk_total, false)}`}>
              <HardDrive size={12} />
              {diskPct.toFixed(1)}%
            </span>
          )}
          {traffic !== undefined && (
            <span title={`流量 ${traffic}`}>
              <PieChart size={12} />
              {traffic}
            </span>
          )}
          {server.renewal_price !== undefined && (
            <span title={`续费 ${server.renewal_price_cny !== undefined ? `¥${server.renewal_price_cny.toFixed(2)}` : `${server.renewal_currency || 'CNY'} ${server.renewal_price}`} / ${cycleLabel[server.renewal_cycle || 'month']}`}>
              <Wallet size={12} />
              {server.renewal_price_cny !== undefined ? `¥${server.renewal_price_cny.toFixed(0)}` : `${server.renewal_currency || 'CNY'} ${server.renewal_price}`}
            </span>
          )}
          {server.expires_at && (
            <span className={expiring(server) || expired(server) ? 'mini-due' : ''} title={`到期 ${server.expires_at}`}>
              <CalendarClock size={12} />
              {server.expires_at}
            </span>
          )}
        </div>
      )}
      {expanded && (
        <div className="mini-detail mini-latency">
          {pingAvg && (
            <span title={`平均延迟 ${pingAvg.current_ms < 0 ? '超时' : `${pingAvg.current_ms.toFixed(0)} ms`}`}>
              <Gauge size={12} />
              {pingAvg.current_ms < 0 ? '超时' : `${pingAvg.current_ms.toFixed(0)}ms`}
            </span>
          )}
          {pingAvg && (
            <span className={pingAvg.loss_pct > 0 ? 'mini-loss' : ''} title={`丢包率 ${pingAvg.loss_pct.toFixed(1)}%`}>
              <Wifi size={12} />
              {pingAvg.loss_pct.toFixed(1)}%
            </span>
          )}
          {server.download_speed !== undefined && (
            <span title={`下行 ${speed(server.download_speed)}`}>
              <ArrowDown size={12} />
              {speed(server.download_speed)}
            </span>
          )}
          {server.upload_speed !== undefined && (
            <span title={`上行 ${speed(server.upload_speed)}`}>
              <ArrowUp size={12} />
              {speed(server.upload_speed)}
            </span>
          )}
        </div>
      )}
    </article>
  )
}

function TableMetric({ percent }: { percent?: number }) {
  if (percent === undefined) return <span className="dash">—</span>
  return (
    <div className="table-metric">
      <span>{percent.toFixed(1)}%</span>
      <div className="meter">
        <i style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
      </div>
    </div>
  )
}

function TablePing({ ping, serverIndex }: { ping?: ProbePingSeries[]; serverIndex: number }) {
  const [open, setOpen] = useState(false)
  if (!ping?.length) return <span className="dash">—</span>
  const average = averagePing(ping)
  const lines = [{ ...average, key: '__avg__' }, ...ping]
  return (
    <>
      <button className="table-ping" type="button" onClick={(event) => { event.stopPropagation(); setOpen(true) }}>
        <span>
          <strong>{average.current_ms < 0 ? '超时' : `${average.current_ms.toFixed(0)} ms`}</strong>
          <b>{average.loss_pct.toFixed(1)}%</b>
        </span>
        <em>
          {average.buckets.map((bucket, index) => (
            <i key={index} className={bucket.ms < 0 && bucket.loss < 0 ? 'none' : bucket.ms < 0 ? 'bad' : bucket.ms >= 200 ? 'warn' : 'good'} />
          ))}
        </em>
      </button>
      {open && <TrendDialog serverIndex={serverIndex} initial={lines} targetKey="__avg__" title="平均" mode="latency" close={() => setOpen(false)} />}
    </>
  )
}

type SortKey = 'name' | 'online' | 'cpu' | 'memory' | 'disk' | 'speed' | 'traffic' | 'ping'
type SortDir = 'asc' | 'desc'

function sortValue(server: ProbeServer, key: SortKey): number | string {
  switch (key) {
    case 'name':
      return server.name || ''
    case 'online':
      return server.online ? 1 : 0
    case 'cpu':
      return server.cpu_pct ?? -1
    case 'memory':
      return server.mem_total ? pct(server.mem_used, server.mem_total) : -1
    case 'disk':
      return server.disk_total ? pct(server.disk_used, server.disk_total) : -1
    case 'speed':
      return server.download_speed ?? -1
    case 'traffic':
      return server.traffic_limit ? pct(server.traffic_used, server.traffic_limit) : (server.traffic_used ?? -1)
    case 'ping':
      return averagePing(server.ping || []).current_ms
  }
}

function ServerTable({ servers }: { servers: ProbeServer[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const rows = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return servers
      .map((server, index) => ({ server, index }))
      .sort((a, b) => {
        const va = sortValue(a.server, sortKey)
        const vb = sortValue(b.server, sortKey)
        if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb) * dir
        return ((va as number) - (vb as number)) * dir
      })
  }, [servers, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  const sortHeader = (label: string, key: SortKey) => (
    <th
      className={key === sortKey ? `sortable sorted ${sortDir}` : 'sortable'}
      aria-sort={key === sortKey ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      onClick={() => toggleSort(key)}
    >
      {label}
      {key === sortKey && <span className="sort-arrow" aria-hidden="true">{sortDir === 'asc' ? '▲' : '▼'}</span>}
    </th>
  )

  return (
    <section className="server-table-wrap">
      <div className="table-scroll">
        <table className="server-table">
          <thead>
            <tr>
              {sortHeader('服务器', 'name')}
              {sortHeader('状态', 'online')}
              {sortHeader('CPU', 'cpu')}
              {sortHeader('内存', 'memory')}
              {sortHeader('硬盘', 'disk')}
              {sortHeader('网速', 'speed')}
              {sortHeader('流量', 'traffic')}
              {sortHeader('延迟', 'ping')}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ server, index }) => {
              const memory = server.mem_total ? pct(server.mem_used, server.mem_total) : undefined
              const disk = server.disk_total ? pct(server.disk_used, server.disk_total) : undefined
              return (
                <tr key={`${server.name}-${index}`} className="table-row-link" onClick={() => { location.hash = `#/server/${index}` }} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); location.hash = `#/server/${index}` } }}>
                  <td className="table-name">
                    <Twemoji>{server.name || `服务器 ${index + 1}`}</Twemoji>
                    {server.region && <small>{server.region}</small>}
                    {server.expires_at &&
                      (server.provider_url ? (
                        <a href={server.provider_url} target="_blank" rel="noopener noreferrer" className={expiring(server) ? 'warning' : ''} title={server.provider_name ? `前往 ${server.provider_name} 续费` : '前往服务商续费'} onClick={(event) => event.stopPropagation()}>
                          {server.expires_at}
                        </a>
                      ) : (
                        <small className={expiring(server) ? 'warning' : ''}>{server.expires_at}</small>
                      ))}
                  </td>
                  <td>
                    <span className="table-status">
                      <i className={server.online ? 'online' : ''} />
                      {server.online ? '在线' : '离线'}
                    </span>
                  </td>
                  <td>
                    <TableMetric percent={server.cpu_pct} />
                  </td>
                  <td>
                    <TableMetric percent={memory} />
                  </td>
                  <td>
                    <TableMetric percent={disk} />
                  </td>
                  <td>
                    <span className="table-speed">
                      <span>
                        <ArrowUp size={14} />
                        {speed(server.upload_speed)}
                      </span>
                      <span>
                        <ArrowDown size={14} />
                        {speed(server.download_speed)}
                      </span>
                    </span>
                  </td>
                  <td>
                    <div className="table-traffic">
                      <span>{server.traffic_limit ? `${bytes(server.traffic_used, false)} / ${bytes(server.traffic_limit, false)}` : bytes(server.traffic_used, false)}</span>
                      {!!server.traffic_limit && (
                        <div className="meter">
                          <i
                            style={{
                              width: `${pct(server.traffic_used, server.traffic_limit)}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <TablePing ping={server.ping} serverIndex={index} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ProbeLicenseNameplate({ name, displayName }: { name?: string; displayName?: string }) {
  const label = [name?.trim(), displayName?.trim()].filter(Boolean).join(' · ')
  const plateRef = useRef<HTMLSpanElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const starsRef = useRef<HTMLSpanElement>(null)
  const shineRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const plate = plateRef.current
    const text = textRef.current
    const stars = starsRef.current
    const shine = shineRef.current
    if (!plate || !text || !stars || !shine) return

    const palette = ['#f9a8d4', '#f472b6', '#ec4899', '#fbcfe8', '#ff8fc7']
    const random = (min: number, max: number) => min + Math.random() * (max - min)
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
    const easeOutBack = (value: number) => {
      const c1 = 1.70158
      const c3 = c1 + 1
      return 1 + c3 * Math.pow(value - 1, 3) + c1 * Math.pow(value - 1, 2)
    }
    const easeInBack = (value: number) => {
      const c1 = 1.70158
      return (c1 + 1) * value * value * value - c1 * value * value
    }

    stars.innerHTML = ''
    const height = stars.clientHeight || 24
    const makeStar = (topFor: (size: number) => number) => {
      const star = document.createElement('i')
      star.className = 'spark'
      star.style.color = palette[Math.floor(Math.random() * palette.length)]
      const size = Math.round(random(8, 13))
      star.style.width = `${size}px`
      star.style.height = `${size}px`
      star.style.top = `${Math.round(topFor(size))}px`
      star.style.left = `${Math.round(random(0, 12))}px`
      stars.appendChild(star)
    }
    for (let index = 0; index < 5; index++) makeStar((size) => random(0, Math.max(0, height - size)))
    makeStar((size) => -size * 0.6)
    makeStar((size) => height - size * 0.4)

    let width = plate.offsetWidth
    const updateWidth = () => { width = plate.offsetWidth }
    window.addEventListener('resize', updateWidth)
    let frameID = 0
    const start = performance.now()
    const frame = (now: number) => {
      const progress = ((now - start) % 5500) / 5500
      const reveal = clamp(progress / 0.36, 0, 1)
      let rotateX = 0
      let scale = 1
      let opacity = 1
      if (progress < 0.08) {
        const amount = progress / 0.08
        const eased = easeOutBack(amount)
        rotateX = -92 * (1 - eased)
        scale = 0.86 + 0.14 * eased
        opacity = clamp(amount * 2.2, 0, 1)
      } else if (progress > 0.85) {
        const amount = (progress - 0.85) / 0.15
        const eased = easeInBack(amount)
        rotateX = 84 * eased
        scale = 1 - 0.14 * eased
        opacity = clamp(1 - amount * 1.5, 0, 1)
      }
      const starOpacity = progress < 0.04 ? progress / 0.04 : progress < 0.32 ? 1 : progress < 0.37 ? clamp(1 - (progress - 0.32) / 0.05, 0, 1) : 0
      const shineProgress = clamp((progress - 0.42) / 0.28, 0, 1)
      const shineActive = progress >= 0.42 && progress <= 0.7
      const shineOpacity = shineActive ? (shineProgress < 0.1 ? shineProgress / 0.1 : shineProgress > 0.85 ? clamp((1 - shineProgress) / 0.15, 0, 1) : 1) : 0

      plate.style.opacity = String(opacity)
      plate.style.transform = `perspective(340px) rotateX(${rotateX.toFixed(2)}deg) scale(${scale.toFixed(3)})`
      text.style.clipPath = `inset(0 ${((1 - reveal) * 100).toFixed(2)}% 0 0)`
      stars.style.transform = `translateX(${(13 + reveal * (width - 26)).toFixed(1)}px)`
      stars.style.opacity = String(starOpacity)
      shine.style.transform = `translateX(${(((-55 + shineProgress * 165) / 100) * width).toFixed(1)}px) skewX(-16deg)`
      shine.style.opacity = String(shineOpacity)
      frameID = requestAnimationFrame(frame)
    }
    frameID = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(frameID)
      window.removeEventListener('resize', updateWidth)
    }
  }, [])

  if (!label) return null
  return (
    <span ref={plateRef} className="probe-license-nameplate">
      <strong ref={textRef} className="probe-license-text">{label}</strong>
      <span className="probe-license-shine-clip" aria-hidden="true">
        <span ref={shineRef} className="probe-license-shine" />
      </span>
      <span ref={starsRef} className="probe-license-stars" aria-hidden="true" />
    </span>
  )
}

// 主控端仅支持单个许可证，这里补充展示其它已获得的许可证铭牌（按 name 去重合并）。
// 数组顺序即页面展示顺序。
const EXTRA_LICENSE_BADGES = [
  { name: '👑 幸运EX', display_name: '🌠 天选之子' },
  { name: '💍「誓约」· 白誓之印', display_name: '🎉 妙妙屋X上线纪念' },
  { name: '👑 听海', display_name: '🌊 潮起无声' },
]

// daily_traffic 跨周期历史: Worker cron 按天合并缓存(KV, 90天), 前端页面加载拉一次(日期变化时刷新),
// 与 payload 的 daily_traffic(当前周期)合并 → 周期重置后脉冲图/日流量趋势仍有历史
type DailyHistory = Record<string, Record<string, [number, number, number]>>
function useDailyHistory(): DailyHistory | null {
  const [history, setHistory] = useState<DailyHistory | null>(null)
  useEffect(() => {
    let stopped = false
    let day = new Date().toISOString().slice(0, 10)
    const load = async () => {
      try {
        const resp = await fetch('/api/daily-history', { cache: 'no-store' })
        if (!resp.ok) return
        const payload = (await resp.json()) as { success?: boolean; history?: DailyHistory }
        if (stopped) return
        const h = payload.history
        if (h && Object.keys(h).length) setHistory(h)
      } catch {
        // 历史不可用不影响主流程
      }
    }
    void load()
    const timer = window.setInterval(() => {
      const today = new Date().toISOString().slice(0, 10)
      if (today !== day) {
        day = today
        void load()
      }
    }, 60_000)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [])
  return history
}

// 合并: 历史(按服务器名) 为底, payload 当天数据覆盖(最新值), 按日期排序。
// 附加 cycle_daily_traffic = payload 原始周期内数据(周期拆分比例用, 避免被 90 天历史污染)
type DailyRow = NonNullable<ProbeServer['daily_traffic']>[number]
type EnrichedServer = ProbeServer & { cycle_daily_traffic?: DailyRow[] }
function mergeDailyTraffic(servers: ProbeServer[], history: DailyHistory | null): EnrichedServer[] {
  if (!history || !Object.keys(history).length) return servers
  return servers.map((server) => {
    const name = server.name?.trim()
    if (!name) return server
    const byDate = new Map<string, { uplink: number; downlink: number; total: number }>()
    for (const [date, recs] of Object.entries(history)) {
      const rec = recs?.[name]
      if (rec) byDate.set(date, { uplink: rec[0], downlink: rec[1], total: rec[2] })
    }
    for (const row of server.daily_traffic || []) {
      if (row?.date) byDate.set(row.date, { uplink: row.uplink ?? 0, downlink: row.downlink ?? 0, total: row.total ?? 0 })
    }
    if (!byDate.size) return server
    const merged = [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, rec]) => ({ date, uplink: rec.uplink, downlink: rec.downlink, total: rec.total }))
    return { ...server, daily_traffic: merged, cycle_daily_traffic: server.daily_traffic || [] }
  })
}

export function App() {
  const { data, error } = useProbe()
  const dailyHistory = useDailyHistory()
  const servers = useMemo(() => mergeDailyTraffic(data?.servers || [], dailyHistory), [data, dailyHistory])
  const [view, setView] = useState<'card' | 'list' | 'mini'>(() => (localStorage.getItem('probe-view') as 'card' | 'list' | 'mini') || 'card')
  const [miniExpanded, setMiniExpanded] = useState<boolean>(() => localStorage.getItem('probe-mini-expanded') === '1')
  const [filter, setFilter] = useState<'all' | 'online' | 'offline' | 'expiring' | 'expired' | 'renewal'>('all')
  const [region, setRegion] = useState('all')
  const [search, setSearch] = useState('')
  const [globeOpen, setGlobeOpen] = useState(false)
  const [summaryCollapsed, setSummaryCollapsed] = useState<Set<string>>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('probe-summary-collapsed') || '[]')
      return new Set(Array.isArray(raw) ? raw.filter((k): k is string => typeof k === 'string') : [])
    } catch {
      return new Set()
    }
  })
  const toggleSummary = (key: string) => {
    setSummaryCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      localStorage.setItem('probe-summary-collapsed', JSON.stringify([...next]))
      return next
    })
  }
  const [theme, setThemeState] = useState<ThemeName | null>(() => getThemeOverride())
  const [activeTheme, setActiveTheme] = useState<string>(() => getActiveTheme())
  // 主控下发主题变化（如自定义主题名）→ 同步 activeTheme（用户手动 override 时不覆盖）
  useEffect(() => {
    if (data?.appearance?.theme && !getThemeOverride()) {
      setActiveTheme(getActiveTheme())
    }
  }, [data?.appearance?.theme])
  const [darkMode, setDarkMode] = useState<string | null>(() => getDarkOverride())
  const [detailIndex, setDetailIndex] = useState<number | null>(() => {
    const match = /^#\/server\/(\d+)$/.exec(window.location.hash)
    return match ? Number(match[1]) : null
  })
  const detailScrollRef = useRef(0)
  useEffect(() => {
    const onHashChange = () => {
      const match = /^#\/server\/(\d+)$/.exec(window.location.hash)
      const next = match ? Number(match[1]) : null
      if (next !== null) {
        // 打开详情页：记录主页面滚动位置，供关闭时恢复
        detailScrollRef.current = window.scrollY
      } else {
        // 关闭详情页：恢复到最后浏览的位置
        window.scrollTo(0, detailScrollRef.current)
      }
      setDetailIndex(next)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])
  const closeDetail = useCallback(() => {
    history.replaceState(null, '', window.location.pathname + window.location.search)
    setDetailIndex(null)
    window.scrollTo(0, detailScrollRef.current)
  }, [])
  const isDark = darkMode === 'dark' || (darkMode === null && document.documentElement.classList.contains('dark'))
  const toggleDark = () => {
    const next = isDark ? 'light' : 'dark'
    setDarkOverride(next)
    setDarkMode(next)
  }
  const setMode = (next: 'card' | 'list' | 'mini') => {
    setView(next)
    localStorage.setItem('probe-view', next)
  }
  const toggleMiniExpanded = () => {
    setMiniExpanded((prev) => {
      const next = !prev
      localStorage.setItem('probe-mini-expanded', next ? '1' : '0')
      return next
    })
  }
  if (!data && !error)
    return (
      <main className="center">
        <Activity className="pulse" />
        正在连接主控…
      </main>
    )
  if (error && !data)
    return (
      <main className="center error">
        主控暂时不可用
        <br />
        <small>{error}</small>
      </main>
    )
  if (!data?.enabled) return <main className="center">探针尚未启用</main>
  const title = data.title?.trim() || '服务器状态'
  const onlineCount = servers.filter((server) => server.online).length
  const expiringCount = servers.filter(expiring).length
  const expiredCount = servers.filter(expired).length
  const renewalCount = servers.filter((server) => expiring(server) || expired(server)).length
  const regions = [...new Set(servers.map((server) => server.region?.trim()).filter((value): value is string => !!value))].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  const hasExpiry = servers.some((server) => !!server.expires_at)
  const query = search.trim().toLowerCase()
  const visible = servers.filter((server) => {
    const matchesStatus = filter === 'all' || (filter === 'online' && server.online) || (filter === 'offline' && !server.online) || (filter === 'expiring' && expiring(server)) || (filter === 'expired' && expired(server)) || (filter === 'renewal' && (expiring(server) || expired(server)))
    if (!matchesStatus) return false
    if (region !== 'all' && server.region?.trim() !== region) return false
    if (query) {
      const haystack = [server.name, server.region, server.region_name, server.region_city, server.region_country, server.provider_name].filter(Boolean).join(' ').toLowerCase()
      if (!haystack.includes(query)) return false
    }
    return true
  })
  const hasSpeed = servers.some((server) => server.upload_speed !== undefined || server.download_speed !== undefined)
  const totalUpload = servers.reduce((sum, server) => sum + (server.upload_speed || 0), 0)
  const totalDownload = servers.reduce((sum, server) => sum + (server.download_speed || 0), 0)
  return (
    <div className={data.license_badge ? 'app-shell has-license-footer' : 'app-shell'}>
      <header className="topbar">
        <div>
          {data.logo && <img src={data.logo} alt="" />}
          <h1>{title}</h1>
        </div>
        <nav>
          <button aria-label="卡片视图" title="卡片视图" className={view === 'card' ? 'active' : ''} onClick={() => setMode('card')}>
            <LayoutGrid size={18} />
          </button>
          <button aria-label={miniExpanded ? '极简卡片展开视图' : '极简卡片视图'} title={view === 'mini' ? (miniExpanded ? '极简卡片展开视图（再点收起）' : '极简卡片视图（再点展开多行）') : '极简卡片视图'} className={view === 'mini' ? 'active' : ''} onClick={() => { if (view === 'mini') { toggleMiniExpanded() } else { setMode('mini') } }}>
            {miniExpanded ? <Rows4 size={18} /> : <Rows3 size={18} />}
          </button>
          <button aria-label="列表视图" title="列表视图" className={view === 'list' ? 'active' : ''} onClick={() => setMode('list')}>
            <List size={18} />
          </button>
          <button aria-label="切换暗色模式" title={isDark ? '切换浅色模式' : '切换暗色模式'} onClick={toggleDark}>
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <ThemeSelect value={theme} onChange={(name) => { setTheme(name); setThemeState(name); setActiveTheme(name ?? getActiveTheme()) }} />
        </nav>
      </header>
      <section className="dashboard-summary">
        <article className={`summary-card collapse-card${summaryCollapsed.has('nodes') ? ' collapsed' : ' open'}`}>
          <button
            className="summary-toggle"
            type="button"
            aria-expanded={!summaryCollapsed.has('nodes')}
            aria-label={summaryCollapsed.has('nodes') ? '展开节点情况' : '折叠节点情况'}
            onClick={() => toggleSummary('nodes')}
          >
            <span>
              <Server size={18} />
              节点情况
            </span>
            <span className="summary-toggle-info">
              {summaryCollapsed.has('nodes') && (
                <>
                  <b>{servers.length} 总</b>
                  <b className="ok">{onlineCount} 在线</b>
                  <b className="bad">{servers.length - onlineCount} 离线</b>
                  {hasExpiry && (
                    <em>
                      <CalendarClock size={12} />
                      待续费 {renewalCount}
                    </em>
                  )}
                </>
              )}
              <ChevronDown size={17} />
            </span>
          </button>
          {!summaryCollapsed.has('nodes') && (
            <div className="collapse-body">
              <div className="node-stats">
                <button onClick={() => setFilter('all')}>
                  <strong>{servers.length}</strong>
                  <span>
                    <Server size={14} />
                    总节点
                  </span>
                </button>
                <button onClick={() => setFilter('online')} className="online">
                  <strong>{onlineCount}</strong>
                  <span>
                    <CheckCircle2 size={14} />
                    在线节点
                  </span>
                </button>
                <button onClick={() => setFilter('offline')} className="offline">
                  <strong>{servers.length - onlineCount}</strong>
                  <span>
                    <XCircle size={14} />
                    离线节点
                  </span>
                </button>
              </div>
            </div>
          )}
        </article>
        {hasSpeed && (
          <article className={`summary-card collapse-card${summaryCollapsed.has('network') ? ' collapsed' : ' open'}`}>
            <button
              className="summary-toggle"
              type="button"
              aria-expanded={!summaryCollapsed.has('network')}
              aria-label={summaryCollapsed.has('network') ? '展开网络情况' : '折叠网络情况'}
              onClick={() => toggleSummary('network')}
            >
              <span>
                <Gauge size={18} />
                网络情况
              </span>
              <span className="summary-toggle-info">
                {summaryCollapsed.has('network') && (
                  <>
                    <b>↓{bitSpeed(totalDownload)}</b>
                    <b>↑{bitSpeed(totalUpload)}</b>
                  </>
                )}
                <ChevronDown size={17} />
              </span>
            </button>
            {!summaryCollapsed.has('network') && (
              <div className="collapse-body">
                <div className="network-stats">
                  <SpeedSummary label="总下行网速" value={totalDownload} direction="down" />
                  <SpeedSummary label="总上行网速" value={totalUpload} direction="up" />
                </div>
              </div>
            )}
          </article>
        )}
        <AssetsSummary servers={servers} />
      </section>
      <div className="globe-row">
        {data.show_globe && regions.length > 0 && (
          <section className={`globe-card ${globeOpen ? 'open' : ''}`}>
            <button className="globe-toggle" type="button" aria-expanded={globeOpen} onClick={() => setGlobeOpen((value) => !value)}>
              <span>
                <Globe2 size={18} />
                地区分布
              </span>
              <span>
                {regions.length} 个地区
                <ChevronDown size={17} />
              </span>
            </button>
            {globeOpen && (
              <Suspense fallback={<div className="globe-loading">正在加载国界数据…</div>}>
                <RegionGlobe regions={servers.map((server) => server.region || '').filter(Boolean)} />
              </Suspense>
            )}
          </section>
        )}
        <Leaderboard servers={servers} />
      </div>
      <section className="probe-toolbar">
        <div className="filters">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
            全部 {servers.length}
          </button>
          <button className={filter === 'online' ? 'active' : ''} onClick={() => setFilter('online')}>
            在线 {onlineCount}
          </button>
          <button className={filter === 'offline' ? 'active' : ''} onClick={() => setFilter('offline')}>
            离线 {servers.length - onlineCount}
          </button>
          {hasExpiry && (
            <>
              <button className={filter === 'renewal' ? 'active warning' : 'warning'} onClick={() => setFilter('renewal')}>
                待续费 {renewalCount}
              </button>
              <button className={filter === 'expiring' ? 'active warning' : 'warning'} onClick={() => setFilter('expiring')}>
                即将到期 {expiringCount}
              </button>
              <button className={filter === 'expired' ? 'active danger' : 'danger'} onClick={() => setFilter('expired')}>
                已到期 {expiredCount}
              </button>
            </>
          )}
          {regions.length > 0 && (
            <RegionSelect regions={regions} value={region} onChange={setRegion} />
          )}
          <label className="server-search">
            <Search size={14} />
            <input
              type="search"
              aria-label="搜索节点"
              placeholder="搜索节点…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
      </section>
      <main className={`servers ${view}`}>{visible.length ? view === 'card' ? visible.map((server) => activeTheme === 'lumina' ? <ServerCardLumina key={server.name} server={server} index={servers.indexOf(server)} /> : <ServerCard key={server.name} server={server} index={servers.indexOf(server)} />) : view === 'mini' ? visible.map((server) => <ServerMiniCard key={server.name} server={server} index={servers.indexOf(server)} expanded={miniExpanded} />) : <ServerTable servers={visible} /> : <div className="empty">暂无符合条件的服务器</div>}</main>
      <footer>
        Powered by{' '}
        <a href="https://github.com/mmwx-group" target="_blank" rel="noreferrer">
          MMWX Group
        </a>
      </footer>
      {(data.license_badge || EXTRA_LICENSE_BADGES.length > 0) && (
        <div className="probe-license-footer">
          {(() => {
            const live = data.license_badge ? (Array.isArray(data.license_badge) ? data.license_badge : [data.license_badge]) : []
            const keyOf = (badge: { name?: string; display_name?: string }) => badge.name || badge.display_name || ''
            const merged = EXTRA_LICENSE_BADGES.map((badge) => live.find((item) => keyOf(item) === keyOf(badge)) || badge)
            const extras = live.filter((badge) => !EXTRA_LICENSE_BADGES.some((item) => keyOf(item) === keyOf(badge)))
            return [...merged, ...extras]
              .filter((badge, index, all) => all.findIndex((item) => keyOf(item) === keyOf(badge)) === index)
              .map((badge, index) => (
                <ProbeLicenseNameplate key={index} name={badge.name} displayName={badge.display_name} />
              ))
          })()}
        </div>
      )}
      {detailIndex !== null && servers[detailIndex] && (
        <ServerDetail
          server={servers[detailIndex]}
          index={detailIndex}
          onClose={closeDetail}
        />
      )}
    </div>
  )
}
