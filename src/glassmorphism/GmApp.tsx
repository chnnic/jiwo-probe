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
  Palette,
  PieChart,
  Search,
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

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return h > 0 ? `${d}天${h}小时` : `${d}天`
  if (h > 0) return m > 0 ? `${h}小时${m}分` : `${h}小时`
  return `${Math.max(1, m)}分`
}

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

function splitSpeedText(value: number): { value: string; unit: string } {
  const v = speed(value)
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
  const name = server.name || `服务器 ${index + 1}`
  const flag = regionFlag(server.region)
  const isOffline = !server.online
  const cpuPct = server.cpu_pct
  const memPct = server.mem_total ? pct(server.mem_used, server.mem_total) : undefined
  const diskPct = server.disk_total ? pct(server.disk_used, server.disk_total) : undefined
  const trafficPct = server.traffic_limit ? pct(server.traffic_used, server.traffic_limit) : undefined
  const trafficLevel = trafficPct === undefined ? '' : trafficPct >= 95 ? ' danger' : trafficPct >= 70 ? ' warn' : ''
  const uptimeText = server.uptime !== undefined ? formatUptime(server.uptime) : null
  const daysText = server.expires_at ? remainingDays(server.expires_at) : null
  const renewText =
    server.renewal_price !== undefined
      ? server.renewal_price_cny !== undefined
        ? `¥${server.renewal_price_cny.toFixed(2)}`
        : `${server.renewal_currency || 'CNY'} ${server.renewal_price}`
      : null
  const loadParts = (server.loadavg || '').split(/\s+/).map(Number).filter((v) => Number.isFinite(v))

  return (
    <>
      <article
        className={`gm-node-card${isOffline ? ' is-offline' : ''}`}
        onClick={() => { location.hash = `#/server/${index}` }}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); location.hash = `#/server/${index}` } }}
        title="点击查看详情"
      >
        <header className="gm-node-header">
          <div className="gm-node-title-wrap">
            <span className="gm-status-wrap">
              <span className={server.online ? 'status online' : 'status'} />
              {server.online && <span className="gm-status-ping" />}
            </span>
            <h2 className="gm-node-title">
              <Twemoji>{flag && !hasLeadingFlag(name) ? `${flag} ${name}` : name}</Twemoji>
            </h2>
            <span className="gm-node-system" title={systemTitle(server)} onClick={(event) => event.stopPropagation()}>
              <SystemIcon server={server} />
            </span>
          </div>
          {(uptimeText || daysText || renewText) && (
            <div className="gm-node-chips" onClick={(event) => event.stopPropagation()}>
              {uptimeText && (
                <span className="gm-chip" title="在线时长">
                  <Clock3 size={11} />
                  {uptimeText}
                </span>
              )}
              {daysText && (
                <span className={`gm-chip${expiring(server) || expired(server) ? ' warn' : ''}`} title="到期时间">
                  <CalendarClock size={11} />
                  {daysText}
                </span>
              )}
              {renewText && (
                <span className="gm-chip" title="续费价格">
                  <Wallet size={11} />
                  {renewText}
                </span>
              )}
            </div>
          )}
        </header>
        <div className="gm-node-metrics">
          {cpuPct !== undefined && (
            <div className="gm-metric" title={loadParts.length ? `负载 ${loadParts.join(' / ')}` : 'CPU 使用率'}>
              <div className="gm-metric-head">
                <span className="gm-metric-label"><Cpu size={13} className="gm-ic-cpu" />CPU</span>
                <span className="tabular gm-metric-value">{cpuPct.toFixed(1)}%</span>
              </div>
              <div className="gm-meter"><i className="gm-m-cpu" style={{ width: `${Math.min(100, cpuPct)}%` }} /></div>
              <div className="gm-metric-sub">{loadParts.length ? `${loadParts[0] ?? 0} / ${loadParts[1] ?? 0} / ${loadParts[2] ?? 0}` : '负载暂无'}</div>
            </div>
          )}
          {memPct !== undefined && (
            <div className="gm-metric" title="内存使用率">
              <div className="gm-metric-head">
                <span className="gm-metric-label"><MemoryStick size={13} className="gm-ic-mem" />内存</span>
                <span className="tabular gm-metric-value">{memPct.toFixed(1)}%</span>
              </div>
              <div className="gm-meter"><i className="gm-m-mem" style={{ width: `${Math.min(100, memPct)}%` }} /></div>
              <div className="gm-metric-sub">{bytes(server.mem_used)} / {bytes(server.mem_total)}</div>
            </div>
          )}
          {diskPct !== undefined && (
            <div className="gm-metric" title="硬盘使用率">
              <div className="gm-metric-head">
                <span className="gm-metric-label"><HardDrive size={13} className="gm-ic-disk" />硬盘</span>
                <span className="tabular gm-metric-value">{diskPct.toFixed(1)}%</span>
              </div>
              <div className="gm-meter"><i className="gm-m-disk" style={{ width: `${Math.min(100, diskPct)}%` }} /></div>
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
                <span className={`tabular gm-metric-value${trafficLevel}`}>
                  {server.traffic_limit ? `${trafficPct!.toFixed(1)}%` : '∞'}
                </span>
              </div>
              <div className="gm-meter"><i className={`gm-m-traffic${trafficLevel}`} style={{ width: `${Math.min(100, trafficPct ?? (server.traffic_limit ? 0 : 100))}%` }} /></div>
              <div className={`gm-metric-sub${trafficLevel}`}>
                {bytes(server.traffic_used, false)}
                {server.traffic_limit ? ` / ${bytes(server.traffic_limit, false)}` : ' / ∞'}
              </div>
            </button>
          )}
        </div>
        {(server.upload_speed !== undefined || server.download_speed !== undefined) && (
          <div className="gm-node-speed">
            <span title={`下行 ${speed(server.download_speed)}`}>
              <ArrowDown size={15} />
              <span className="tabular">{speed(server.download_speed)}</span>
            </span>
            <span title={`上行 ${speed(server.upload_speed)}`}>
              <ArrowUp size={15} />
              <span className="tabular">{speed(server.upload_speed)}</span>
            </span>
          </div>
        )}
        {!!server.ping?.length && <PingPanel ping={server.ping} serverIndex={index} />}
        {!!server.return_routes?.length && <ReturnRouteBadges routes={server.return_routes} telecomPaidPeer={server.telecom_paid_peer} />}
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
    for (const server of servers) {
      const rv = computeRemainingValue(server)
      if (rv) totalValue += rv.value
    }
    const mem = splitBytesText(memUsed)
    const disk = splitBytesText(diskUsed)
    const traffic = splitBytesText(trafficUsed)
    const upSpeed = splitSpeedText(up)
    const downSpeed = splitSpeedText(down)
    const result: GmGeneralCard[] = [
      {
        key: 'memory',
        label: '内存',
        icon: <MemoryStick size={20} />,
        value: mem.value,
        unit: mem.unit,
        tooltip: `总内存 ${bytes(memTotal)}\n已用 ${bytes(memUsed)}`,
      },
      {
        key: 'disk',
        label: '硬盘',
        icon: <HardDrive size={20} />,
        value: disk.value,
        unit: disk.unit,
        tooltip: `总硬盘 ${bytes(diskTotal)}\n已用 ${bytes(diskUsed)}`,
      },
      {
        key: 'remainingValue',
        label: '剩余价值',
        icon: <Wallet size={20} />,
        value: totalValue > 0 ? formatMoney(totalValue, 'CNY', true).replace(/¥/, '') : '—',
        unit: totalValue > 0 ? 'CNY' : undefined,
        tooltip: totalValue > 0 ? `剩余价值合计 ${formatMoney(totalValue, 'CNY', true)}` : '暂无价格数据',
      },
      {
        key: 'totalTraffic',
        label: '累计流量',
        icon: <Database size={20} />,
        value: traffic.value,
        unit: traffic.unit,
        tooltip: `所有节点累计已用流量 ${bytes(trafficUsed)}`,
      },
      {
        key: 'uploadSpeed',
        label: '实时上行',
        icon: <ArrowUp size={20} />,
        value: upSpeed.value,
        unit: upSpeed.unit,
        tooltip: `所有在线节点实时上行合计 ${speed(up)}`,
      },
      {
        key: 'downloadSpeed',
        label: '实时下行',
        icon: <ArrowDown size={20} />,
        value: downSpeed.value,
        unit: downSpeed.unit,
        tooltip: `所有在线节点实时下行合计 ${speed(down)}`,
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
  const { data } = useVisitorInfo(true)
  if (!data) return null
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
        <Palette size={15} />
        <ChevronDown size={12} className={open ? 'rotated' : ''} />
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
  const [themeOverride, setThemeOverride] = useState<ThemeName | null>(() => {
    const v = localStorage.getItem('mmwx-probe-theme-override')
    return THEME_OPTIONS.some((opt) => opt.value === v) ? (v as ThemeName) : null
  })

  useEffect(() => {
    const applyHash = () => {
      const match = /^#\/server\/(\d+)$/.exec(location.hash)
      setDetailIndex(match ? Number(match[1]) : null)
    }
    applyHash()
    window.addEventListener('hashchange', applyHash)
    return () => window.removeEventListener('hashchange', applyHash)
  }, [])

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
    <div className="gm-app">
      <div className="gm-bg" aria-hidden="true" />
      <header className="gm-header">
        <a className="gm-brand" href="#/" onClick={() => setDetailIndex(null)}>
          {data.logo ? <img src={data.logo} alt="" className="gm-brand-logo" /> : <Activity size={18} className="gm-brand-icon" />}
          <span>{title}</span>
        </a>
        <div className="gm-header-actions">
          <GmThemeMenu current={themeOverride} onChange={handleThemeChange} />
          <a className="gm-header-btn" href="/login" title="后台管理" rel="noreferrer">
            <Table2 size={15} />
          </a>
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
                          <span className="gm-table-speed-down">{speed(server.download_speed)}</span>
                          {' / '}
                          <span className="gm-table-speed-up">{speed(server.upload_speed)}</span>
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
