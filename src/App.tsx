import { ThemeSelect } from './ThemePicker'
import { useNetworkSpeed } from './use-network-speed'
import { ConnectionCounts, UnlockButton } from './ServerCapabilities'
import { ConnectionBox, ConnectionHistory } from './ConnectionHistory'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Activity, ArrowDown, ArrowUp, BadgeDollarSign, ChartColumn, Calendar, CalendarClock, ChevronDown, CircleDollarSign, Cpu, Crown, Database, Gauge, Gem, Globe2, HardDrive, LayoutGrid, List, MapPin, MemoryStick, Moon, Network, PieChart, RefreshCw, Rows3, Rows4, Search, Server, Sun, SunMoon, TriangleAlert, Wallet, Wifi } from 'lucide-react'
import type { ProbePingSeries, ProbeServer, ThemeName } from './types'
import { EnrichedServer, getActiveTheme, getDarkOverride, getThemeOverride, setDarkOverride, setTheme, useProbe } from './use-probe'
import { Twemoji } from './Twemoji'
import { PasskeyLogin } from './PasskeyLogin'
import { CardPingGroups } from './CardPingGroups'
import { computeRemainingValue, formatMoney } from './value'
import { LEADERBOARD_ORDER } from './leaderboards'
import { Leaderboard, formatUptime, monthlyCost } from './Leaderboard'
import { ProbeHistoryDaysContext } from './use-probe-range'
import { CYCLE_LABELS as cycleLabel, expiryTimestamp, isPermanent, renewalPriceCny, upcomingExpiries } from './renewal'
import { bytes, expiring, expired, remainingDays, regionFlag, hasLeadingFlag, pct, averagePing } from './server-format'
import { StaleDataBanner } from './StaleDataBanner'
import { ForwardOverview, prefetchDeferred, ServerDetail, SystemTrendChart, TrafficDialog, TrendDialog } from './deferred'
import { Meter, systemTitle, SystemIcon, routeCarrierLabels, goldRoutes, displayReturnRoute, ReturnRouteBadges } from './components/ServerVisuals'
import { LUMINA_QUOTA_SEGMENTS } from './components/LuminaHealthBars'
import { ProbeLicenseBar } from './components/ProbeLicenseBar'
import { globeCountryCode, regionGroupLabel } from './globe-regions'
import { PROBE_ALERT_PCT, PROBE_SORT_KEYS, PROBE_SORT_LABELS, connectionTotals, dailyTrafficTotals, formatCapacity, formatSize, meterTone, networkQuality, kpiColumns, probeHealthIssue, quotaPerServer, quotaSummary, relativeTime, sortProbeServers, type ProbeHealthIssue, type ProbeSortKey } from './probe-overview'

// 与主控内置探针同款的地区地球（拱形弧线 + 亮点旁旗帜与台数）
const RegionGlobe = lazy(() => import('./ProbeRegionGlobe').then((module) => ({ default: module.ProbeRegionGlobe })))
const PremiumProbePage = lazy(() => import('./PremiumProbePage').then((module) => ({ default: module.PremiumProbePage })))
const GmApp = lazy(() => import('./glassmorphism/GmApp').then((module) => ({ default: module.default })))
const EmeraldApp = lazy(() => import('./emerald/EmeraldApp').then((module) => ({ default: module.default })))
const MiniApp = lazy(() => import('./mini/MiniApp'))
const LuminaPlusApp = lazy(() => import('./luminaplus/LuminaPlusApp'))
const NezhaApp = lazy(() => import('./nezha/NezhaApp'))
const MiniServerDetail = lazy(() => import('./mini/MiniServerDetail'))

function RegionSelect({ regions, value, onChange }: { regions: string[]; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
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
      // 右缘与按钮右缘对齐(fixed right 定位), 不再按估算宽度左夹取
      setPos({ top, right: window.innerWidth - rect.right })
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
          <div className="region-menu" ref={menuRef} style={{ top: pos.top, right: pos.right }} role="listbox">
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

// 资产：按剩余天数折算的总剩余价值与月均成本（与 value.ts 同一口径），没有任何定价时返回 null
function assetStats(servers: ProbeServer[]) {
  let totalValue = 0
  let totalMonthly = 0
  let priced = 0
  for (const server of servers) {
    const rv = computeRemainingValue(server)
    // 只汇总人民币口径；主控没下发换算价的外币服务器不计入
    if (!rv || rv.currency.toUpperCase() !== 'CNY') continue
    priced++
    totalValue += rv.value
    totalMonthly += rv.daily * 30
  }
  return priced ? { totalValue, totalMonthly, priced } : null
}

function SystemTrendDialog({ serverIndex, title, metric, close }: { serverIndex: number; title: string; metric: 'cpu' | 'mem' | 'disk'; close: () => void }) {
  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={close}>
      <section className="modal" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
        <header>
          <h2>{title} · {metric === 'cpu' ? 'CPU' : metric === 'mem' ? '内存' : '磁盘'}趋势</h2>
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
// 每段取 heat 渐变(绿→黄→橙→红)的 1/18 切片作为段色,与 LuminaPlus 的
// trafficQuotaSegmentColor 语义一致:颜色只看段的位置,与主题无关。
// 2026-08-13: 原 oklch 插值语法(linear-gradient to right in oklch) 在 Chrome<111 / Safari<16.2
// 等浏览器整条失效导致进度条无渐变,改 hex 色标全兼容(色值经 oklch→sRGB 精确转换)。
const LUMINA_HEAT_GRADIENT =
  'linear-gradient(to right, #4ac06c 0%, #4ac06c 10%, #9cd242 28%, #d9da26 44%, #f2b200 58%, #f58200 72%, #f25100 86%, #e62c2c 100%)'
function luminaHeatGradient(): string {
  // 黑金配色: 金色渐变(与 --lumina-heat 覆盖一致)
  if (document.documentElement.classList.contains('gold')) {
    return 'linear-gradient(to right, #a8843f 0%, #c9a255 30%, #d8b46a 60%, #f2d28b 100%)'
  }
  // 白金配色: 直接用黑金同款 4 色渐变(2026-08-15 用户要求 "直接用黑金那个")
  if (document.documentElement.classList.contains('platinum')) {
    return 'linear-gradient(to right, #a8843f 0%, #c9a255 30%, #d8b46a 60%, #f2d28b 100%)'
  }
  return `var(--lumina-heat, ${LUMINA_HEAT_GRADIENT})`
}

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
          <span className="lumina-metric-icon">{icon}</span>
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
  // 黑金配色: 全金色分档(暗金 → 亮金)
  if (document.documentElement.classList.contains('gold')) {
    if (level <= 0.01) return 'var(--progress-bg)'
    if (level < 0.3) return '#a8843f'
    if (level < 0.6) return '#c9a255'
    if (level < 0.85) return '#d8b46a'
    // 最高柱: 压至比次高档略暗, 不再抢眼(原 #f2d28b → #e3c176 → #d3ac63)
    return '#d3ac63'
  }
  // 白金配色: 直接用黑金延迟色(2026-08-15 用户要求, 主基调提亮)
  if (document.documentElement.classList.contains('platinum')) {
    if (level <= 0.01) return 'var(--progress-bg)'
    if (level < 0.3) return '#a8843f'
    if (level < 0.6) return '#c9a255'
    if (level < 0.85) return '#d8b46a'
    return '#d3ac63'
  }
  // 相对峰值分档: 无流量灰 → 低绿 → 中蓝 → 高琥珀 → 极高暖橙(琥珀+30%红, 避免刺眼红)
  if (level <= 0.01) return 'var(--progress-bg)'
  if (level < 0.3) return 'var(--lumina-pulse-low, var(--status-success))'
  if (level < 0.6) return 'var(--lumina-pulse-mid, var(--traffic-up))'
  if (level < 0.85) return 'var(--lumina-pulse-high, var(--status-warning))'
  return 'var(--lumina-pulse-peak, color-mix(in srgb, var(--status-warning) 70%, var(--status-error) 30%))'
}

function luminaTrafficWindow(samples: ProbeServer['daily_traffic'], dots?: number) {
  const rows = (samples || [])
    .map((sample) => {
      const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(sample.date)
      if (!match) return null
      const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
      if (!Number.isFinite(timestamp)) return null
      const date = new Date(timestamp).toISOString().slice(0, 10)
      return { sample: { ...sample, date }, timestamp }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => a.timestamp - b.timestamp)

  // 完全没有有效数据时保持空白，不生成看似真实的 0 流量日期。
  if (!rows.length) return []

  const count = dots ?? Math.min(14, Math.max(7, rows.length))
  const latestTimestamp = rows[rows.length - 1].timestamp
  const byDate = new Map(rows.map(({ sample }) => [sample.date, sample]))

  return Array.from({ length: count }, (_, index) => {
    const timestamp = latestTimestamp - (count - index - 1) * 86_400_000
    const date = new Date(timestamp).toISOString().slice(0, 10)
    return byDate.get(date) ?? { date, uplink: 0, downlink: 0, total: 0 }
  })
}

function LuminaTrafficPulse({ samples, dots }: { samples: ProbeServer['daily_traffic']; dots?: number }) {
  // 有数据时至少展示连续 7 个自然日，缺失日补 0；完全无数据时保持空白。
  const list = luminaTrafficWindow(samples, dots)
  const max = Math.max(1, ...list.map((item) => item.total ?? 0))
  return (
    <span className="lumina-traffic-pulse" aria-hidden>
      {list.map((sample) => {
        const value = sample.total ?? 0
        const level = value / max
        return (
          <span
            key={sample.date}
            data-active={value > 0 ? 'true' : 'false'}
            title={`${sample.date}\n上行 ${bytes(sample.uplink)}\n下行 ${bytes(sample.downlink)}`}
            style={
              {
                '--pulse-h': `${Math.max(8, Math.round((value / max) * 100))}%`,
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

function ServerCardLumina({ server, index }: { server: EnrichedServer; index: number }) {
  const networkSpeed = useNetworkSpeed()
  const [trafficOpen, setTrafficOpen] = useState(false)
  const [cpuOpen, setCpuOpen] = useState(false)
  const [memOpen, setMemOpen] = useState(false)
  const [diskOpen, setDiskOpen] = useState(false)
  const name = server.name || `服务器 ${index + 1}`
  const flag = regionFlag(server.region)
  const isOffline = !server.online
  const cores = server.cpu_cores ?? 0
  const loadParts = (server.loadavg || '').split(/\s+/).map(Number).filter((v) => Number.isFinite(v))
  const load1 = loadParts[0]
  const loadFraction = load1 !== undefined && cores > 0 ? Math.max(0, Math.min(1, load1 / cores)) : 0
  const trafficFraction = server.traffic_limit ? pct(server.traffic_used, server.traffic_limit) / 100 : 0
  const upRate = server.upload_speed
  const downRate = server.download_speed
  const expireValue = isPermanent(server) ? '永久' : server.expires_at ? remainingDays(server.expires_at) : null
  // 今日流量用量(本地时区当天; 当天无记录时回退 daily_traffic 最后一天)
  const dailyRows = server.daily_traffic || []
  const nowDate = new Date()
  const todayStr = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(nowDate.getDate()).padStart(2, '0')}`
  const todayRow = dailyRows.find((row) => row.date === todayStr) ?? dailyRows[dailyRows.length - 1]
  const todayUp = todayRow ? (todayRow.uplink ?? 0) : null
  const todayDown = todayRow ? (todayRow.downlink ?? 0) : null
  const todayTotal = todayRow ? (todayRow.total ?? (todayUp ?? 0) + (todayDown ?? 0)) : null
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
            <h2 className="lumina-title" title={name}>
              <Twemoji>{flag && !hasLeadingFlag(name) ? `${flag} ${name}` : name}</Twemoji>
            </h2>
          </div>
          <span className="lumina-card-actions">
            <UnlockButton server={server} />
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
            <button
              type="button"
              className="lumina-metric-btn"
              aria-label="查看磁盘趋势"
              title="点击查看磁盘趋势"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                setDiskOpen(true)
              }}
            >
              <LuminaMetricBar icon={<HardDrive size={13} />} label="磁盘" value={`${pct(server.disk_used, server.disk_total).toFixed(1)}%`} detail={`${bytes(server.disk_used)} / ${bytes(server.disk_total)}`} paint="var(--progress-disk)" fraction={pct(server.disk_used, server.disk_total) / 100} />
            </button>
          )}
          {load1 !== undefined && (
            <LuminaMetricBar icon={<Gauge size={13} />} label="负载" value={load1.toFixed(2)} detail={`${loadParts[1]?.toFixed(2) ?? '—'} / ${loadParts[2]?.toFixed(2) ?? '—'}`} paint="var(--progress-load)" fraction={loadFraction} />
          )}
        </div>

        <div className="lumina-traffic-section">
          <div className="lumina-network-row speed--connections">
            <div className="card-speed-pair">
              {(upRate !== undefined || downRate !== undefined) && <>
                <span className="download" title={`下行 ${networkSpeed(downRate)}`}>
                  <ArrowDown size={13} />
                  <strong className="card-speed-value">{networkSpeed(downRate)}</strong>
                </span>
                <span className="upload" title={`上行 ${networkSpeed(upRate)}`}>
                  <ArrowUp size={13} />
                  <strong className="card-speed-value">{networkSpeed(upRate)}</strong>
                </span>
              </>}
            </div>
            <ConnectionCounts server={server} variant="inline" />
          </div>
          {(upRate !== undefined || downRate !== undefined) && (
            <div className="lumina-traffic-pulse-wrap">
              <div className="lumina-today-stat" title="今日流量用量(总/上行/下行)">
                <span className="lumina-today-head">
                  <span className="lumina-today-label">今日</span>
                  <strong className="tabular lumina-today-total">{todayTotal !== null ? bytes(todayTotal) : '—'}</strong>
                </span>
                <span className="lumina-today-row" style={{ color: 'var(--traffic-up)' }}>
                  <ArrowUp size={12} />
                  <strong className="tabular">{todayUp !== null ? bytes(todayUp) : '—'}</strong>
                </span>
                <span className="lumina-today-row" style={{ color: 'var(--traffic-down)' }}>
                  <ArrowDown size={12} />
                  <strong className="tabular">{todayDown !== null ? bytes(todayDown) : '—'}</strong>
                </span>
              </div>
              <button
                type="button"
                className="lumina-pulse-btn lumina-week-btn"
                aria-label="查看流量趋势"
                title="近 7-14 日流量 · 点击查看完整趋势"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  setTrafficOpen(true)
                }}
              >
                <LuminaTrafficPulse samples={server.daily_traffic} />
              </button>
            </div>
          )}
        </div>

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
                            backgroundImage: luminaHeatGradient(),
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

        <ConnectionHistory server={server} serverIndex={index} />
        <CardPingGroups variant="lumina" ping={server.ping} serverIndex={index} serverName={server.name} />

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
      {trafficOpen && <TrafficDialog server={server} close={() => setTrafficOpen(false)} />}
      {cpuOpen && <SystemTrendDialog serverIndex={index} title={name} metric="cpu" close={() => setCpuOpen(false)} />}
      {memOpen && <SystemTrendDialog serverIndex={index} title={name} metric="mem" close={() => setMemOpen(false)} />}
      {diskOpen && <SystemTrendDialog serverIndex={index} title={name} metric="disk" close={() => setDiskOpen(false)} />}
    </>
  )
}

// 「4 核 · 8 线程」；线程数与核心数相同时只写核心
function cpuCoresLabel(server: ProbeServer): string | undefined {
  const cores = server.cpu_cores ? `${server.cpu_cores} 核` : ''
  const threads = server.cpu_threads && server.cpu_threads !== server.cpu_cores ? `${server.cpu_threads} 线程` : ''
  return [cores, threads].filter(Boolean).join(' · ') || undefined
}

// 离线卡片的规格行：「2 核 · 1 GB 内存 · 20 GB 硬盘」
function specsLabel(server: ProbeServer): string | undefined {
  const parts = [
    server.cpu_cores ? `${server.cpu_cores} 核` : '',
    server.mem_total ? `${formatSize(server.mem_total)} 内存` : '',
    server.disk_total ? `${formatSize(server.disk_total)} 硬盘` : '',
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : undefined
}

const healthLabels: Record<ProbeHealthIssue['key'], string> = { cpu: 'CPU', mem: '内存', disk: '硬盘', traffic: '流量' }

function ServerCard({ server, index, dense = false }: { server: ProbeServer; index: number; /** 紧凑模式：只留占用、流量和网速，一屏放更多台 */ dense?: boolean }) {
  const networkSpeed = useNetworkSpeed()
  const [trafficOpen, setTrafficOpen] = useState(false)
  const name = server.name || `服务器 ${index + 1}`
  const flag = regionFlag(server.region)
  const issue = probeHealthIssue(server, server.traffic_used)
  const hasMetric = server.cpu_pct !== undefined || (server.mem_total ?? 0) > 0 || (server.disk_total ?? 0) > 0
  const cpuInfo = [server.cpu_model, cpuCoresLabel(server)].filter(Boolean).join(' · ') || undefined
  const trafficPct = pct(server.traffic_used, server.traffic_limit)
  const openDetail = () => { location.hash = `#/server/${index}` }
  const meta = (server.expires_at || server.renewal_price !== undefined || isPermanent(server)) && (
    <div className="server-meta" onClick={(event) => event.stopPropagation()}>
      {isPermanent(server) && <span><CalendarClock size={13} />永久</span>}
      {!isPermanent(server) && server.expires_at &&
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
  )
  const title = (
    <div className="server-title">
      <span className={server.online ? 'status online' : 'status'} />
      <h2>
        <Twemoji>{flag && !hasLeadingFlag(name) ? `${flag} ${name}` : name}</Twemoji>
      </h2>
      {issue ? (
        <em className="health-badge bad" title={`${healthLabels[issue.key]}占用超过 ${PROBE_ALERT_PCT}%`}>
          <TriangleAlert size={11} />
          {healthLabels[issue.key]} {issue.pct.toFixed(0)}%
        </em>
      ) : server.online && hasMetric && <em className="health-badge ok">健康</em>}
      <i className="server-title-gap" />
      <UnlockButton server={server} />
      <span title={systemTitle(server)} onClick={(event) => event.stopPropagation()}>
        <SystemIcon server={server} />
      </span>
      <span>
        <i className="detail-hint">详情 ›</i>
      </span>
    </div>
  )
  const cardProps = {
    onClick: openDetail,
    role: 'button',
    tabIndex: 0,
    title: '点击查看详情',
    onKeyDown: (event: React.KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openDetail() } },
  }
  // 离线：数据都是旧的，只留规格、最后在线时间和续费信息
  if (!server.online) {
    const specs = specsLabel(server)
    return (
      <article className={`server-card offline${dense ? ' dense' : ''}`} {...cardProps}>
        {title}
        {specs && <div className="server-specs">{specs}</div>}
        <div className="offline-note">
          离线{server.last_seen && relativeTime(server.last_seen) && ` · 最后在线 ${relativeTime(server.last_seen)}`}
        </div>
        {meta}
      </article>
    )
  }
  // 计费用量：按周期统计的写「本周期」，其余（计数器累计、按累计值估算）写「计数器重置以来」，与主控探针页同一叫法
  const trafficLabel = server.traffic_used_scope && server.traffic_used_scope !== 'configured_period' ? '计数器重置以来计费用量' : '本周期计费用量'
  const bootDown = server.boot_traffic_down ?? server.cumulative_down
  const bootUp = server.boot_traffic_up ?? server.cumulative_up
  return (
    <>
    <article className={`server-card probe-card${dense ? ' dense' : ''}`} data-alert={issue ? 'true' : undefined} {...cardProps}>
      {title}
      <div className="metrics">
        {server.cpu_pct !== undefined && <Meter icon={<Cpu size={14} />} label="CPU" value={`${server.cpu_pct.toFixed(1)}%`} percent={server.cpu_pct} sub={cpuCoresLabel(server)} title={cpuInfo} />}
        {server.mem_total !== undefined && <Meter icon={<MemoryStick size={14} />} label="内存" value={`${pct(server.mem_used, server.mem_total).toFixed(1)}%`} percent={pct(server.mem_used, server.mem_total)} sub={server.mem_total > 0 ? formatCapacity(server.mem_used ?? 0, server.mem_total) : undefined} />}
        {server.disk_total !== undefined && <Meter icon={<HardDrive size={14} />} label="硬盘" value={`${pct(server.disk_used, server.disk_total).toFixed(1)}%`} percent={pct(server.disk_used, server.disk_total)} sub={server.disk_total > 0 ? formatCapacity(server.disk_used ?? 0, server.disk_total) : undefined} />}
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
                <span className="metric-label">{trafficLabel}</span>
              </span>
              <strong>
                {server.traffic_limit ? `${bytes(server.traffic_used, false)} / ${bytes(server.traffic_limit, false)}` : bytes(server.traffic_used, false)}
              </strong>
            </div>
            <div className="meter">
              <i className={trafficPct > PROBE_ALERT_PCT ? 'bad' : undefined} style={{ width: `${trafficPct}%` }} />
            </div>
            <div className="metric-sub">
              <span>{server.traffic_limit ? `${trafficPct.toFixed(0)}%` : '不限量'}</span>
              {server.period_end && <span>{server.period_end.slice(5, 10).replace('-', '/')} 重置</span>}
            </div>
          </button>
        )}
      </div>
      <div className="net-boxes">
        <div className="net-box">
          <span className="net-box-label">网速</span>
          <span className="download" title={`下行 ${networkSpeed(server.download_speed)}`}>↓ {networkSpeed(server.download_speed)}</span>
          <span className="upload" title={`上行 ${networkSpeed(server.upload_speed)}`}>↑ {networkSpeed(server.upload_speed)}</span>
        </div>
        <ConnectionBox server={server} serverIndex={index} />
        <div className="net-box" title="本次开机以来网卡收发">
          <span className="net-box-label">开机以来</span>
          <span>↓ <b>{bootDown !== undefined ? bytes(bootDown, false) : '—'}</b></span>
          <span>↑ <b>{bootUp !== undefined ? bytes(bootUp, false) : '—'}</b></span>
        </div>
      </div>
      {!dense && <CardPingGroups variant="probe" ping={server.ping} serverIndex={index} serverName={server.name} />}
      {!dense && !!server.return_routes?.length && <ReturnRouteBadges routes={server.return_routes} telecomPaidPeer={server.telecom_paid_peer} variant={document.documentElement.classList.contains('theme-anime') ? 'anime' : undefined} />}
      {meta}
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
  const networkSpeed = useNetworkSpeed()
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
              <span className="mini-speed" title={`下行 ${networkSpeed(server.download_speed)}${server.upload_speed !== undefined ? ` / 上行 ${networkSpeed(server.upload_speed)}` : ''}`}>
                <ArrowDown size={12} />
                {networkSpeed(server.download_speed)}
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
        <UnlockButton server={server} />
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
          {isPermanent(server) && <span><CalendarClock size={13} />永久</span>}
          {!isPermanent(server) && server.expires_at && (
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
            <span title={`下行 ${networkSpeed(server.download_speed)}`}>
              <ArrowDown size={12} />
              {networkSpeed(server.download_speed)}
            </span>
          )}
          {server.upload_speed !== undefined && (
            <span title={`上行 ${networkSpeed(server.upload_speed)}`}>
              <ArrowUp size={12} />
              {networkSpeed(server.upload_speed)}
            </span>
          )}
        </div>
      )}
      <ConnectionCounts server={server} variant="card" />
      {expanded && <ConnectionHistory server={server} serverIndex={index} />}
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

// 表格流量列: 计费口径总量 + 周期上下行小字(物理口径) + 周期区间 + 点击弹日流量趋势
function TrafficCell({ server }: { server: ProbeServer }) {
  const [open, setOpen] = useState(false)
  if (server.traffic_used === undefined) return <span className="dash">—</span>
  const showDetail = server.traffic_used_up !== undefined || server.traffic_used_down !== undefined
  return (
    <>
      <button
        type="button"
        className={`table-traffic${server.daily_traffic?.length ? ' table-traffic-button' : ''}`}
        onClick={(event) => { event.stopPropagation(); server.daily_traffic?.length && setOpen(true) }}
        title={server.daily_traffic?.length ? '查看日流量趋势' : undefined}
      >
        <span className="table-traffic-main">
          {server.traffic_limit ? `${bytes(server.traffic_used, false)} / ${bytes(server.traffic_limit, false)}` : bytes(server.traffic_used, false)}
        </span>
        {showDetail && (
          <small className="table-traffic-ud">
            ↑ {bytes(server.traffic_used_up, false)} · ↓ {bytes(server.traffic_used_down, false)}
          </small>
        )}
        {server.period_start && server.period_end && (
          <small className="table-traffic-period">{server.period_start.slice(5)} — {server.period_end.slice(5)}</small>
        )}
        {!!server.traffic_limit && (
          <div className="meter">
            <i style={{ width: `${pct(server.traffic_used, server.traffic_limit)}%` }} />
          </div>
        )}
      </button>
      {open && <TrafficDialog server={server} close={() => setOpen(false)} />}
    </>
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
  const networkSpeed = useNetworkSpeed()
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
                    <div className="probe-unlock-name-line"><Twemoji>{server.name || `服务器 ${index + 1}`}</Twemoji><UnlockButton server={server} /></div>
                    {server.region && <small>{server.region}</small>}
                    {isPermanent(server) && <small>永久</small>}
                    {!isPermanent(server) && server.expires_at &&
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
                        {networkSpeed(server.upload_speed)}
                      </span>
                      <span>
                        <ArrowDown size={14} />
                        {networkSpeed(server.download_speed)}
                      </span>
                    </span>
                  </td>
                  <td>
                    <TrafficCell server={server} />
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

type ProbeFilter = 'all' | 'online' | 'offline' | 'expiring' | 'expired' | 'renewal' | 'alert'
type ProbeGroupBy = 'none' | 'region'
type ProbeDensity = 'standard' | 'dense'

// 工具条的排序 / 分组 / 紧凑选择记在浏览器里；隐私模式等拿不到存储时照常工作
function readPref<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
  } catch {
    return fallback
  }
}
function writePref(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* 隐私模式下不记忆 */ }
}

// 汇总区的一格（照主控 v0.6.1-beta.3 探针页）：标题、大数字、说明三行定高；aside 是右栏小图（至少 96px），格子太窄时不显示。
// 可点击的格子同时是筛选入口
function Kpi({ icon, label, value, sub, aside, onClick, active, title }: { icon: ReactNode; label: string; value: ReactNode; sub?: ReactNode; aside?: ReactNode; onClick?: () => void; active?: boolean; title?: string }) {
  const className = ['kpi-cell', aside ? 'has-aside' : '', active ? 'active' : ''].filter(Boolean).join(' ')
  const body = <>
    <span className="kpi-main">
      <span className="kpi-label">{icon}<span>{label}</span></span>
      <strong className="kpi-value">{value}</strong>
      {sub && <span className="kpi-sub">{sub}</span>}
    </span>
    {aside && <span className="kpi-aside" aria-hidden="true">{aside}</span>}
  </>
  return onClick ? <button type="button" className={className} aria-pressed={active} onClick={onClick} title={title}>{body}</button> : <div className={className} title={title}>{body}</div>
}

// 指标格底部的小面积图：多条序列共用纵轴，null 断开
function KpiSpark({ series, height }: { series: Array<{ values: Array<number | null>; tone: string }>; height: number }) {
  const max = Math.max(1, ...series.flatMap((item) => item.values.filter((v): v is number => typeof v === 'number')))
  const width = 100
  return (
    <svg className="kpi-spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ height }} aria-hidden="true">
      {series.map((item, index) => {
        const n = item.values.length
        if (n < 2) return null
        const points = item.values.map((v, i) => typeof v === 'number' ? [(i / (n - 1)) * width, height - 2 - (v / max) * (height - 4)] as const : null)
        const valid = points.filter((p): p is readonly [number, number] => !!p)
        if (valid.length < 2) return null
        const line = valid.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('')
        const area = `${line}L${valid[valid.length - 1][0].toFixed(1)} ${height}L${valid[0][0].toFixed(1)} ${height}Z`
        return <g key={index} className={item.tone}><path className="kpi-spark-area" d={area} /><path className="kpi-spark-line" d={line} /></g>
      })}
    </svg>
  )
}

// 本页打开后的全站网速采样（随快照刷新），留最近 3 分钟，用来画实时网速曲线和峰值
const SPEED_WINDOW_MS = 3 * 60 * 1000
function useSpeedHistory(servers: ProbeServer[] | undefined) {
  const [samples, setSamples] = useState<Array<{ t: number; up: number; down: number }>>([])
  useEffect(() => {
    if (!servers?.length) return
    const now = Date.now()
    const up = servers.reduce((sum, server) => sum + (server.upload_speed || 0), 0)
    const down = servers.reduce((sum, server) => sum + (server.download_speed || 0), 0)
    setSamples((prev) => [...prev.filter((item) => now - item.t <= SPEED_WINDOW_MS), { t: now, up, down }])
  }, [servers])
  return samples
}

export function App() {
  const probe = useProbe()
  const hasData = !!probe.data
  // 首帧数据渲染完再在空闲时预取图表模块，不和主题包、首帧数据抢带宽
  useEffect(() => { if (hasData) prefetchDeferred() }, [hasData])
  return <ProbeHistoryDaysContext.Provider value={probe.data?.history_days}><StaleDataBanner error={probe.error} updatedAt={probe.updatedAt} /><ProbeApp {...probe} /></ProbeHistoryDaysContext.Provider>
}

function ProbeApp({ data, error }: ReturnType<typeof useProbe>) {
  const [boardsOpen, setBoardsOpen] = useState(false)
  const networkSpeed = useNetworkSpeed()
  const servers = data?.servers || []
  const [view, setView] = useState<'card' | 'list' | 'mini'>(() => (localStorage.getItem('probe-view') as 'card' | 'list' | 'mini') || 'card')
  const [miniExpanded, setMiniExpanded] = useState<boolean>(() => localStorage.getItem('probe-mini-expanded') === '1')
  const [filter, setFilter] = useState<ProbeFilter>('all')
  const speedSamples = useSpeedHistory(data?.servers)
  // 汇总区实际宽度 → 排几列（kpiColumns）；汇总区是条件渲染的，用回调 ref 挂观察器
  const [kpiWidth, setKpiWidth] = useState(0)
  const kpiObserver = useRef<ResizeObserver | null>(null)
  const kpiGridRef = useCallback((el: HTMLDivElement | null) => {
    kpiObserver.current?.disconnect()
    kpiObserver.current = null
    if (!el) return
    const observer = new ResizeObserver(() => setKpiWidth(el.clientWidth))
    observer.observe(el)
    setKpiWidth(el.clientWidth)
    kpiObserver.current = observer
  }, [])
  const [sortKey, setSortKeyState] = useState<ProbeSortKey>(() => readPref('probe-sort', PROBE_SORT_KEYS, 'default'))
  const [groupBy, setGroupByState] = useState<ProbeGroupBy>(() => readPref('probe-group', ['none', 'region'] as const, 'none'))
  const [density, setDensityState] = useState<ProbeDensity>(() => readPref('probe-density', ['standard', 'dense'] as const, 'standard'))
  const setSortKey = (value: ProbeSortKey) => { setSortKeyState(value); writePref('probe-sort', value) }
  const setGroupBy = (value: ProbeGroupBy) => { setGroupByState(value); writePref('probe-group', value) }
  const setDensity = (value: ProbeDensity) => { setDensityState(value); writePref('probe-density', value) }
  const [region, setRegion] = useState('all')
  const [search, setSearch] = useState('')
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
        // 打开详情页：记录主页面滚动位置，供关闭时恢复；详情页从顶部展示(#175 点击榜单项后停留榜单位置看不到详情)
        detailScrollRef.current = window.scrollY
        window.scrollTo(0, 0)
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
  // 主控下发 Lumina-Gold / Lumina-Platinum 时 darkMode state 为 null，但页面已挂 gold/platinum——用 classList 兜底识别，否则循环从错误位置起步
  const isGold = darkMode === 'gold' || (darkMode === null && document.documentElement.classList.contains('gold'))
  const isPlatinum = darkMode === 'platinum' || (darkMode === null && document.documentElement.classList.contains('platinum'))
  // 配色按钮: Lumina 保持四态(浅/暗/黑金/白金); 其余主题三态 auto → 浅色 → 暗色
  const isLuminaTheme = activeTheme === 'lumina'
  const colorMode: 'auto' | 'light' | 'dark' =
    darkMode === 'dark' || darkMode === 'light' ? darkMode : 'auto'
  const toggleDark = () => {
    if (isLuminaTheme) {
      // 四态循环: 浅色 → 暗色 → 黑金 → 白金 → 浅色
      const next = isPlatinum ? 'light' : isGold ? 'platinum' : isDark ? 'gold' : 'dark'
      setDarkOverride(next)
      setDarkMode(next)
    } else {
      // 三态循环: auto → 浅色(太阳) → 暗色(月亮) → auto(去掉 4 态时第二行注释)
      const next = colorMode === 'auto' ? 'light' : colorMode === 'light' ? 'dark' : null
      setDarkOverride(next)
      setDarkMode(next)
    }
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
  // premium 主题: 用户下拉 override 优先，否则主控下发 → 渲染整页 Premium 界面
  if (activeTheme === 'premium') {
    return (
      <Suspense fallback={<main className="center">正在加载 Premium 主题…</main>}>
        <PremiumProbePage data={data} isLoading={false} isError={false} onThemeChange={(name) => { setTheme(name); setThemeState(name); setActiveTheme(name ?? getActiveTheme()) }} />
      </Suspense>
    )
  }
  // glassmorphism 主题: 整页 Glassmorphism 界面（复刻 Komari Glassmorphism 主题）
  if (activeTheme === 'glassmorphism') {
    return (
      <Suspense fallback={<main className="center">正在加载 Glassmorphism 主题…</main>}>
        <GmApp data={data} onThemeChange={(name) => { setTheme(name); setThemeState(name); setActiveTheme(name ?? getActiveTheme()) }} />
      </Suspense>
    )
  }
  // emerald 主题: Komari Emerald 设计语言 + StatusShow 动效增强。
  if (activeTheme === 'emerald') {
    return (
      <Suspense fallback={<main className="center">正在加载 Emerald 主题…</main>}>
        <EmeraldApp data={data} onThemeChange={(name) => { setTheme(name); setThemeState(name); setActiveTheme(name ?? getActiveTheme()) }} />
      </Suspense>
    )
  }
  if (activeTheme === 'luminaplus') {
    return (
      <Suspense fallback={<main className="center">正在加载 LuminaPlus 主题…</main>}>
        <LuminaPlusApp data={data} error={error} onThemeChange={(name) => { setTheme(name); setThemeState(name); setActiveTheme(name ?? getActiveTheme()) }} />
        {detailIndex !== null && servers[detailIndex] && <MiniServerDetail key={detailIndex} server={servers[detailIndex]} index={detailIndex} onClose={closeDetail} showHealthScore={data.show_health_score === true} />}
      </Suspense>
    )
  }
  if (activeTheme === 'nezha') {
    return (
      <Suspense fallback={<main className="center">正在加载哪吒主题…</main>}>
        <NezhaApp data={data} error={error} onThemeChange={(name) => { setTheme(name); setThemeState(name); setActiveTheme(name ?? getActiveTheme()) }} />
        {detailIndex !== null && servers[detailIndex] && <MiniServerDetail key={detailIndex} server={servers[detailIndex]} index={detailIndex} onClose={closeDetail} showHealthScore={data.show_health_score === true} />}
      </Suspense>
    )
  }
  if (activeTheme === 'lite') {
    return (
      <Suspense fallback={<main className="center">正在加载 Lite 主题…</main>}>
        <MiniApp data={data} error={error} onThemeChange={(name) => { setTheme(name); setThemeState(name); setActiveTheme(name ?? getActiveTheme()) }} />
        {detailIndex !== null && servers[detailIndex] && <MiniServerDetail key={detailIndex} server={servers[detailIndex]} index={detailIndex} onClose={closeDetail} showHealthScore={data.show_health_score === true} />}
      </Suspense>
    )
  }
  const title = data.title?.trim() || '服务器状态'
  const onlineCount = servers.filter((server) => server.online).length
  const offlineCount = servers.length - onlineCount
  const expiringCount = servers.filter(expiring).length
  const expiredCount = servers.filter(expired).length
  const renewalServers = servers.filter((server) => expiring(server) || expired(server))
  const renewalCount = renewalServers.length
  const renewalAmount = renewalServers.reduce((sum, server) => sum + (renewalPriceCny(server) ?? 0), 0)
  const regions = [...new Set(servers.map((server) => server.region?.trim()).filter((value): value is string => !!value))].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  const hasExpiry = servers.some((server) => !!server.expires_at)
  const healthOf = (server: ProbeServer) => probeHealthIssue(server, server.traffic_used)
  const alertCount = servers.filter((server) => !!healthOf(server)).length
  const hasMetrics = servers.some((server) => server.cpu_pct !== undefined || server.mem_total !== undefined || server.disk_total !== undefined || server.traffic_used !== undefined)
  const selectFilter = (next: ProbeFilter) => { setFilter(next); setRegion('all') }
  const query = search.trim().toLowerCase()
  const visible = sortProbeServers(
    servers.map((server, index) => ({ server, index })).filter(({ server }) => {
      const matchesStatus = filter === 'all' || (filter === 'online' && server.online) || (filter === 'offline' && !server.online) || (filter === 'expiring' && expiring(server)) || (filter === 'expired' && expired(server)) || (filter === 'renewal' && (expiring(server) || expired(server))) || (filter === 'alert' && !!healthOf(server))
      if (!matchesStatus) return false
      if (region !== 'all' && server.region?.trim() !== region) return false
      if (query) {
        const haystack = [server.name, server.region, server.region_name, server.region_city, server.region_country, server.provider_name].filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    }),
    sortKey,
    (server) => (server as ProbeServer).traffic_used,
  )
  // 按地区分组（仅卡片视图）：组按地区名排，没设地区的放最后
  const grouped = view === 'card' && groupBy === 'region'
  const groups = grouped
    ? [...visible.reduce((map, item) => {
        const key = item.server.region?.trim() || ''
        map.set(key, [...(map.get(key) ?? []), item])
        return map
      }, new Map<string, typeof visible>()).entries()]
        .sort(([a], [b]) => (!a ? 1 : !b ? -1 : a.localeCompare(b, 'zh-CN')))
        .map(([key, items]) => ({ key: key || '__none__', label: key ? regionGroupLabel(key) : '未设置地区', items }))
    : [{ key: '__all__', label: '', items: visible }]
  // Lumina 卡片自带紧凑排版，紧凑模式只作用于经典卡片
  const dense = density === 'dense' && activeTheme !== 'lumina'
  const hasSpeed = servers.some((server) => server.upload_speed !== undefined || server.download_speed !== undefined)
  const totalUpload = servers.reduce((sum, server) => sum + (server.upload_speed || 0), 0)
  const totalDownload = servers.reduce((sum, server) => sum + (server.download_speed || 0), 0)
  const globeRegions = servers.map((server) => server.region_country || server.region || '').filter(Boolean)
  const showGlobe = !!data.show_globe && globeRegions.length > 0
  // 旗帜、国家代码两种写法按国家代码去重（同一地区有的机器只报旗帜）
  const regionCount = new Set(globeRegions.map((value) => globeCountryCode(value) || value.trim().toUpperCase())).size
  const assets = assetStats(servers)
  const connections = connectionTotals(servers)
  // 主控 v0.6.1-beta.3 起公开日流量放宽到 14 天，柱状图跟着显示 14 根；旧主控只有 7 天时照实显示
  const dailyTotals = dailyTrafficTotals(servers, 14)
  const todayTraffic = dailyTotals.at(-1)?.total
  const recentTraffic = dailyTotals.reduce((sum, day) => sum + day.total, 0)
  const quota = quotaSummary(servers)
  // 汇总格右栏：额度每台一根柱、续费列出最近到期的三台
  const quotaBars = quotaPerServer(servers)
  const expiries = upcomingExpiries(servers)
  const quality = networkQuality(servers)
  const monthlyTotal = servers.reduce((sum, server) => { const cost = monthlyCost(server); return cost > 0 && !isPermanent(server) ? sum + cost : sum }, 0)
  const nearest = servers
    .map((server) => ({ server, at: expiryTimestamp(server) }))
    .filter((item): item is { server: ProbeServer; at: number } => item.at !== undefined && item.at >= Date.now())
    .sort((a, b) => a.at - b.at)[0]
  const peakDown = Math.max(0, ...speedSamples.map((item) => item.down))
  const peakUp = Math.max(0, ...speedSamples.map((item) => item.up))
  const qualityBar = (q: NonNullable<typeof quality>) => {
    const parts = [{ value: q.good, tone: 'ok', label: '优' }, { value: q.medium, tone: 'warn', label: '中' }, { value: q.poor, tone: 'bad', label: '差' }]
    const total = parts.reduce((sum, part) => sum + part.value, 0)
    return <span className="kpi-quality-bar">{total > 0 && parts.map((part) => part.value > 0 && <i key={part.tone} className={part.tone} title={`${part.label} ${part.value}`} style={{ width: `${(part.value / total) * 100}%` }} />)}</span>
  }
  const dailyMax = Math.max(1, ...dailyTotals.map((day) => day.total))
  const kpis = [
    <Kpi
      key="servers"
      icon={<Server size={14} />}
      label="服务器"
      value={<><em className="online">{onlineCount}</em><span className="kpi-unit"> / {servers.length} 在线</span></>}
      sub={<>离线 <b className={offlineCount > 0 ? 'offline' : ''}>{offlineCount}</b> · 告警 <b className={alertCount > 0 ? 'offline' : ''}>{alertCount}</b>{regionCount > 0 && ` · ${regionCount} 个地区`}</>}
      active={filter === 'all'}
      onClick={() => selectFilter('all')}
    />,
    hasSpeed && (
      <Kpi
        key="speed"
        icon={<Activity size={14} />}
        label="实时网速"
        value={<span className="kpi-speed"><span className="down">↓ {networkSpeed(totalDownload)}</span><span className="up">↑ {networkSpeed(totalUpload)}</span></span>}
        sub={speedSamples.length > 1 ? `峰值 ↓ ${networkSpeed(peakDown)} · ↑ ${networkSpeed(peakUp)}` : '全部服务器合计'}
        title={speedSamples.length > 1 ? `全部服务器合计；曲线和峰值为本页打开后近 3 分钟` : undefined}
        aside={speedSamples.length > 1 && <KpiSpark series={[{ values: speedSamples.map((item) => item.down), tone: 'down' }, { values: speedSamples.map((item) => item.up), tone: 'up' }]} height={68} />}
      />
    ),
    connections && (
      <Kpi
        key="connections"
        icon={<Network size={14} />}
        label="连接数"
        value={connections.total.toLocaleString('en-US')}
        sub={`TCP ${connections.tcp.toLocaleString('en-US')} · UDP ${connections.udp.toLocaleString('en-US')}`}
        aside={connections.tcpHistory && connections.tcpHistory.length > 1 && <KpiSpark series={[{ values: connections.tcpHistory, tone: 'tcp' }, { values: connections.udpHistory ?? [], tone: 'udp' }]} height={68} />}
      />
    ),
    todayTraffic !== undefined && (
      <Kpi
        key="today"
        icon={<ChartColumn size={14} />}
        label="今日流量"
        value={bytes(todayTraffic, false)}
        sub={`近 ${dailyTotals.length} 天 ${bytes(recentTraffic, false)}`}
        title={dailyTotals.map((day) => `${day.date.slice(5)} ${bytes(day.total, false)}`).join('\n')}
        aside={<span className="kpi-columns">{dailyTotals.map((day, index) => <i key={day.date} className={index === dailyTotals.length - 1 ? 'today' : undefined} style={{ height: `${Math.max(4, (day.total / dailyMax) * 100)}%` }} />)}</span>}
      />
    ),
    (quota || quality) && (
      <Kpi
        key="quota"
        icon={<Gauge size={14} />}
        label={quota && quality ? '本期流量额度 · 网络质量' : quota ? '本期流量额度' : '网络质量'}
        aside={quotaBars.length > 0 && <span className="kpi-quota-bars">{quotaBars.map((bar, index) => <i key={`${bar.name}-${index}`} className={meterTone(bar.pct) ?? undefined} style={{ height: `${Math.max(4, bar.pct)}%` }} />)}</span>}
        value={<span className="kpi-pair">{quota && <span>{quota.pct.toFixed(0)}%</span>}{quality && <span>{quality.latency.toFixed(0)}<span className="kpi-unit"> ms</span></span>}</span>}
        sub={<span className="kpi-quota-line">
          {quota && <>
            <span className="kpi-mini-bar"><i className={meterTone(quota.pct) ?? undefined} style={{ width: `${Math.min(100, quota.pct)}%` }} /></span>
            <span>{bytes(quota.used, false)} / {bytes(quota.limit, false)}</span>
          </>}
          {quality && <>
            {qualityBar(quality)}
            {quality.loss !== undefined && <span>丢包 {quality.loss.toFixed(1)}%</span>}
          </>}
        </span>}
        title={[
          quota && `本期流量额度：设了限额的 ${quota.count} 台合计 ${bytes(quota.used, false)} / ${bytes(quota.limit, false)}${quota.over80 ? `，${quota.over80} 台超 80%` : ''}`,
          quotaBars.length > 0 && `用量最高：${quotaBars.slice(0, 3).map((bar) => `${bar.name || '未命名服务器'} ${bar.pct.toFixed(0)}%`).join('、')}`,
          quality && `网络质量：在线服务器近 1 小时平均延迟 ${quality.latency.toFixed(0)} ms${quality.loss !== undefined ? `、丢包 ${quality.loss.toFixed(1)}%` : ''}；优 ${quality.good} · 中 ${quality.medium} · 差 ${quality.poor}（丢包 ≥10% 或延迟 ≥250ms 为差，丢包 ≥3% 或延迟 ≥120ms 为中）`,
        ].filter(Boolean).join('\n')}
      />
    ),
    hasExpiry && (
      <Kpi
        key="renewal"
        icon={<Wallet size={14} />}
        label="续费"
        value={<><em className={renewalCount > 0 ? 'warn' : undefined}>{renewalCount}</em><span className="kpi-unit"> 台 30 天内到期</span></>}
        sub={<>
          {[`¥${renewalAmount.toFixed(2)}`, monthlyTotal > 0 && `月均 ¥${monthlyTotal.toFixed(0)}`].filter(Boolean).join(' · ')}
          {/* 右栏列出最近到期的几台时不重复；格子太窄、右栏隐藏时才显示 */}
          {nearest && <span className="kpi-nearest"> · 最近 {nearest.server.name || '未命名服务器'} {Math.max(0, Math.ceil((nearest.at - Date.now()) / 86400000))} 天</span>}
        </>}
        aside={expiries.length > 0 && <span className="kpi-expiry-list">{expiries.map((item, index) => <span key={`${item.name}-${index}`}><span>{item.name || '未命名服务器'}</span><span className={item.days < 0 ? 'gone' : item.days <= 7 ? 'soon' : undefined}>{item.days < 0 ? `过期 ${-item.days} 天` : `${item.days} 天`}</span></span>)}</span>}
        title={assets ? `剩余价值 ${formatMoney(assets.totalValue, 'CNY', true)} · 覆盖 ${assets.priced} / ${servers.length} 台` : undefined}
        active={filter === 'renewal'}
        onClick={() => selectFilter('renewal')}
      />
    ),
  ].filter(Boolean)
  // 右侧地区卡片：小地球 + 各国家 / 地区台数（按台数从多到少）
  const regionChips = [...globeRegions.reduce((map, value) => {
    const code = globeCountryCode(value) || value.trim().toUpperCase()
    map.set(code, (map.get(code) ?? 0) + 1)
    return map
  }, new Map<string, number>())].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const renderCard = (server: ProbeServer, index: number) => activeTheme === 'lumina'
    ? <ServerCardLumina key={server.name || index} server={server} index={index} />
    : <ServerCard key={server.name || index} server={server} index={index} dense={dense} />
  return (
    <div className='app-shell'>
      <header className="topbar">
        <div>
          {data.logo && <img src={data.logo} alt="" />}
          <h1>{title}</h1>
        </div>
        <nav>
          <PasskeyLogin />
          <button aria-label="卡片视图" title="卡片视图" className={view === 'card' ? 'active' : ''} onClick={() => setMode('card')}>
            <LayoutGrid size={18} />
          </button>
          <button aria-label={miniExpanded ? '极简卡片展开视图' : '极简卡片视图'} title={view === 'mini' ? (miniExpanded ? '极简卡片展开视图（再点收起）' : '极简卡片视图（再点展开多行）') : '极简卡片视图'} className={view === 'mini' ? 'active' : ''} onClick={() => { if (view === 'mini') { toggleMiniExpanded() } else { setMode('mini') } }}>
            {miniExpanded ? <Rows4 size={18} /> : <Rows3 size={18} />}
          </button>
          <button aria-label="列表视图" title="列表视图" className={view === 'list' ? 'active' : ''} onClick={() => setMode('list')}>
            <List size={18} />
          </button>
          <button aria-label="切换配色" title={isLuminaTheme ? (isPlatinum ? '切换浅色模式' : isGold ? '切换白金配色' : isDark ? '切换黑金配色' : '切换暗色模式') : colorMode === 'auto' ? '自动模式（跟随主控/时间）· 点击切换' : colorMode === 'light' ? '白色模式 · 点击切换' : '黑色模式 · 点击切换'} onClick={toggleDark}>
            {isLuminaTheme ? (
              isPlatinum ? <Crown size={18} /> : isGold ? <Gem size={18} /> : isDark ? <Sun size={18} /> : <Moon size={18} />
            ) : colorMode === 'auto' ? (
              <SunMoon size={18} />
            ) : colorMode === 'light' ? (
              <Sun size={18} />
            ) : (
              <Moon size={18} />
            )}
          </button>
          <ThemeSelect value={theme} onChange={(name) => { setTheme(name); setThemeState(name); setActiveTheme(name ?? getActiveTheme()) }} />
        </nav>
      </header>
      {servers.length > 0 && (
        <section className={`overview${showGlobe ? ' with-globe' : ''}`}>
          <div className="kpi-panel"><div ref={kpiGridRef} className="kpi-grid" style={{ gridTemplateColumns: `repeat(${kpiColumns(kpis.length, kpiWidth)}, minmax(0, 1fr))` }}>{kpis}</div></div>
          {showGlobe && (
            <aside className="globe-card globe-mini" aria-label="地区分布">
              <div className="globe-mini-stage">
                <Suspense fallback={<div className="globe-loading">加载中…</div>}>
                  <RegionGlobe regions={globeRegions} compact />
                </Suspense>
              </div>
              <div className="globe-mini-info">
                <span className="kpi-label"><Globe2 size={14} /><span>地区分布</span></span>
                <span className="globe-mini-count">{regionCount} 个地区 · {globeRegions.length} 台</span>
                <div className="globe-mini-chips">
                  {regionChips.map(([code, count]) => <span key={code} title={regionGroupLabel(code)}><b>{code}</b>{count}</span>)}
                </div>
              </div>
            </aside>
          )}
        </section>
      )}
      <div className="globe-row">
        <Leaderboard servers={servers} open={boardsOpen} onToggle={() => setBoardsOpen((value) => !value)} />
        <Leaderboard servers={servers} open={boardsOpen} onToggle={() => setBoardsOpen((value) => !value)} initialTab={LEADERBOARD_ORDER[1]} secondary />
      </div>
      <ForwardOverview data={data} />
      <section className="probe-toolbar">
        <div className="filters">
          <label className="server-search">
            <Search size={14} />
            <input
              type="search"
              aria-label="搜索节点"
              placeholder="搜索服务器…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className="filter-seg" role="group" aria-label="状态筛选">
            {([
              ['all', '全部', servers.length, ''],
              ['online', '在线', onlineCount, ''],
              ['offline', '离线', offlineCount, offlineCount > 0 ? 'bad' : ''],
              ...(hasMetrics ? [['alert', '告警', alertCount, alertCount > 0 ? 'bad' : '']] : []),
              ...(hasExpiry ? [
                ['renewal', '待续费', renewalCount, renewalCount > 0 ? 'warn' : ''],
                ['expiring', '即将到期', expiringCount, expiringCount > 0 ? 'warn' : ''],
                ['expired', '已到期', expiredCount, expiredCount > 0 ? 'bad' : ''],
              ] : []),
            ] as Array<[ProbeFilter, string, number, string]>).map(([key, label, count, tone]) => (
              <button
                key={key}
                type="button"
                className={filter === key ? 'active' : ''}
                aria-pressed={filter === key}
                title={key === 'alert' ? `CPU、内存、硬盘或计费用量超过 ${PROBE_ALERT_PCT}%` : undefined}
                onClick={() => selectFilter(key)}
              >
                {label} <span className={`filter-count${tone ? ` ${tone}` : ''}`}>{count}</span>
              </button>
            ))}
          </div>
          <div className="toolbar-end">
            {regions.length > 0 && <RegionSelect regions={regions} value={region} onChange={setRegion} />}
            <label className="toolbar-select">
              排序
              <select aria-label="排序" value={sortKey} onChange={(event) => setSortKey(event.target.value as ProbeSortKey)}>
                {PROBE_SORT_KEYS.map((key) => <option value={key} key={key}>{PROBE_SORT_LABELS[key]}</option>)}
              </select>
            </label>
            {view === 'card' && regions.length > 0 && (
              <label className="toolbar-select">
                分组
                <select aria-label="分组" value={groupBy} onChange={(event) => setGroupBy(event.target.value as ProbeGroupBy)}>
                  <option value="none">不分组</option>
                  <option value="region">按地区</option>
                </select>
              </label>
            )}
            {view === 'card' && activeTheme !== 'lumina' && (
              <span className="filter-seg density-toggle" role="group" aria-label="卡片密度">
                <button type="button" className={density === 'standard' ? 'active' : ''} aria-pressed={density === 'standard'} onClick={() => setDensity('standard')}>标准</button>
                <button type="button" className={density === 'dense' ? 'active' : ''} aria-pressed={density === 'dense'} onClick={() => setDensity('dense')}>紧凑</button>
              </span>
            )}
          </div>
        </div>
      </section>
      <main className={`servers ${view}${view === 'card' ? ' grouped' : ''}`}>
        {visible.length ? view === 'card' ? groups.map((group) => (
          <section key={group.key} className="server-group">
            {grouped && (
              <h2 className="group-heading">
                <Twemoji>{group.label}</Twemoji>
                <small>{group.items.length} 台</small>
              </h2>
            )}
            <div className={['server-grid', dense ? 'dense' : '', grouped ? 'fill' : ''].filter(Boolean).join(' ')}>
              {group.items.map(({ server, index }) => renderCard(server, index))}
            </div>
          </section>
        )) : view === 'mini' ? visible.map(({ server, index }) => <ServerMiniCard key={server.name || index} server={server} index={index} expanded={miniExpanded} />) : <ServerTable servers={visible.map(({ server }) => server)} /> : <div className="empty">暂无符合条件的服务器</div>}
      </main>
      <footer>
        Powered by{' '}
        <a href="https://github.com/mmwx-group" target="_blank" rel="noreferrer">
          MMWX Group
        </a>
      </footer>
      {/* 许可证放在页面末尾并带动画开关（与 LuminaPlus、Premium 一致）；开关按主题分别记忆 */}
      <ProbeLicenseBar badges={data.license_badge} storageKey={`jiwo-${activeTheme}-license-anim`} className="probe-license-bar" toggleClassName="probe-license-toggle" />
      {detailIndex !== null && servers[detailIndex] && (
        <ServerDetail
          server={servers[detailIndex]}
          index={detailIndex}
          onClose={closeDetail}
          showHealthScore={data?.show_health_score === true}
        />
      )}
    </div>
  )
}
