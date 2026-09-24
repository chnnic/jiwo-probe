import { useMemo, useState } from 'react'
import { Activity, ArrowDown, ArrowUp, CalendarClock, Cpu, HardDrive, LayoutGrid, List, MemoryStick, Moon, Network, PieChart, Rows3, Search, Server, Sun, Wallet } from 'lucide-react'
import type { ProbePayload, ProbeServer, ThemeName } from '../types'
import { bytes, hasLeadingFlag, regionFlag, ReturnRouteBadges, SystemIcon, ThemeSelect } from '../App'
import { getThemeOverride, setDarkOverride } from '../use-probe'
import { useNetworkSpeed } from '../use-network-speed'
import { ConnectionCounts, UnlockButton } from '../ServerCapabilities'
import { CardPingGroups } from '../CardPingGroups'
import { PasskeyLogin } from '../PasskeyLogin'
import { Twemoji } from '../Twemoji'
import { expiryTime, isExpiring, miniSummary, providerName, ratio, selectServers, validNumber, type MiniSort, type MiniStatus, type MiniView } from './mini-model'
import './mini.css'

const viewLabels: Record<MiniView, string> = { compact: '卡片', detailed: '详细', list: '列表' }
const views = { compact: LayoutGrid, detailed: Rows3, list: List }
const sortLabels: Record<MiniSort, string> = { default: '默认排序', name: '名称 A–Z', cpu: 'CPU 占用 ↓', memory: '内存占用 ↓', traffic: '已用流量 ↓', latency: '延迟最低', expiry: '到期最近' }

function size(value?: number) { return validNumber(value) === undefined ? '—' : bytes(value) }
function uptime(value?: number) {
  if (validNumber(value) === undefined) return '运行时间未上报'
  return value! >= 86400 ? `已运行 ${Math.floor(value! / 86400)} 天` : `已运行 ${Math.floor(value! / 3600)} 小时`
}
function remainingDays(server: ProbeServer) {
  const time = expiryTime(server)
  return time === undefined ? undefined : Math.ceil((time - Date.now()) / 86400000)
}
function expiry(server: ProbeServer) {
  const days = remainingDays(server)
  if (days === undefined) return '未设置到期日'
  return days < 0 ? `已过期 ${Math.abs(days)} 天` : days === 0 ? '今天到期' : `剩余 ${days} 天`
}
function price(server: ProbeServer) {
  if (validNumber(server.renewal_price) === undefined) return undefined
  const currency = server.renewal_currency || 'CNY'
  const cycle = { month: '月', quarter: '季', half_year: '半年', year: '年' }[server.renewal_cycle || 'month']
  return { amount: server.renewal_price!.toLocaleString('zh-CN', { maximumFractionDigits: 2 }), unit: `${currency} / ${cycle}` }
}

function Resources({ server, detailed }: { server: ProbeServer; detailed: boolean }) {
  const metrics = [
    { name: 'CPU', Icon: Cpu, value: validNumber(server.cpu_pct), note: server.loadavg || '负载未上报' },
    { name: '内存', Icon: MemoryStick, value: ratio(server.mem_used, server.mem_total), note: `${size(server.mem_used)} / ${size(server.mem_total)}` },
    { name: '硬盘', Icon: HardDrive, value: ratio(server.disk_used, server.disk_total), note: `${size(server.disk_used)} / ${size(server.disk_total)}` },
    { name: '流量', Icon: PieChart, value: ratio(server.traffic_used, server.traffic_limit), note: `${size(server.traffic_used)} / ${server.traffic_limit === 0 ? '无限' : size(server.traffic_limit)}` },
  ]
  return <div className="mini-resource-grid">
    {metrics.map(({ name, Icon, value, note }) => <div className="mini-resource" key={name}>
      <div className="mini-resource-heading"><span>{detailed && <Icon size={13} />}{name}</span><strong>{value === undefined ? '—' : `${value.toFixed(1)}%`}</strong></div>
      <div className={`mini-meter ${value !== undefined && value >= 90 ? 'is-high' : value !== undefined && value >= 70 ? 'is-warm' : ''}`} title={`${name} ${value === undefined ? '未上报 / 无额度' : `${value.toFixed(1)}%`}`}>
        <span style={{ width: `${Math.min(100, value || 0)}%` }} />
      </div>
      {detailed && <small title={note}>{note}</small>}
    </div>)}
  </div>
}

function NodeCard({ server, index, view }: { server: ProbeServer; index: number; view: MiniView }) {
  const formatSpeed = useNetworkSpeed()
  const name = server.name || `服务器 ${index + 1}`
  const flag = !hasLeadingFlag(name) ? regionFlag(server.region || server.region_country) : ''
  const detailed = view === 'detailed'
  const days = remainingDays(server)
  const expiresAt = expiryTime(server)
  const renewal = price(server)
  const speed = (value?: number) => validNumber(value) === undefined ? '—' : formatSpeed(value!)
  return <article className={`mini-node-card${server.online ? '' : ' is-offline'}`} aria-label={name}>
    <div className="mini-node-identity">
      <div className="mini-node-heading">
        <a className="mini-node-link" href={`#/server/${index}`} title={`${name} · 查看详情`}>
          <i className={`mini-status-dot${server.online ? '' : ' is-offline'}`} aria-label={server.online ? '在线' : '离线'} />
          {flag && <Twemoji className="mini-flag">{flag}</Twemoji>}
          <h3>{name}</h3>
        </a>
        <div className="mini-node-actions"><UnlockButton server={server} /><span className="mini-system" title={server.os || '系统未上报'}><SystemIcon server={server} /><span>{server.os?.split(' ')[0] || '未知'}</span></span></div>
      </div>
      <div className="mini-node-meta"><span>{server.online ? uptime(server.uptime) : '离线'}</span><span title={providerName(server)}>{providerName(server)}</span>{isExpiring(server) && <span className="mini-expiring">{expiry(server)}</span>}</div>
    </div>
    <Resources server={server} detailed={detailed} />
    <div className="mini-node-network">
      <div className="mini-speed-row">
        <span className="mini-upload" title="实时上行"><ArrowUp size={14} /><strong>{speed(server.upload_speed)}</strong></span>
        <span className="mini-download" title="实时下行"><ArrowDown size={14} /><strong>{speed(server.download_speed)}</strong></span>
      </div>
      <ConnectionCounts server={server} variant="card" />
    </div>
    {detailed && <div className="mini-extra" aria-label="周期流量、剩余天数与续费价格">
      <div className="mini-extra-item mini-extra-traffic">
        <span className="mini-extra-label">周期流量</span>
        <div className="mini-extra-content">
          <span className="mini-extra-value" title="周期上行流量"><ArrowUp size={12} aria-hidden="true" /><span className="sr-only">上行</span><strong>{size(server.traffic_used_up)}</strong></span>
          <span className="mini-extra-value" title="周期下行流量"><ArrowDown size={12} aria-hidden="true" /><span className="sr-only">下行</span><strong>{size(server.traffic_used_down)}</strong></span>
        </div>
      </div>
      <div className={`mini-extra-item mini-extra-expiry${isExpiring(server) ? ' is-expiring' : ''}`}>
        <span className="mini-extra-label"><CalendarClock size={12} aria-hidden="true" />{days !== undefined && days < 0 ? '已过期' : '剩余天数'}</span>
        <div className="mini-extra-content"><strong className="mini-extra-primary">{days === undefined ? '—' : days === 0 ? '今天到期' : `${Math.abs(days)} 天`}</strong><small>{expiresAt === undefined ? '未设置到期日' : new Date(expiresAt).toLocaleDateString('zh-CN')}</small></div>
      </div>
      <div className="mini-extra-item mini-extra-price">
        <span className="mini-extra-label"><Wallet size={12} aria-hidden="true" />续费价格</span>
        <div className="mini-extra-content"><strong className="mini-extra-primary">{renewal?.amount ?? '—'}</strong><small>{renewal?.unit ?? '未设置价格'}</small></div>
      </div>
    </div>}
    {view !== 'list' && <>
      {detailed && !!server.return_routes?.length && <div className="mini-route-strip"><ReturnRouteBadges routes={server.return_routes} telecomPaidPeer={server.telecom_paid_peer} variant="lumina" /></div>}
      <CardPingGroups ping={server.ping} serverIndex={index} serverName={server.name} variant="classic" averageOnly={!detailed} />
    </>}
    {view === 'list' && <a className="mini-details-link" href={`#/server/${index}`} aria-label={`查看 ${name} 详情`}>详情 →</a>}
  </article>
}

export default function MiniApp({ data, error, onThemeChange }: { data: ProbePayload; error?: string; onThemeChange: (name: ThemeName | null) => void }) {
  const servers = data.servers || []
  const formatSpeed = useNetworkSpeed()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<MiniStatus>('all')
  const [provider, setProvider] = useState('')
  const [sort, setSort] = useState<MiniSort>('default')
  const [view, setView] = useState<MiniView>(() => {
    try { const saved = localStorage.getItem('jiwo-mini-view'); return saved === 'detailed' || saved === 'list' ? saved : 'compact' } catch { return 'compact' }
  })
  const [, setColorRevision] = useState(0)
  const dark = document.documentElement.classList.contains('dark') || document.documentElement.classList.contains('gold')
  const providers = useMemo(() => [...new Set(servers.map(providerName))].sort((a, b) => a.localeCompare(b, 'zh-CN')), [servers])
  const visible = useMemo(() => selectServers(servers, { query, status, provider, sort }), [servers, query, status, provider, sort])
  const summary = useMemo(() => miniSummary(servers), [servers])
  const statusOptions: { value: MiniStatus; label: string; count: number }[] = [
    { value: 'all', label: '全部', count: servers.length }, { value: 'online', label: '在线', count: summary.online },
    { value: 'offline', label: '离线', count: servers.length - summary.online }, { value: 'expiring', label: '临期', count: servers.filter(server => isExpiring(server)).length },
  ]
  const changeView = (next: MiniView) => { setView(next); try { localStorage.setItem('jiwo-mini-view', next) } catch { /* 会话内仍可切换。 */ } }
  const speed = (value?: number) => value === undefined ? '—' : formatSpeed(value)
  return <div className="mini-app">
    <header className="mini-header"><div className="mini-header-inner">
      <a className="mini-brand" href="#" aria-label="返回首页"><span className="mini-brand-icon">{data.logo ? <img src={data.logo} alt="" /> : <Network size={23} />}</span><span><h1>{data.title?.trim() || '服务器状态'}</h1><small>集群实时探针 <b>LITE</b></small></span></a>
      <nav aria-label="外观与登录"><PasskeyLogin buttonClassName="mini-icon-button" /><ThemeSelect value={getThemeOverride()} onChange={onThemeChange} /><button className="mini-icon-button" type="button" aria-label={dark ? '切换浅色模式' : '切换深色模式'} onClick={() => { setDarkOverride(dark ? 'light' : 'dark'); setColorRevision(value => value + 1) }}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button></nav>
    </div></header>
    <main className="mini-main">
      <section className="mini-summary" aria-label="集群概览">
        <div className="mini-summary-tile"><span><Server size={15} />服务器在线</span><strong><i className="mini-status-dot" />{summary.online}<small>/ {servers.length}</small></strong><p>{servers.length - summary.online} 台离线 · {servers.length} 台节点</p></div>
        <div className="mini-summary-tile"><span><Activity size={15} />已用流量</span><strong>{size(summary.traffic)}</strong><p>平均延迟 {summary.latency === undefined ? '—' : `${summary.latency.toFixed(0)} ms`}</p></div>
        <div className="mini-summary-tile"><span><ArrowDown size={15} className="mini-download" />实时下行</span><strong>{speed(summary.download)}</strong><p>周期下行 {size(summary.inbound)}</p></div>
        <div className="mini-summary-tile"><span><ArrowUp size={15} className="mini-upload" />实时上行</span><strong>{speed(summary.upload)}</strong><p>周期上行 {size(summary.outbound)}</p></div>
      </section>
      <div className="mini-section-title"><div><h2>节点总览</h2><p>共 {servers.length} 台节点，当前显示 {visible.length} 台</p></div><span className={`mini-sync${error ? ' has-error' : ''}`} role="status"><i />{error ? '连接暂时中断' : '数据已同步'}</span></div>
      <section className="mini-toolbar" aria-label="筛选与视图">
        <label className="mini-search"><Search size={16} /><input type="search" placeholder="搜索名称、地区、服务商…" aria-label="搜索节点" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <div className="mini-segment mini-status-filter" aria-label="节点状态">{statusOptions.map(option => <button key={option.value} type="button" aria-pressed={status === option.value} onClick={() => setStatus(option.value)}>{option.label}<span>{option.count}</span></button>)}</div>
        <select aria-label="筛选服务商" value={provider} onChange={event => setProvider(event.target.value)}><option value="">全部服务商</option>{providers.map(item => <option key={item} value={item}>{item}</option>)}{provider && !providers.includes(provider) && <option value={provider}>{provider}（暂无节点）</option>}</select>
        <select aria-label="节点排序" value={sort} onChange={event => setSort(event.target.value as MiniSort)}>{Object.entries(sortLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <div className="mini-segment mini-view-switch" aria-label="显示方式">{(Object.keys(views) as MiniView[]).map(key => { const Icon = views[key]; return <button type="button" key={key} aria-pressed={view === key} aria-label={`${viewLabels[key]}视图`} onClick={() => changeView(key)}><Icon size={15} /><span>{viewLabels[key]}</span></button> })}</div>
      </section>
      <section className={`mini-nodes mini-view-${view}`} aria-label="节点列表">
        {visible.map(({ server, index }) => <NodeCard key={index} server={server} index={index} view={view} />)}
        {!visible.length && <div className="mini-empty"><Search size={27} /><h3>{servers.length ? '没有匹配的节点' : '暂无服务器'}</h3><p>{servers.length ? '试试其他关键词，或清除筛选条件。' : '等待主控上报服务器数据。'}</p>{servers.length > 0 && <button type="button" onClick={() => { setQuery(''); setStatus('all'); setProvider('') }}>清除筛选</button>}</div>}
      </section>
      <footer className="mini-footer">Powered by <a href="https://github.com/chnnic/jiwo-probe" target="_blank" rel="noreferrer">Jiwo Probe</a><span>Lite</span></footer>
    </main>
  </div>
}
