import { useNetworkSpeed } from '../use-network-speed'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  Activity,
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  Check,
  ChevronDown,
  Clock3,
  Coins,
  Cpu,
  Database,
  Gauge,
  Globe2,
  HardDrive,
  LayoutGrid,
  MemoryStick,
  Monitor,
  Moon,
  Palette,
  Search,
  Server,
  Sun,
  SunMoon,
  Table2,
  Wallet,
  Waves,
  X,
} from 'lucide-react'
import { RegionGlobe } from '../RegionGlobe'
import { ServerDetail } from '../ServerDetail'
import { TrafficDialog } from '../App'
import { CardPingGroups } from '../CardPingGroups'
import { Twemoji } from '../Twemoji'
import { PasskeyLogin } from '../PasskeyLogin'
import { flagToCountryCode } from '../country-flag'
import type { ProbePayload, ProbeServer, ThemeName } from '../types'
import type { EnrichedServer } from '../use-probe'
import { getDarkOverride, setDarkOverride } from '../use-probe'
import { computeRemainingValue, formatMoney } from '../value'
import './emerald.css'

const THEME_OPTIONS: { value: ThemeName; label: string }[] = [
  { value: 'pixel', label: '像素' },
  { value: 'flat', label: '扁平' },
  { value: 'anime', label: '动漫' },
  { value: 'glass', label: '玻璃' },
  { value: 'lumina', label: 'Lumina' },
  { value: 'premium', label: 'Premium' },
  { value: 'ran', label: '岚 · Ran' },
  { value: 'glassmorphism', label: 'Glassmorphism' },
  { value: 'emerald', label: 'Emerald' },
]

type ViewMode = 'card' | 'table' | 'status'
type ColorMode = 'auto' | 'light' | 'dark'

const cycleLabels: Record<string, string> = {
  month: '月',
  quarter: '季',
  half_year: '半年',
  year: '年',
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

function percentage(value?: number, total?: number): number {
  if (!total) return 0
  return clamp(((value || 0) / total) * 100)
}

function bytes(value = 0, decimals = true): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let next = Math.max(0, value)
  let unit = 0
  while (next >= 1024 && unit < units.length - 1) {
    next /= 1024
    unit += 1
  }
  const digits = decimals && unit >= 2 ? (next >= 100 ? 0 : next >= 10 ? 1 : 2) : 0
  return `${next.toFixed(digits).replace(/\.0+$/, '')} ${units[unit]}`
}

function splitMetric(text: string): { value: string; unit: string } {
  const match = /^([^\s]+)\s*(.*)$/.exec(text.trim())
  return { value: match?.[1] || text, unit: match?.[2] || '' }
}

function flagFromCode(code?: string): string {
  if (!code || !/^[A-Z]{2}$/.test(code)) return ''
  return String.fromCodePoint(...[...code].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65))
}

function regionCode(server: ProbeServer): string {
  return (server.region_country || flagToCountryCode(server.region || '') || 'UN').toUpperCase()
}

function regionFlag(server: ProbeServer): string {
  const direct = server.region?.trim() || ''
  if (/^\p{Regional_Indicator}{2}/u.test(direct)) return [...direct].slice(0, 2).join('')
  return flagFromCode(regionCode(server))
}

function averagePing(server: ProbeServer): { latency: number; loss: number } | null {
  const series = (server.ping || []).filter((item) => Number.isFinite(item.current_ms) && item.current_ms >= 0)
  if (!series.length) return null
  return {
    latency: series.reduce((sum, item) => sum + item.current_ms, 0) / series.length,
    loss: series.reduce((sum, item) => sum + (item.loss_pct || 0), 0) / series.length,
  }
}

function uptimeText(seconds?: number): string {
  if (seconds === undefined) return '—'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  return days ? `${days}天 ${hours}小时` : `${hours}小时`
}

function remainingDays(value?: string): string {
  if (!value) return '永久'
  const days = Math.ceil((new Date(`${value}T23:59:59`).getTime() - Date.now()) / 86400000)
  if (days < 0) return `过期 ${Math.abs(days)}天`
  return `剩余 ${days}天`
}

function MetricValue({ value, className = '' }: { value: string; className?: string }) {
  const previous = useRef(value)
  const [updating, setUpdating] = useState(false)
  useEffect(() => {
    if (previous.current === value) return
    previous.current = value
    setUpdating(true)
    const timer = window.setTimeout(() => setUpdating(false), 380)
    return () => window.clearTimeout(timer)
  }, [value])
  return <span className={`emerald-live-value${updating ? ' is-updating' : ''}${className ? ` ${className}` : ''}`}>{value}</span>
}

function ThemeMenu({ current, onChange }: { current: ThemeName | null; onChange: (name: ThemeName | null) => void }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const label = current ? THEME_OPTIONS.find((option) => option.value === current)?.label || current : '跟随主控'

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', key)
    }
  }, [open])

  return (
    <div className="emerald-theme-menu" ref={wrapRef}>
      <button
        type="button"
        className="emerald-icon-button emerald-theme-trigger"
        aria-label={`主题: ${label}`}
        title={`主题: ${label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Palette size={17} />
        <ChevronDown size={12} className={open ? 'is-open' : ''} />
      </button>
      {open && (
        <div className="emerald-theme-dropdown" role="listbox" aria-label="主题选择">
          <button type="button" role="option" aria-selected={current === null} onClick={() => { onChange(null); setOpen(false) }}>
            <span>跟随主控</span>
            {current === null && <Check size={14} />}
          </button>
          {THEME_OPTIONS.map((option) => (
            <button key={option.value} type="button" role="option" aria-selected={current === option.value} onClick={() => { onChange(option.value); setOpen(false) }}>
              <span>{option.label}</span>
              {current === option.value && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface OverviewMetric {
  key: string
  label: string
  icon: React.ReactNode
  value: string
  unit: string
  tone: string
}

function Overview({ servers }: { servers: EnrichedServer[] }) {
  const networkSpeed = useNetworkSpeed()
  const [globeCollapsed, setGlobeCollapsed] = useState(true)
  const metrics = useMemo<OverviewMetric[]>(() => {
    const memoryUsed = servers.reduce((sum, server) => sum + (server.mem_used || 0), 0)
    const memoryTotal = servers.reduce((sum, server) => sum + (server.mem_total || 0), 0)
    const diskUsed = servers.reduce((sum, server) => sum + (server.disk_used || 0), 0)
    const diskTotal = servers.reduce((sum, server) => sum + (server.disk_total || 0), 0)
    const traffic = servers.reduce((sum, server) => sum + (server.traffic_used || 0), 0)
    const upload = servers.reduce((sum, server) => sum + (server.upload_speed || 0), 0)
    const download = servers.reduce((sum, server) => sum + (server.download_speed || 0), 0)
    const remaining = servers.reduce((sum, server) => sum + (computeRemainingValue(server)?.value || 0), 0)
    const rows = [
      { key: 'memory', label: '内存用量', icon: <MemoryStick size={17} />, text: bytes(memoryUsed), unit: `/ ${bytes(memoryTotal)}`, tone: 'violet' },
      { key: 'disk', label: '硬盘用量', icon: <HardDrive size={17} />, text: bytes(diskUsed), unit: `/ ${bytes(diskTotal)}`, tone: 'amber' },
      { key: 'value', label: '剩余价值', icon: <Coins size={17} />, text: remaining ? formatMoney(remaining, 'CNY', true) : '—', unit: remaining ? 'CNY' : '', tone: 'mint' },
      { key: 'traffic', label: '累计流量', icon: <Database size={17} />, text: bytes(traffic), unit: '', tone: 'cyan' },
      { key: 'upload', label: '实时上行', icon: <ArrowUp size={17} />, text: networkSpeed(upload), unit: '', tone: 'blue' },
      { key: 'download', label: '实时下行', icon: <ArrowDown size={17} />, text: networkSpeed(download), unit: '', tone: 'indigo' },
    ]
    return rows.map((row) => {
      const split = splitMetric(row.text)
      return { key: row.key, label: row.label, icon: row.icon, value: split.value, unit: [split.unit, row.unit].filter(Boolean).join(' '), tone: row.tone }
    })
  }, [servers, networkSpeed])

  const regions = useMemo(() => servers.map((server) => server.region || server.region_country || '').filter(Boolean), [servers])
  const online = servers.filter((server) => server.online).length

  return (
    <section className={`emerald-overview${globeCollapsed ? ' is-globe-collapsed' : ''}`} aria-label="服务器状态总览">
      <div className="emerald-overview-glow" aria-hidden="true" />
      <div className="emerald-overview-metrics">
        {metrics.map((metric) => (
          <article className={`emerald-overview-metric is-${metric.tone}`} key={metric.key}>
            <div className="emerald-overview-metric-head">
              <span>{metric.label}</span>
              {metric.icon}
            </div>
            <div className="emerald-overview-metric-value">
              <strong><MetricValue value={metric.value} /></strong>
              {metric.unit && <span>{metric.unit}</span>}
            </div>
          </article>
        ))}
      </div>
      <div className="emerald-globe-wrap" id="emerald-mobile-globe">
        <div className="emerald-online-pill"><span />{online}</div>
        <RegionGlobe regions={regions} />
      </div>
      <button
        type="button"
        className="emerald-globe-toggle"
        aria-expanded={!globeCollapsed}
        aria-controls="emerald-mobile-globe"
        onClick={() => setGlobeCollapsed((value) => !value)}
      >
        <Globe2 size={14} />
        <span>{globeCollapsed ? '展开地球' : '收起地球'}</span>
        <ChevronDown size={14} className={globeCollapsed ? '' : 'is-open'} />
      </button>
    </section>
  )
}

type RankingType = 'uptime' | 'quality' | 'traffic' | 'speed'

function rankingTraffic(server: ProbeServer): number {
  const cumulative = (server.cumulative_down || 0) + (server.cumulative_up || 0)
  return cumulative || server.traffic_used_total || server.traffic_used || 0
}

function RankingPanel({ servers, type, openServer }: { servers: EnrichedServer[]; type: RankingType; openServer: (index: number) => void }) {
  const networkSpeed = useNetworkSpeed()
  const [expanded, setExpanded] = useState(false)
  const rows = useMemo(() => {
    if (type === 'uptime') {
      const max = Math.max(1, ...servers.map((server) => server.uptime || 0))
      return [...servers]
        .sort((a, b) => Number(b.online) - Number(a.online) || (b.uptime || 0) - (a.uptime || 0))
        .map((server) => ({
          server,
          value: server.online ? uptimeText(server.uptime) : '离线',
          sub: server.online ? '当前在线' : '等待重新连接',
          score: server.online ? ((server.uptime || 0) / max) * 100 : 0,
        }))
    }
    if (type === 'quality') {
      return servers
        .map((server) => {
          const ping = averagePing(server)
          const score = ping ? clamp(100 - ping.latency / 3 - ping.loss * 4) : 0
          return {
            server,
            value: ping ? `${ping.latency.toFixed(1)} ms` : '无数据',
            sub: ping ? `丢包 ${ping.loss.toFixed(1)}% · ${(server.ping || []).length} 路探测` : '暂无网络探测',
            score,
            latency: ping?.latency ?? Infinity,
            loss: ping?.loss ?? Infinity,
          }
        })
        .sort((a, b) => Number(Number.isFinite(b.latency)) - Number(Number.isFinite(a.latency)) || a.latency - b.latency || a.loss - b.loss)
    }
    if (type === 'speed') {
      const ranked = servers
        .map((server) => ({ server, total: (server.download_speed || 0) + (server.upload_speed || 0) }))
        .sort((a, b) => b.total - a.total)
      const max = Math.max(1, ...ranked.map((row) => row.total))
      return ranked.map(({ server, total }) => ({
        server,
        value: networkSpeed(total),
        sub: `↓ ${networkSpeed(server.download_speed)} · ↑ ${networkSpeed(server.upload_speed)}`,
        score: (total / max) * 100,
      }))
    }
    const ranked = servers.map((server) => ({ server, total: rankingTraffic(server) })).sort((a, b) => b.total - a.total)
    const max = Math.max(1, ...ranked.map((row) => row.total))
    return ranked.map(({ server, total }) => ({
      server,
      value: bytes(total),
      sub: `收 ${bytes(server.cumulative_down)} · 发 ${bytes(server.cumulative_up)}`,
      score: (total / max) * 100,
    }))
  }, [servers, type, networkSpeed])

  const visibleRows = expanded ? rows : rows.slice(0, 3)
  const meta = type === 'uptime'
    ? { title: '在线时长', chip: 'UPTIME', icon: <Clock3 size={17} /> }
    : type === 'quality'
      ? { title: '网络质量', chip: '延迟 + 丢包', icon: <Waves size={17} /> }
      : type === 'speed'
        ? { title: '实时网速', chip: '↓ + ↑', icon: <ArrowDownUp size={17} /> }
        : { title: '流量消耗', chip: '累计', icon: <Database size={17} /> }

  return (
    <article className={`emerald-ranking-panel is-${type}${expanded ? ' is-expanded' : ''}`} id={`emerald-rank-${type}`}>
      <header>
        <span className="emerald-drag-dots" aria-hidden="true">⠿</span>
        {meta.icon}
        <h2>{meta.title}</h2>
        <span className="emerald-panel-chip">{meta.chip}</span>
      </header>
      <ol>
        {visibleRows.map((row, index) => {
          const serverIndex = servers.indexOf(row.server)
          return (
            <li key={`${type}-${serverIndex}`} role="button" tabIndex={0} aria-label={`查看节点 ${row.server.name || serverIndex + 1}`} onClick={() => openServer(serverIndex)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openServer(serverIndex) } }}>
              <em>{index + 1}</em>
              <div className="emerald-rank-copy">
                <strong><span className={`emerald-status-dot${row.server.online ? ' is-online' : ''}`} />{row.server.name || `服务器 ${serverIndex + 1}`}</strong>
                <span className="emerald-rank-track"><i style={{ width: `${clamp(row.score)}%` }} /></span>
                <small>{row.sub}</small>
              </div>
              <b>{row.value}</b>
            </li>
          )
        })}
      </ol>
      <button type="button" className="emerald-panel-more" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? '收起榜单' : `查看全部 ${rows.length}`}</button>
    </article>
  )
}

function metricTone(value: number): string {
  return value >= 90 ? 'danger' : value >= 70 ? 'warn' : 'good'
}

const routeCarriers = [
  { key: 'telecom', label: '电信' },
  { key: 'unicom', label: '联通' },
  { key: 'mobile', label: '移动' },
] as const
const premiumRoutes = new Set(['CN2GIA', 'CTGGIA', '9929', 'CMIN2', '163PP'])

function displayRoute(route?: string): string {
  const compact = (route || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!compact || compact === 'UNKNOWN') return '未知'
  if (compact === 'CMIN') return 'CMI'
  return compact
}

function GlowCard({ children, className, index, onClick, label }: {
  children: React.ReactNode
  className: string
  index: number
  onClick: () => void
  label: string
}) {
  return (
    <article
      className={`emerald-glow-card ${className}`}
      style={{ '--emerald-index': Math.min(index, 12) } as CSSProperties}
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
    >
      <div className="emerald-card-content">{children}</div>
    </article>
  )
}

function NodeCard({ server, index, open }: { server: EnrichedServer; index: number; open: () => void }) {
  const networkSpeed = useNetworkSpeed()
  const [trafficOpen, setTrafficOpen] = useState(false)
  const name = server.name || `服务器 ${index + 1}`
  const flag = regionFlag(server)
  const cpu = server.cpu_pct || 0
  const memory = percentage(server.mem_used, server.mem_total)
  const disk = percentage(server.disk_used, server.disk_total)
  const traffic = percentage(server.traffic_used, server.traffic_limit)
  const routes = new Map((server.return_routes || []).map((route) => [route.carrier, route]))
  const remaining = computeRemainingValue(server)

  const metrics = [
    { key: 'cpu', label: 'CPU', value: cpu, detail: server.loadavg || `${server.cpu_cores || '—'} 核`, icon: <Cpu size={12} /> },
    { key: 'mem', label: '内存', value: memory, detail: `${bytes(server.mem_used)} / ${bytes(server.mem_total)}`, icon: <MemoryStick size={12} /> },
    { key: 'disk', label: '硬盘', value: disk, detail: `${bytes(server.disk_used)} / ${bytes(server.disk_total)}`, icon: <HardDrive size={12} /> },
    { key: 'traffic', label: '流量', value: traffic, detail: server.traffic_limit ? `${bytes(server.traffic_used)} / ${bytes(server.traffic_limit)}` : bytes(server.traffic_used), icon: <Gauge size={12} /> },
  ]

  return (
    <>
    <GlowCard className={`emerald-node-card${server.online ? '' : ' is-offline'}`} index={index} onClick={open} label={`查看节点 ${name} 详情`}>
      <header className="emerald-node-head">
        <div className="emerald-node-name">
          <span className={`emerald-status-dot${server.online ? ' is-online' : ''}`}><i /></span>
          {flag && <Twemoji className="emerald-node-flag">{flag}</Twemoji>}
          <strong>{name}</strong>
        </div>
        <Monitor size={15} className="emerald-node-os" />
      </header>
      <p className="emerald-node-system">{server.cpu_cores ? `${server.cpu_cores} 核 · ` : ''}{server.cpu_model || server.os || '系统信息暂缺'}</p>
      <div className="emerald-node-metrics">
        {metrics.map((metric) => {
          const content = <>
            <div><span>{metric.icon}{metric.label}</span><b><MetricValue value={`${metric.value.toFixed(1)}%`} /></b></div>
            <span className="emerald-meter"><i className={`is-${metricTone(metric.value)}`} style={{ width: `${metric.value}%` }} /></span>
            <small>{metric.detail}</small>
          </>
          return metric.key === 'traffic' ? (
            <button
              type="button"
              className="emerald-node-metric is-traffic is-interactive"
              key={metric.key}
              title="查看流量趋势"
              aria-label={`${name} 流量趋势`}
              onClick={(event) => { event.stopPropagation(); setTrafficOpen(true) }}
              onKeyDown={(event) => event.stopPropagation()}
            >
              {content}
            </button>
          ) : <div className={`emerald-node-metric is-${metric.key}`} key={metric.key}>{content}</div>
        })}
      </div>
      <div className="emerald-node-quick">
        <div>
          <span className="is-down"><ArrowDown size={11} />下 <b><MetricValue value={networkSpeed(server.download_speed)} /></b></span>
          <span className="is-up"><ArrowUp size={11} />上 <b><MetricValue value={networkSpeed(server.upload_speed)} /></b></span>
        </div>
        <div>
          <span title="当前周期下行流量"><ArrowDown size={11} />下行 <b>{bytes(server.traffic_used_down)}</b></span>
          <span title="当前周期上行流量"><ArrowUp size={11} />上行 <b>{bytes(server.traffic_used_up)}</b></span>
        </div>
        <div>
          <span><Clock3 size={11} /><b>{remainingDays(server.expires_at)}</b></span>
          <span><Wallet size={11} /><b>{remaining ? formatMoney(remaining.value, 'CNY', true) : '—'}</b></span>
        </div>
      </div>
      <CardPingGroups variant="emerald" ping={server.ping} serverIndex={index} serverName={server.name} />
      <div className="emerald-route-badges" aria-label={`${name} 三网回程`}>
        {routeCarriers.map(({ key, label }) => {
          const route = routes.get(key)
          let routeType = displayRoute(route?.route_type)
          if (key === 'telecom' && server.telecom_paid_peer && routeType === '163') routeType = '163 PP'
          const premium = premiumRoutes.has(routeType.replace(/[^A-Z0-9]/g, ''))
          return (
            <span className={`emerald-route-badge is-${key}${premium ? ' is-premium' : ''}${route ? '' : ' is-unknown'}`} key={key} title={route?.region ? `${label}回程 · ${route.region} · ${routeType}` : `${label}回程 · ${routeType}`}>
              <small>{label}</small><strong>{routeType}</strong>
            </span>
          )
        })}
      </div>
    </GlowCard>
    {trafficOpen && <TrafficDialog server={server} close={() => setTrafficOpen(false)} />}
    </>
  )
}

function TableView({ servers, allServers, open }: { servers: EnrichedServer[]; allServers: EnrichedServer[]; open: (index: number) => void }) {
  const networkSpeed = useNetworkSpeed()
  return (
    <div className="emerald-table-shell">
      <table>
        <thead><tr><th>节点</th><th>状态</th><th>CPU</th><th>内存</th><th>硬盘</th><th>流量</th><th>实时速度 ↓ / ↑</th><th>延迟</th></tr></thead>
        <tbody>
          {servers.map((server) => {
            const index = allServers.indexOf(server)
            const ping = averagePing(server)
            return (
              <tr key={server.name} tabIndex={0} onClick={() => open(index)} onKeyDown={(event) => { if (event.key === 'Enter') open(index) }}>
                <td><span className={`emerald-status-dot${server.online ? ' is-online' : ''}`} />{regionFlag(server) && <Twemoji>{regionFlag(server)}</Twemoji>}<strong>{server.name || `服务器 ${index + 1}`}</strong></td>
                <td>{server.online ? '在线' : '离线'}</td>
                <td>{(server.cpu_pct || 0).toFixed(1)}%</td>
                <td>{percentage(server.mem_used, server.mem_total).toFixed(1)}%</td>
                <td>{percentage(server.disk_used, server.disk_total).toFixed(1)}%</td>
                <td>{bytes(server.traffic_used)}</td>
                <td><span className="is-down">{networkSpeed(server.download_speed)}</span> / <span className="is-up">{networkSpeed(server.upload_speed)}</span></td>
                <td>{ping ? `${ping.latency.toFixed(0)} ms` : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function StatusView({ servers, allServers, open }: { servers: EnrichedServer[]; allServers: EnrichedServer[]; open: (index: number) => void }) {
  const networkSpeed = useNetworkSpeed()
  return (
    <div className="emerald-status-list">
      {servers.map((server, rowIndex) => {
        const index = allServers.indexOf(server)
        const ping = averagePing(server)
        return (
          <GlowCard key={server.name} className="emerald-status-row" index={rowIndex} onClick={() => open(index)} label={`查看节点 ${server.name || index + 1} 详情`}>
            <div className="emerald-status-ident"><span className={`emerald-status-dot${server.online ? ' is-online' : ''}`} />{regionFlag(server) && <Twemoji>{regionFlag(server)}</Twemoji>}<strong>{server.name || `服务器 ${index + 1}`}</strong><small>{server.os || server.cpu_model || '系统信息'}</small></div>
            <div className="emerald-status-metrics"><span>CPU <b>{(server.cpu_pct || 0).toFixed(1)}%</b></span><span>内存 <b>{percentage(server.mem_used, server.mem_total).toFixed(1)}%</b></span><span>硬盘 <b>{percentage(server.disk_used, server.disk_total).toFixed(1)}%</b></span></div>
            <div className="emerald-status-speed"><span className="is-down">↓ {networkSpeed(server.download_speed)}</span><span className="is-up">↑ {networkSpeed(server.upload_speed)}</span></div>
            <div className="emerald-status-ping"><b>{ping ? `${ping.latency.toFixed(0)} ms` : '—'}</b><span>丢包 {ping?.loss.toFixed(1) || '0.0'}%</span></div>
          </GlowCard>
        )
      })}
    </div>
  )
}

export default function EmeraldApp({ data, onThemeChange }: { data: ProbePayload; onThemeChange: (name: ThemeName | null) => void }) {
  const servers = useMemo(() => (data.servers || []) as EnrichedServer[], [data.servers])
  const [search, setSearch] = useState('')
  const [region, setRegion] = useState('all')
  const [view, setView] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('emerald-view')
    return saved === 'table' || saved === 'status' ? saved : 'card'
  })
  const [sort, setSort] = useState<'default' | 'latency' | 'traffic'>('default')
  const [detailIndex, setDetailIndex] = useState<number | null>(null)
  const [themeOverride, setThemeOverride] = useState<ThemeName | null>(() => {
    const saved = localStorage.getItem('mmwx-probe-theme-override') as ThemeName | null
    return THEME_OPTIONS.some((option) => option.value === saved) ? saved : null
  })
  const [colorMode, setColorMode] = useState<ColorMode>(() => {
    const current = getDarkOverride()
    return current === 'light' || current === 'dark' ? current : 'auto'
  })

  const isDark = colorMode === 'dark' || (colorMode === 'auto' && document.documentElement.classList.contains('dark'))
  const title = data.title?.trim() || '服务器状态'

  useEffect(() => {
    document.body.classList.add('emerald-body')
    document.body.classList.toggle('emerald-dark-body', isDark)
    return () => document.body.classList.remove('emerald-body', 'emerald-dark-body')
  }, [isDark])

  useEffect(() => {
    const applyHash = () => {
      const match = /^#\/server\/(\d+)$/.exec(location.hash)
      setDetailIndex(match ? Number(match[1]) : null)
    }
    applyHash()
    window.addEventListener('hashchange', applyHash)
    return () => window.removeEventListener('hashchange', applyHash)
  }, [])

  const regionRows = useMemo(() => {
    const counts = new Map<string, number>()
    for (const server of servers) counts.set(regionCode(server), (counts.get(regionCode(server)) || 0) + 1)
    return [...counts].sort((a, b) => b[1] - a[1])
  }, [servers])

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = servers.filter((server) => {
      if (region !== 'all' && regionCode(server) !== region) return false
      if (!query) return true
      return [server.name, server.region, server.region_name, server.region_city, server.region_country, server.provider_name, server.cpu_model, server.os].filter(Boolean).join(' ').toLowerCase().includes(query)
    })
    if (sort === 'latency') return [...filtered].sort((a, b) => (averagePing(a)?.latency || Infinity) - (averagePing(b)?.latency || Infinity))
    if (sort === 'traffic') return [...filtered].sort((a, b) => (b.traffic_used || 0) - (a.traffic_used || 0))
    return [...filtered].sort((a, b) => Number(b.online) - Number(a.online))
  }, [region, search, servers, sort])

  const setViewMode = (next: ViewMode) => {
    setView(next)
    localStorage.setItem('emerald-view', next)
  }

  const switchColorMode = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const next: ColorMode = colorMode === 'auto' ? 'light' : colorMode === 'light' ? 'dark' : 'auto'
    const apply = () => {
      setDarkOverride(next === 'auto' ? null : next)
      setColorMode(next)
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!document.startViewTransition || reduced) {
      apply()
      return
    }
    const root = document.documentElement
    root.style.setProperty('--emerald-reveal-x', `${event.clientX}px`)
    root.style.setProperty('--emerald-reveal-y', `${event.clientY}px`)
    root.classList.add('emerald-theme-transitioning')
    const transition = document.startViewTransition(apply)
    void transition.finished.finally(() => root.classList.remove('emerald-theme-transitioning'))
  }

  const handleTheme = (name: ThemeName | null) => {
    setThemeOverride(name)
    onThemeChange(name)
  }

  const openDetail = (index: number) => {
    location.hash = `#/server/${index}`
    setDetailIndex(index)
  }

  return (
    <div className={`emerald-app${isDark ? ' is-dark' : ' is-light'}`}>
      <div className="emerald-background" aria-hidden="true"><span /><span /><span /></div>
      <header className="emerald-header">
        <a className="emerald-brand" href="#/" onClick={() => setDetailIndex(null)}>
          {data.logo ? <img src={data.logo} alt="" /> : <span className="emerald-brand-mark"><Activity size={17} /></span>}
          <strong>{title}</strong>
          <em>EMERALD</em>
        </a>
        <div className="emerald-header-actions">
          <label className="emerald-header-search">
            <Search size={15} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索节点…" aria-label="搜索节点" />
            {search && <button type="button" aria-label="清空搜索" onClick={() => setSearch('')}><X size={13} /></button>}
          </label>
          <label className="emerald-sort" title="节点排序">
            <ArrowDownUp size={14} />
            <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} aria-label="节点排序">
              <option value="default">默认</option><option value="latency">延迟</option><option value="traffic">流量</option>
            </select>
          </label>
          <div className="emerald-view-switch" role="group" aria-label="视图模式">
            <button type="button" aria-label="卡片视图" aria-pressed={view === 'card'} className={view === 'card' ? 'active' : ''} onClick={() => setViewMode('card')}><LayoutGrid size={15} /><span>卡片</span></button>
            <button type="button" aria-label="表格视图" aria-pressed={view === 'table'} className={view === 'table' ? 'active' : ''} onClick={() => setViewMode('table')}><Table2 size={15} /><span>表格</span></button>
            <button type="button" aria-label="状态视图" aria-pressed={view === 'status'} className={view === 'status' ? 'active' : ''} onClick={() => setViewMode('status')}><Activity size={15} /><span>状态</span></button>
          </div>
          <button type="button" className="emerald-icon-button" aria-label={colorMode === 'auto' ? '自动模式' : colorMode === 'light' ? '浅色模式' : '深色模式'} title={colorMode === 'auto' ? '自动模式 · 点击切换' : colorMode === 'light' ? '浅色模式 · 点击切换' : '深色模式 · 点击切换'} onClick={switchColorMode}>
            {colorMode === 'auto' ? <SunMoon size={17} /> : colorMode === 'light' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <ThemeMenu current={themeOverride} onChange={handleTheme} />
          <PasskeyLogin buttonClassName="emerald-icon-button" iconSize={17} />
        </div>
      </header>

      <main className="emerald-main">
        <div className="emerald-dashboard">
          <div className="emerald-primary-column">
            <Overview servers={servers} />

            <div className="emerald-region-bar" aria-label="地区筛选">
              <button type="button" className={region === 'all' ? 'active' : ''} onClick={() => setRegion('all')}><Globe2 size={14} />全部 <b>{servers.length}</b></button>
              {regionRows.map(([code, count]) => <button type="button" key={code} className={region === code ? 'active' : ''} onClick={() => setRegion(code)}>{code !== 'UN' && <Twemoji>{flagFromCode(code)}</Twemoji>}<span>{code === 'UN' ? '未知' : code}</span><b>{count}</b></button>)}
            </div>

            <section className="emerald-node-section">
              <div className="emerald-node-section-head"><div><span className="emerald-live-dot" />实时节点</div><span>显示 {visible.length} / {servers.length}</span></div>
              {visible.length === 0 ? <div className="emerald-empty"><Server size={24} />暂无符合条件的服务器</div> : view === 'card' ? (
                <div className="emerald-node-grid">{visible.map((server) => <NodeCard key={server.name} server={server} index={servers.indexOf(server)} open={() => openDetail(servers.indexOf(server))} />)}</div>
              ) : view === 'table' ? <TableView servers={visible} allServers={servers} open={openDetail} /> : <StatusView servers={visible} allServers={servers} open={openDetail} />}
            </section>
          </div>
          <aside className="emerald-sidebar">
            <div className="emerald-sidebar-title">
              <h2>多维榜单</h2>
              <div>
                <button type="button" onClick={() => document.getElementById('emerald-rank-uptime')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><Clock3 size={12} />在线</button>
                <button type="button" onClick={() => document.getElementById('emerald-rank-quality')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><Waves size={12} />网络</button>
                <button type="button" onClick={() => document.getElementById('emerald-rank-traffic')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><Database size={12} />流量</button>
                <button type="button" onClick={() => document.getElementById('emerald-rank-speed')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><ArrowDownUp size={12} />网速</button>
              </div>
            </div>
            <RankingPanel servers={servers} type="uptime" openServer={openDetail} />
            <RankingPanel servers={servers} type="quality" openServer={openDetail} />
            <RankingPanel servers={servers} type="traffic" openServer={openDetail} />
            <RankingPanel servers={servers} type="speed" openServer={openDetail} />
          </aside>
        </div>
      </main>

      <footer className="emerald-footer">
        <span><span className="emerald-live-dot" />{servers.filter((server) => server.online).length} 台在线 · 实时更新</span>
        <span>Emerald · inspired by <a href="https://github.com/Tokinx/komari-theme-emerald" target="_blank" rel="noreferrer">Komari Theme Emerald</a></span>
      </footer>

      {detailIndex !== null && servers[detailIndex] && <ServerDetail server={servers[detailIndex]} index={detailIndex} showHealthScore={data.show_health_score === true} onClose={() => { location.hash = ''; setDetailIndex(null) }} />}
    </div>
  )
}
