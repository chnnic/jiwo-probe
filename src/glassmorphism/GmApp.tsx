import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Check,
  ChevronDown,
  Clock3,
  Cpu,
  Database,
  Globe2,
  HardDrive,
  LayoutGrid,
  MemoryStick,
  Moon,
  Palette,
  PieChart,
  Search,
  Sun,
  Table2,
  Wallet,
  X,
} from 'lucide-react'
import type { ProbePayload, ProbeServer, ThemeName } from '../types'
import { computeRemainingValue, formatMoney } from '../value'
import { flagToCountryCode } from '../country-flag'
import { Twemoji } from '../Twemoji'
import './gm.css'
import { ServerDetail } from '../ServerDetail'
import { useVisitorInfo } from '../ran/hooks/useVisitorInfo'
import {
  PingPanel,
  ReturnRouteBadges,
  SystemIcon,
  TrafficDialog,
  TrendDialog,
  averagePing,
  bytes,
  expiring,
  expired,
  hasLeadingFlag,
  pct,
  regionFlag,
  remainingDays,
  speed,
} from '../App'
import type { EnrichedServer } from '../use-probe'
import { GmEarth, type GmRegion } from './GmEarth'

const THEME_OPTIONS: { value: ThemeName; label: string }[] = [
  { value: 'pixel', label: '像素' },
  { value: 'flat', label: '扁平' },
  { value: 'anime', label: '动漫' },
  { value: 'glass', label: '玻璃' },
  { value: 'lumina', label: 'Lumina' },
  { value: 'premium', label: 'Premium' },
  { value: 'ran', label: '岚 · Ran' },
  { value: 'glassmorphism', label: 'Glassmorphism' },
]

function formatUptimeDays(seconds: number): string {
  return `${Math.floor(seconds / 86400)} 天`
}

const CYCLE_LABELS: Record<string, string> = { month: '月', quarter: '季', half_year: '半年', year: '年' }

function systemTitle(server: ProbeServer): string {
  const parts = [server.os, server.cpu_model, server.arch].filter(Boolean)
  return parts.join(' · ') || '系统信息'
}

function splitBytesText(value: number): { value: string; unit: string } {
  const v = bytes(value)
  const match = /^([\d.]+)\s*(\w+)?$/.exec(v)
  if (!match) return { value: v, unit: '' }
  return { value: match[1], unit: match[2] || '' }
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

function splitSpeedText(value: number): { value: string; unit: string } {
  const v = bitSpeed(value)
  const match = /^([\d.]+)\s*([\w/]+)?$/.exec(v)
  if (!match) return { value: v, unit: '' }
  return { value: match[1], unit: match[2] || '' }
}

const GM_REGION_NAMES: Record<string, string> = {
  HK: '香港', JP: '日本', SG: '新加坡', US: '美国', KR: '韩国', TW: '台湾',
  GB: '英国', DE: '德国', FR: '法国', NL: '荷兰', RU: '俄罗斯', CA: '加拿大',
  AU: '澳大利亚', BR: '巴西', CN: '中国', IN: '印度', VN: '越南', TH: '泰国',
  MY: '马来西亚', ID: '印度尼西亚', PH: '菲律宾', TR: '土耳其', IT: '意大利',
  ES: '西班牙', SE: '瑞典', CH: '瑞士', FI: '芬兰', PL: '波兰', UA: '乌克兰',
  RO: '罗马尼亚', BG: '保加利亚', CZ: '捷克', AT: '奥地利', LU: '卢森堡',
}

function countryFlag(code?: string): string {
  if (!code || !/^[A-Z]{2}$/.test(code)) return ''
  return String.fromCodePoint(...[...code].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65))
}

function serverRegionKey(server: ProbeServer): string {
  return (
    server.region_country ||
    flagToCountryCode(server.region ?? '') ||
    server.region?.trim() ||
    'UNKNOWN'
  ).toUpperCase()
}

function buildRegions(servers: ProbeServer[]): GmRegion[] {
  const groups = new Map<string, ProbeServer[]>()
  for (const server of servers) {
    const key = serverRegionKey(server)
    const group = groups.get(key) || []
    group.push(server)
    groups.set(key, group)
  }
  return [...groups].map(([code, group]) => {
    const sample = group[0]
    const flag = countryFlag(code)
    const country = GM_REGION_NAMES[code] || ''
    const place = sample.region_city || sample.region_name || ''
    const detail = place && place !== country ? [country, place].filter(Boolean).join(' · ') : country || place
    return {
      code,
      label: [flag, detail || sample.region || '未知地区'].filter(Boolean).join(' '),
      total: group.length,
      online: group.filter((server) => server.online).length,
    }
  })
}

/* ================= 节点卡（照搬 Komari NodeCard 结构） ================= */
function GmNodeCard({ server, index }: { server: EnrichedServer; index: number }) {
  const [trafficOpen, setTrafficOpen] = useState(false)
  const [trendMode, setTrendMode] = useState<'latency' | 'loss' | null>(null)
  const name = server.name || `服务器 ${index + 1}`
  const flag = regionFlag(server.region)
  const isOffline = !server.online
  const cpuPct = server.cpu_pct
  const memPct = server.mem_total ? pct(server.mem_used, server.mem_total) : undefined
  const diskPct = server.disk_total ? pct(server.disk_used, server.disk_total) : undefined
  const trafficPct = server.traffic_limit ? pct(server.traffic_used, server.traffic_limit) : undefined
  const statusOf = (v: number) => (v >= 95 ? 'danger' : v >= 70 ? 'warn' : 'ok')
  const uptimeText = server.uptime !== undefined ? formatUptimeDays(server.uptime) : null
  const priceText =
    server.renewal_price !== undefined
      ? server.renewal_price_cny !== undefined
        ? `¥${server.renewal_price_cny.toFixed(2)} / ${CYCLE_LABELS[server.renewal_cycle || 'month'] || '月'}`
        : `${server.renewal_currency || 'CNY'} ${server.renewal_price} / ${CYCLE_LABELS[server.renewal_cycle || 'month'] || '月'}`
      : null
  const loadParts = (server.loadavg || '').split(/\s+/).map(Number).filter((v) => Number.isFinite(v))
  // 周期流量(物理口径, 与 Lumina 卡同源逻辑)
  let cycleUp = server.traffic_used_up
  let cycleDown = server.traffic_used_down
  if (cycleUp === undefined || cycleDown === undefined) {
    const cycleDaily = server.cycle_daily_traffic ?? server.daily_traffic ?? []
    const dailyUp = cycleDaily.reduce((acc, item) => acc + (item.uplink ?? 0), 0)
    const dailyDown = cycleDaily.reduce((acc, item) => acc + (item.downlink ?? 0), 0)
    const ratio = dailyUp + dailyDown > 0 ? dailyUp / (dailyUp + dailyDown) : 0.5
    const base = server.traffic_used ?? server.traffic_used_total
    if (base !== undefined) {
      cycleUp = base * ratio
      cycleDown = base * (1 - ratio)
    }
  }
  const daysText = server.expires_at ? remainingDays(server.expires_at) : null
  const remainValue = computeRemainingValue(server)
  const remainValueText = remainValue ? formatMoney(remainValue.value, 'CNY', true) : null
  // 延迟/丢包脉冲(平均线 buckets)
  const pingAvg = server.ping?.length ? averagePing(server.ping) : undefined
  const latencyBars: string[] = []
  const lossBars: string[] = []
  const latencyTitles: string[] = []
  const lossTitles: string[] = []
  let avgMs = -1
  let avgLoss = 0
  if (pingAvg) {
    avgMs = pingAvg.current_ms
    avgLoss = pingAvg.loss_pct ?? 0
    for (const bucket of pingAvg.buckets) {
      if (bucket.ms < 0) {
        latencyBars.push('none')
        latencyTitles.push('超时')
      } else if (bucket.ms >= 200) {
        latencyBars.push('bad')
        latencyTitles.push(`${bucket.ms} ms`)
      } else if (bucket.ms >= 100) {
        latencyBars.push('warn')
        latencyTitles.push(`${bucket.ms} ms`)
      } else {
        latencyBars.push('ok')
        latencyTitles.push(`${bucket.ms} ms`)
      }
      const loss = bucket.loss ?? 0
      lossBars.push(loss >= 20 ? 'bad' : loss > 0 ? 'warn' : 'ok')
      lossTitles.push(`${loss.toFixed(1)}%`)
    }
  }
  // 三网回程文字标签
  const carrierLabels: Record<string, string> = { telecom: '电信', unicom: '联通', mobile: '移动' }
  const displayRoute = (route: string): string => {
    const normalized = route.toUpperCase().replace(/[^A-Z0-9]/g, '')
    return normalized === 'CMIN' ? 'CMI' : normalized
  }
  const routeLines = (server.return_routes || [])
    .map((route) => ({ carrier: route.carrier, type: (route.route_type || '').trim() }))
    .filter((route) => route.type && route.type.toLowerCase() !== 'unknown')
    .map((route) => ({ carrier: carrierLabels[route.carrier] || route.carrier, type: displayRoute(route.type) }))

  return (
    <>
      <article
        className={`gm-node-card${isOffline ? ' is-offline' : ''}`}
        role="button"
        tabIndex={0}
        aria-label={`查看节点 ${name} 详情`}
        onClick={() => { location.hash = `#/server/${index}` }}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); location.hash = `#/server/${index}` } }}
      >
        <div className="gm-node-top">
          <div className="gm-node-title-wrap">
            <span className="gm-status-wrap">
              <span className={`status${server.online ? ' online' : ''}`} />
              {server.online && <span className="gm-status-ping" />}
            </span>
            <h2 className="gm-node-title">{name}</h2>
          </div>
          <div className="gm-node-icons">
            <span className="gm-node-os" title={systemTitle(server)} onClick={(event) => event.stopPropagation()}>
              <SystemIcon server={server} />
            </span>
            {flag && <Twemoji className="gm-node-flag">{flag}</Twemoji>}
          </div>
        </div>
        <div className="gm-node-body">
          <div className="gm-node-chips">
            {uptimeText && <span className="gm-chip">在线 {uptimeText}</span>}
            {priceText && <span className="gm-chip">{priceText}</span>}
          </div>
          <div className="gm-node-metrics">
            {cpuPct !== undefined && (
              <div className="gm-metric">
                <div className="gm-metric-head">
                  <span className="gm-metric-label"><Cpu size={13} className="gm-ic-cpu" />CPU</span>
                  <span className="tabular gm-metric-value">{cpuPct.toFixed(1)}%</span>
                </div>
                <div className="gm-meter"><i className={`gm-fill-${statusOf(cpuPct)}`} style={{ width: `${Math.min(100, cpuPct)}%` }} /></div>
                <div className="gm-metric-sub">{loadParts.length ? `${loadParts[0] ?? 0}, ${loadParts[1] ?? 0}, ${loadParts[2] ?? 0}` : '—'}</div>
              </div>
            )}
            {memPct !== undefined && (
              <div className="gm-metric" title="内存使用率">
                <div className="gm-metric-head">
                  <span className="gm-metric-label"><MemoryStick size={13} className="gm-ic-mem" />内存</span>
                  <span className="tabular gm-metric-value">{memPct.toFixed(1)}%</span>
                </div>
                <div className="gm-meter"><i className={`gm-fill-${statusOf(memPct)}`} style={{ width: `${Math.min(100, memPct)}%` }} /></div>
                <div className="gm-metric-sub">{bytes(server.mem_used)} / {bytes(server.mem_total)}</div>
              </div>
            )}
            {diskPct !== undefined && (
              <div className="gm-metric">
                <div className="gm-metric-head">
                  <span className="gm-metric-label"><HardDrive size={13} className="gm-ic-disk" />硬盘</span>
                  <span className="tabular gm-metric-value">{diskPct.toFixed(1)}%</span>
                </div>
                <div className="gm-meter"><i className={`gm-fill-${statusOf(diskPct)}`} style={{ width: `${Math.min(100, diskPct)}%` }} /></div>
                <div className="gm-metric-sub">{bytes(server.disk_used)} / {bytes(server.disk_total)}</div>
              </div>
            )}
            {server.traffic_used !== undefined && (
              <button
                type="button"
                className="gm-metric gm-metric-button"
                title="查看日流量趋势"
                onClick={(event) => {
                  event.stopPropagation()
                  setTrafficOpen(true)
                }}
              >
                <div className="gm-metric-head">
                  <span className="gm-metric-label"><PieChart size={13} className="gm-ic-traffic" />流量</span>
                  <span className={`tabular gm-metric-value${trafficPct !== undefined && trafficPct >= 70 ? ` gm-text-${statusOf(trafficPct)}` : ''}`}>
                    {server.traffic_limit ? `${trafficPct!.toFixed(1)}%` : '∞'}
                  </span>
                </div>
                <div className="gm-meter"><i className={`gm-fill-${trafficPct !== undefined ? statusOf(trafficPct) : 'ok'}`} style={{ width: `${Math.min(100, trafficPct ?? (server.traffic_limit ? 0 : 100))}%` }} /></div>
                <div className="gm-metric-sub">
                  {bytes(server.traffic_used, false)}
                  {server.traffic_limit ? ` / ${bytes(server.traffic_limit, false)}` : ' / ∞'}
                </div>
              </button>
            )}
          </div>
          {/* 速率/周期流量/到期 3 列块 */}
          <div className="gm-quick-row">
            <div className="gm-quick-cell">
              <div className="gm-quick-line gm-q-up">
                <ArrowUp size={11} />
                <span>{bitSpeed(server.upload_speed)}</span>
              </div>
              <div className="gm-quick-line gm-q-down">
                <ArrowDown size={11} />
                <span>{bitSpeed(server.download_speed)}</span>
              </div>
            </div>
            <div className="gm-quick-cell">
              <div className="gm-quick-line gm-q-cycle-up">
                <ArrowUp size={11} />
                <span>{cycleUp !== undefined ? bytes(cycleUp) : '—'}</span>
              </div>
              <div className="gm-quick-line gm-q-cycle-down">
                <ArrowDown size={11} />
                <span>{cycleDown !== undefined ? bytes(cycleDown) : '—'}</span>
              </div>
            </div>
            <div className="gm-quick-cell">
              <div className="gm-quick-line gm-q-days">
                <CalendarClock size={11} />
                <span>{daysText ?? '—'}</span>
              </div>
              <div className="gm-quick-line gm-q-value">
                <Wallet size={11} />
                <span>{remainValueText ?? '—'}</span>
              </div>
            </div>
          </div>
          {/* 延迟/丢包脉冲块 */}
          {(latencyBars.length > 0 || lossBars.length > 0) && (
            <div className="gm-ping-row">
              {latencyBars.length > 0 && (
                <button type="button" className="gm-ping-cell" title={`平均延迟 ${avgMs >= 0 ? avgMs.toFixed(0) : '超时'} ms · 点击看趋势`} aria-label={`${name} 延迟监测`} onClick={(event) => { event.stopPropagation(); setTrendMode('latency') }}>
                  <div className="gm-ping-head">
                    <span>延迟</span>
                    <span className="gm-ping-value">{avgMs < 0 ? '超时' : `${avgMs.toFixed(0)} ms`}</span>
                  </div>
                  <div className="gm-ping-bars">
                    {latencyBars.map((level, i) => (
                      <span key={i} className={`gm-ping-bar gm-sig-${level}`} title={latencyTitles[i]} />
                    ))}
                  </div>
                </button>
              )}
              {lossBars.length > 0 && (
                <button type="button" className="gm-ping-cell" title={`平均丢包 ${avgLoss.toFixed(1)}% · 点击看趋势`} aria-label={`${name} 丢包监测`} onClick={(event) => { event.stopPropagation(); setTrendMode('loss') }}>
                  <div className="gm-ping-head">
                    <span>丢包</span>
                    <span className="gm-ping-value">{avgLoss.toFixed(1)}%</span>
                  </div>
                  <div className="gm-ping-bars">
                    {lossBars.map((level, i) => (
                      <span key={i} className={`gm-ping-bar gm-sig-${level}`} title={lossTitles[i]} />
                    ))}
                  </div>
                </button>
              )}
            </div>
          )}
          {/* 三网回程文字标签 */}
          {trendMode && (
            <TrendDialog
              serverIndex={index}
              initial={server.ping || []}
              targetKey="__avg__"
              title={name}
              mode={trendMode}
              close={() => setTrendMode(null)}
            />
          )}
          {routeLines.length > 0 ? (
            <div className="gm-tags">
              {routeLines.map((line) => (
                <span key={line.carrier} className="gm-tag" title={`${line.carrier}回程: ${line.type}`}>
                  {line.carrier} {line.type}
                </span>
              ))}
            </div>
          ) : (
            (server.return_routes?.length ?? 0) > 0 && (
              <div className="gm-tags">
                <span className="gm-tag">回程未知</span>
              </div>
            )
          )}
        </div>
      </article>
      {trafficOpen && <TrafficDialog server={server} close={() => setTrafficOpen(false)} />}
    </>
  )
}

/* ================= 总览卡片（照搬 Komari NodeGeneralCards） ================= */
interface GmGeneralCard {
  key: string
  label: string
  icon: React.ReactNode
  value: string
  unit?: string
  tooltip?: string
}

function GmGeneralCards({ servers }: { servers: ProbeServer[] }) {
  const cards = useMemo<GmGeneralCard[]>(() => {
    const memUsed = servers.reduce((acc, s) => acc + (s.mem_used || 0), 0)
    const memTotal = servers.reduce((acc, s) => acc + (s.mem_total || 0), 0)
    const diskUsed = servers.reduce((acc, s) => acc + (s.disk_used || 0), 0)
    const diskTotal = servers.reduce((acc, s) => acc + (s.disk_total || 0), 0)
    const trafficUsed = servers.reduce((acc, s) => acc + (s.traffic_used || 0), 0)
    const up = servers.reduce((acc, s) => acc + (s.upload_speed || 0), 0)
    const down = servers.reduce((acc, s) => acc + (s.download_speed || 0), 0)
    let totalValue = 0
    let totalPrice = 0
    for (const server of servers) {
      const rv = computeRemainingValue(server)
      if (rv) totalValue += rv.value
      if (server.renewal_price !== undefined) totalPrice += server.renewal_price_cny ?? server.renewal_price
    }
    const mem = splitBytesText(memUsed)
    const disk = splitBytesText(diskUsed)
    const traffic = splitBytesText(trafficUsed)
    const upSpeed = splitSpeedText(up)
    const downSpeed = splitSpeedText(down)
    const valueText = totalValue > 0 ? formatMoney(totalValue, 'CNY', true).replace(/¥/, '') : '—'
    const result: GmGeneralCard[] = [
      {
        key: 'memory',
        label: '内存用量',
        icon: <MemoryStick size={20} />,
        value: mem.value,
        unit: `${mem.unit} / ${bytes(memTotal)}`,
        tooltip: `已用 ${bytes(memUsed)}\n总量 ${bytes(memTotal)}`,
      },
      {
        key: 'disk',
        label: '硬盘用量',
        icon: <HardDrive size={20} />,
        value: disk.value,
        unit: `${disk.unit} / ${bytes(diskTotal)}`,
        tooltip: `已用 ${bytes(diskUsed)}\n总量 ${bytes(diskTotal)}`,
      },
      {
        key: 'remainingValue',
        label: '剩余价值',
        icon: <Wallet size={20} />,
        value: valueText,
        unit: totalValue > 0 ? 'CNY' : undefined,
        tooltip: totalValue > 0 ? `总价值 ${formatMoney(totalPrice, 'CNY', true)}` : '暂无价格数据',
      },
      {
        key: 'totalTraffic',
        label: '累计流量',
        icon: <Database size={20} />,
        value: traffic.value,
        unit: traffic.unit,
        tooltip: `↑ ${bytes(servers.reduce((acc, s) => acc + (s.cumulative_up || 0), 0))}\n↓ ${bytes(servers.reduce((acc, s) => acc + (s.cumulative_down || 0), 0))}`,
      },
      {
        key: 'uploadSpeed',
        label: '实时上行',
        icon: <ArrowUp size={20} />,
        value: upSpeed.value,
        unit: upSpeed.unit,
        tooltip: `所有在线节点实时上行合计 ${bitSpeed(up)}`,
      },
      {
        key: 'downloadSpeed',
        label: '实时下行',
        icon: <ArrowDown size={20} />,
        value: downSpeed.value,
        unit: downSpeed.unit,
        tooltip: `所有在线节点实时下行合计 ${bitSpeed(down)}`,
      },
    ]
    return result
  }, [servers])

  const regions = useMemo(() => buildRegions(servers), [servers])

  return (
    <section className="gm-general">
      <div className="gm-general-cards">
        {cards.map((card) => (
          <article className="gm-general-card" key={card.key} title={card.tooltip}>
            <div className="gm-general-card-top">
              <span className="gm-general-card-label">{card.label}</span>
              <span className="gm-general-card-icon">{card.icon}</span>
            </div>
            <div className="gm-general-card-value">
              <span className="gm-general-card-number">{card.value}</span>
              {card.unit && <span className="gm-general-card-unit">{card.unit}</span>}
            </div>
          </article>
        ))}
      </div>
      <div className="gm-earth-wrap">
        <GmEarth regions={regions} />
      </div>
    </section>
  )
}

/* ================= 访客条（照搬 Komari VisitorInfo 底部浮条） ================= */
function GmVisitorBar() {
  const [closed, setClosed] = useState(false)
  const { data } = useVisitorInfo(true)
  if (closed || !data) return null
  const country = data.country || '未知地区'
  return (
    <div className="gm-visitor">
      <Globe2 size={14} />
      <span className="gm-visitor-ip-label">Your IP:</span>
      <span className="gm-visitor-ip">{data.ip}</span>
      <span className="gm-visitor-sep">|</span>
      <span className="gm-visitor-country">{country}</span>
      {data.isp && (
        <>
          <span className="gm-visitor-sep">|</span>
          <span className="gm-visitor-isp">{data.isp}</span>
        </>
      )}
      <button type="button" className="gm-visitor-close" aria-label="关闭" title="关闭" onClick={() => setClosed(true)}>
        <X size={12} />
      </button>
    </div>
  )
}

/* ================= 主题菜单 ================= */
function GmThemeMenu({ current, onChange }: { current: ThemeName | null; onChange: (name: ThemeName | null) => void }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const handle = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.gm-theme-menu')) setOpen(false)
    }
    document.addEventListener('click', handle)
    return () => document.removeEventListener('click', handle)
  }, [open])
  const label = current ? THEME_OPTIONS.find((opt) => opt.value === current)?.label || current : '跟随主控'
  return (
    <div className="gm-theme-menu">
      <button type="button" className="gm-header-btn" title={`主题: ${label}`} onClick={() => setOpen((v) => !v)}>
        <Palette size={18} />
        <ChevronDown size={14} className={open ? 'rotated' : ''} />
      </button>
      {open && (
        <div className="gm-theme-dropdown">
          <button type="button" onClick={() => { onChange(null); setOpen(false) }}>
            <span>跟随主控</span>
            {current === null && <Check size={14} />}
          </button>
          {THEME_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setOpen(false) }}>
              <span>{opt.label}</span>
              {current === opt.value && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ================= 主页面 ================= */
export default function GmApp({
  data,
  onThemeChange,
}: {
  data: ProbePayload
  onThemeChange: (name: ThemeName | null) => void
}) {
  const servers = useMemo(() => (data.servers || []) as EnrichedServer[], [data.servers])
  const title = data.title?.trim() || '服务器状态'
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'card' | 'list'>(() => (localStorage.getItem('probe-view') === 'list' ? 'list' : 'card'))
  const [detailIndex, setDetailIndex] = useState<number | null>(null)
  const [colorMode, setColorMode] = useState<'light' | 'dark'>(() => {
    // 优先级: 用户手动切过 > 主控下发(glassmorphism light/dark) > 默认夜间
    const user = localStorage.getItem('gm-color-mode')
    const master = localStorage.getItem('gm-color-mode-master')
    return (user ?? master) === 'light' ? 'light' : 'dark'
  })
  const [themeOverride, setThemeOverride] = useState<ThemeName | null>(() => {
    const v = localStorage.getItem('mmwx-probe-theme-override')
    return THEME_OPTIONS.some((opt) => opt.value === v) ? (v as ThemeName) : null
  })

  const toggleColorMode = () => {
    setColorMode((mode) => {
      const next = mode === 'dark' ? 'light' : 'dark'
      localStorage.setItem('gm-color-mode', next)
      return next
    })
  }

  useEffect(() => {
    const applyHash = () => {
      const match = /^#\/server\/(\d+)$/.exec(location.hash)
      setDetailIndex(match ? Number(match[1]) : null)
    }
    applyHash()
    window.addEventListener('hashchange', applyHash)
    return () => window.removeEventListener('hashchange', applyHash)
  }, [])

  // 详情页/弹窗是 portal 到 body 下, 需要在 body 上挂主题类供 CSS 变量覆盖
  useEffect(() => {
    document.body.classList.add('gm-body')
    document.body.classList.toggle('gm-light-body', colorMode === 'light')
    return () => {
      document.body.classList.remove('gm-body', 'gm-light-body')
    }
  }, [colorMode])

  const query = search.trim().toLowerCase()
  const visible = servers.filter((server) => {
    if (!query) return true
    const haystack = [server.name, server.region, server.region_name, server.region_city, server.region_country, server.provider_name].filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(query)
  })

  const setViewMode = (mode: 'card' | 'list') => {
    setView(mode)
    localStorage.setItem('probe-view', mode)
  }

  const handleThemeChange = (name: ThemeName | null) => {
    setThemeOverride(name)
    onThemeChange(name)
  }

  return (
    <div className={`gm-app gm-${colorMode}`}>
      <div className="gm-bg" aria-hidden="true" />
      <header className="gm-header">
        <a className="gm-brand" href="#/" onClick={() => setDetailIndex(null)}>
          {data.logo ? <img src={data.logo} alt="" className="gm-brand-logo" /> : <Activity size={18} className="gm-brand-icon" />}
          <span>{title}</span>
        </a>
        <div className="gm-header-actions">
          <button
            type="button"
            className="gm-header-btn"
            title={colorMode === 'dark' ? '切换到白天模式' : '切换到夜间模式'}
            aria-label={colorMode === 'dark' ? '切换到白天模式' : '切换到夜间模式'}
            onClick={toggleColorMode}
          >
            {colorMode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <GmThemeMenu current={themeOverride} onChange={handleThemeChange} />
        </div>
      </header>

      <main className="gm-main">
        <GmGeneralCards servers={servers} />

        <div className="gm-controls">
          <div className={`gm-search${search ? ' has-text' : ''}`}>
            <Search size={14} className="gm-search-icon" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Escape') setSearch('') }}
              placeholder="搜索名称、地区、IP、CPU"
              aria-label="搜索节点"
            />
            {search && (
              <button type="button" className="gm-search-clear" aria-label="清空搜索" onClick={() => setSearch('')}>
                <X size={14} />
              </button>
            )}
          </div>
          <div className="gm-view-switch">
            <button
              type="button"
              className={view === 'card' ? 'active' : ''}
              aria-label="卡片视图"
              aria-pressed={view === 'card'}
              title="卡片视图"
              onClick={() => setViewMode('card')}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              className={view === 'list' ? 'active' : ''}
              aria-label="列表视图"
              aria-pressed={view === 'list'}
              title="列表视图"
              onClick={() => setViewMode('list')}
            >
              <Table2 size={14} />
            </button>
          </div>
        </div>

        {visible.length ? (
          view === 'card' ? (
            <div className="gm-node-grid">
              {visible.map((server) => (
                <GmNodeCard key={server.name} server={server} index={servers.indexOf(server)} />
              ))}
            </div>
          ) : (
            <div className="gm-table-wrap">
              <table className="gm-table">
                <thead>
                  <tr>
                    <th>节点</th>
                    <th>状态</th>
                    <th>CPU</th>
                    <th>内存</th>
                    <th>硬盘</th>
                    <th>流量</th>
                    <th>速度 ↓ / ↑</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((server) => {
                    const index = servers.indexOf(server)
                    return (
                      <tr key={server.name} onClick={() => { location.hash = `#/server/${index}` }}>
                        <td>
                          <span className={`status ${server.online ? 'online' : ''}`} />
                          <Twemoji>{server.name || `服务器 ${index + 1}`}</Twemoji>
                        </td>
                        <td>{server.online ? '在线' : '离线'}</td>
                        <td className="tabular">{server.cpu_pct !== undefined ? `${server.cpu_pct.toFixed(1)}%` : '—'}</td>
                        <td className="tabular">{server.mem_total ? `${pct(server.mem_used, server.mem_total).toFixed(1)}%` : '—'}</td>
                        <td className="tabular">{server.disk_total ? `${pct(server.disk_used, server.disk_total).toFixed(1)}%` : '—'}</td>
                        <td className="tabular">{server.traffic_used !== undefined ? bytes(server.traffic_used, false) : '—'}</td>
                        <td className="tabular">
                          <span className="gm-table-speed-down">{bitSpeed(server.download_speed)}</span>
                          {' / '}
                          <span className="gm-table-speed-up">{bitSpeed(server.upload_speed)}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="gm-empty">暂无符合条件的服务器</div>
        )}
      </main>

      <footer className="gm-footer">
        <div>
          Powered by{' '}
          <a href="https://github.com/mmwx-group" target="_blank" rel="noreferrer">
            <strong>妙妙屋</strong>
          </a>
        </div>
        <div>
          Theme by <strong>Glassmorphism</strong>
        </div>
      </footer>

      <GmVisitorBar />

      {detailIndex !== null && servers[detailIndex] && (
        <ServerDetail
          server={servers[detailIndex]}
          index={detailIndex}
          onClose={() => { location.hash = ''; setDetailIndex(null) }}
          showHealthScore={data.show_health_score === true}
        />
      )}
    </div>
  )
}
