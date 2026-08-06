import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Lottie from 'lottie-react'
import { Activity, ArrowDown, ArrowDownUp, ArrowUp, BadgeDollarSign, CalendarClock, CheckCircle2, ChevronDown, ChevronUp, Clock, Cpu, Gauge, Globe2, HardDrive, LayoutGrid, List, MapPin, MemoryStick, Moon, Palette, PieChart, Rows3, Rows4, Search, Server, Sun, Trophy, Wallet, Wifi, XCircle } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ProbeBucket, ProbePingSeries, ProbeReturnRoute, ProbeServer, ThemeName } from './types'
import { cycleTheme, getDarkOverride, getThemeOverride, setDarkOverride, useProbe } from './use-probe'
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
  return `${n.toFixed(decimal && i >= 2 ? 1 : 0)} ${units[i]}`
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

type LeaderboardKey = 'cpu' | 'mem' | 'traffic' | 'speed' | 'ping-cn' | 'ping-idc'

const isCnLabel = (label: string) => /电信|联通|移动/.test(label)

function groupedPingAvg(ping: ProbePingSeries[], cn: boolean): number {
  const list = (ping || []).filter((item) => isCnLabel(item.label) === cn)
  const current = list.filter((item) => item.current_ms >= 0).map((item) => item.current_ms)
  return current.length ? current.reduce((a, b) => a + b, 0) / current.length : -1
}

const LEADERBOARD_TABS: { key: LeaderboardKey; label: string; icon: React.ReactNode }[] = [
  { key: 'cpu', label: 'CPU', icon: <Cpu size={13} /> },
  { key: 'mem', label: '内存', icon: <MemoryStick size={13} /> },
  { key: 'traffic', label: '流量', icon: <PieChart size={13} /> },
  { key: 'speed', label: '实时速度', icon: <ArrowDownUp size={13} /> },
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
      setDesc(true)
    }
    setExpanded(null)
  }
  const pingTab = tab === 'ping-cn' || tab === 'ping-idc'
  const rows = useMemo(() => {
    const indexed = servers.map((server, index) => {
      const avg = averagePing(server.ping || [])
      const value =
        tab === 'cpu' ? server.cpu_pct ?? -1
        : tab === 'mem' ? pct(server.mem_used, server.mem_total)
        : tab === 'traffic' ? server.traffic_used ?? -1
        : tab === 'speed' ? (server.download_speed ?? 0) + (server.upload_speed ?? 0)
        : tab === 'ping-cn' ? groupedPingAvg(server.ping || [], true)
        : tab === 'ping-idc' ? groupedPingAvg(server.ping || [], false)
        : avg.current_ms
      const lines = pingTab
        ? (server.ping || [])
            .filter((item) => isCnLabel(item.label) === (tab === 'ping-cn'))
            .map((item) => ({ label: item.label, ms: item.current_ms }))
        : []
      return { server, index, value, lines }
    })
    return indexed
      .filter((row) => row.value >= 0)
      .sort((a, b) => (desc ? b.value - a.value : a.value - b.value))
      .slice(0, 10)
  }, [servers, tab, desc, pingTab])
  const format = (value: number, server: ProbeServer) =>
    tab === 'cpu' || tab === 'mem' ? `${value.toFixed(1)}%`
    : tab === 'traffic' ? bytes(value, false)
    : tab === 'speed' ? `↓${speed(server.download_speed ?? 0)} ↑${speed(server.upload_speed ?? 0)}`
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
                      {pingTab && lines.length > 0 && <em className="lb-lines-count">{lines.filter((l) => l.ms >= 0).length}线</em>}
                    </span>
                  </button>
                  {pingTab && lines.length > 0 && (
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
                {pingTab && expanded === index && (
                  <div className="lb-lines">
                    {lines.map((line) => (
                      <span key={line.label} className={line.ms < 0 ? 'timeout' : ''}>
                        {line.label}
                        <b>{line.ms < 0 ? '超时' : `${line.ms.toFixed(0)} ms`}</b>
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
            {!rows.length && <li className="lb-empty">暂无数据</li>}
          </ol>
        </div>
      )}
    </section>
  )
}

function TrendDialog({ serverIndex, initial, targetKey, title, mode, close }: { serverIndex: number; initial: ProbePingSeries[]; targetKey: string; title: string; mode: 'latency' | 'loss'; close: () => void }) {
  const [range, setRange] = useState<RangeKey>('1h')
  const [group, setGroup] = useState<'all' | 'cn' | 'idc'>('all')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [series, setSeries] = useState<ProbePingSeries[]>(initial)
  const [loading, setLoading] = useState(false)

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
        }>
      })
      .then((payload) => {
        if (payload.success) setSeries([...(payload.series ? [{ ...payload.series, key: '__avg__', label: '平均' }] : []), ...(payload.all_series || [])])
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [range, serverIndex])

  const rangeMeta = ranges.find((item) => item.key === range) || ranges[0]
  const rows = useMemo(
    () =>
      Array.from({ length: displaySeries[0]?.item.buckets.length || 0 }, (_, index) => {
        const row: Record<string, string | number | null> = {
          time: rangeMeta.bucketLabel(index, displaySeries[0]?.item.buckets.length || 0),
        }
        for (const { item } of displaySeries) {
          const bucket = item.buckets[index]
          const value = mode === 'loss' ? bucket?.loss : bucket?.ms
          row[item.key || item.label] = value !== undefined && value >= 0 ? value : null
        }
        return row
      }),
    [displaySeries, mode, rangeMeta],
  )

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
        </div>
        <div className="chart">
          {loading && <div className="loading-overlay">加载中…</div>}
          {!loading && !displaySeries.length && (
            <div className="chart-empty">
              该服务器未配置{group === 'cn' ? '内地' : '海外'}探测点
            </div>
          )}
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <XAxis dataKey="time" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.max(1, Math.floor(rows.length / 8))} />
              <YAxis width={52} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} unit={mode === 'loss' ? '%' : 'ms'} domain={mode === 'loss' ? [0, 100] : undefined} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(value, _name, item) => [`${Number(value).toFixed(mode === 'loss' ? 1 : 0)}${mode === 'loss' ? '%' : 'ms'}`, series.find((line) => (line.key || line.label) === item.dataKey)?.label || String(item.dataKey)]} />
              {displaySeries.map(({ item, index }) => {
                const key = item.key || item.label
                const active = key === targetKey
                return <Line key={key} type="monotone" dataKey={key} name={item.label} stroke={key === '__avg__' ? 'var(--foreground, #2f2350)' : colors[index % colors.length]} strokeWidth={active ? 2.5 : 1} strokeOpacity={active ? 1 : 0.45} dot={false} connectNulls={false} isAnimationActive={false} />
              })}
            </LineChart>
          </ResponsiveContainer>
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

export function ReturnRouteBadges({ routes, telecomPaidPeer }: { routes: ProbeReturnRoute[]; telecomPaidPeer?: boolean }) {
  const byCarrier = new Map(routes.map((route) => [route.carrier, route]))
  return (
    <div className="return-route-badges">
      {(['telecom', 'unicom', 'mobile'] as const).map((carrier) => {
        const route = byCarrier.get(carrier)
        const detectedRouteType = displayReturnRoute(route?.route_type || 'Unknown')
        const routeType = carrier === 'telecom' && telecomPaidPeer && detectedRouteType === '163' ? '163 PP' : detectedRouteType
        const premium = goldRoutes.has(routeType.toUpperCase().replace(/[^A-Z0-9]/g, ''))
        return (
          <div className="route-badge" key={carrier} title={route?.region ? `${route.region} · ${routeType}` : routeType}>
            <div className={premium ? 'route-badge-animation gold' : 'route-badge-animation silver'}><ReturnRouteIcon premium={premium} /></div>
            <div className={premium ? 'route-badge-text gold' : 'route-badge-text silver'}>
              <small>{routeCarrierLabels[carrier]}</small>
              <strong>{routeType}</strong>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ServerCard({ server, index }: { server: ProbeServer; index: number }) {
  const name = server.name || `服务器 ${index + 1}`
  const flag = regionFlag(server.region)
  return (
    <article className="server-card" onClick={() => { location.hash = `#/server/${index}` }} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); location.hash = `#/server/${index}` } }} title="点击查看详情">
      <div className="server-title">
        <span className={server.online ? 'status online' : 'status'} />
        <h2>
          <Twemoji>{flag && !hasLeadingFlag(name) ? `${flag} ${name}` : name}</Twemoji>
        </h2>
        <span>
          {server.online ? '在线' : '离线'}
          <i className="detail-hint">详情 ›</i>
        </span>
      </div>
      <div className="metrics">
        {server.cpu_pct !== undefined && <Meter icon={<Cpu size={14} />} label="CPU" value={`${server.cpu_pct.toFixed(1)}%`} percent={server.cpu_pct} />}
        {server.mem_total !== undefined && <Meter icon={<MemoryStick size={14} />} label="内存" value={`${pct(server.mem_used, server.mem_total).toFixed(1)}%`} percent={pct(server.mem_used, server.mem_total)} />}
        {server.disk_total !== undefined && <Meter icon={<HardDrive size={14} />} label="硬盘" value={`${pct(server.disk_used, server.disk_total).toFixed(1)}%`} percent={pct(server.disk_used, server.disk_total)} />}
        {server.traffic_used !== undefined && <Meter icon={<PieChart size={14} />} label="流量" value={server.traffic_limit ? `${bytes(server.traffic_used, false)} / ${bytes(server.traffic_limit, false)}` : bytes(server.traffic_used, false)} percent={pct(server.traffic_used, server.traffic_limit)} />}
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
      {!!server.return_routes?.length && <ReturnRouteBadges routes={server.return_routes} telecomPaidPeer={server.telecom_paid_peer} />}
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
  if (!label) return null
  return <span className="probe-license-nameplate"><span className="probe-license-stars" aria-hidden="true">✦ ✦</span><strong>{label}</strong><i aria-hidden="true" /></span>
}

// 主控端仅支持单个许可证，这里补充展示其它已获得的许可证铭牌（按 name 去重合并）。
// 数组顺序即页面展示顺序。
const EXTRA_LICENSE_BADGES = [
  { name: '👑 幸运EX', display_name: '🌠 天选之子' },
  { name: '💍「誓约」· 白誓之印', display_name: '🎉 妙妙屋X上线纪念' },
  { name: '👑 听海', display_name: '🌊 潮起无声' },
]

export function App() {
  const { data, error } = useProbe()
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
  const [theme, setTheme] = useState<ThemeName | null>(() => getThemeOverride())
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
  const toggleTheme = () => {
    setTheme(cycleTheme())
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
  const servers = data.servers || []
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
          <button aria-label="切换主题" title={`主题: ${theme || '跟随主控'}`} onClick={toggleTheme}>
            <Palette size={18} />
          </button>
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
              {hasExpiry && (
                <div className="expiry-shortcut-row">
                  <button className="expiry-shortcut" onClick={() => setFilter('renewal')}>
                    <CalendarClock size={14} />
                    待续费 <b>{renewalCount}</b>
                  </button>
                </div>
              )}
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
                    <b>↓{speed(totalDownload)}</b>
                    <b>↑{speed(totalUpload)}</b>
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
      <main className={`servers ${view}`}>{visible.length ? view === 'card' ? visible.map((server) => <ServerCard key={server.name} server={server} index={servers.indexOf(server)} />) : view === 'mini' ? visible.map((server) => <ServerMiniCard key={server.name} server={server} index={servers.indexOf(server)} expanded={miniExpanded} />) : <ServerTable servers={visible} /> : <div className="empty">暂无符合条件的服务器</div>}</main>
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
