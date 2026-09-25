import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, CalendarDays, Check, LayoutGrid, List, Monitor, Moon, Palette, RefreshCw, Sun } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import type { ProbePingSeries, ProbeServer } from './types'
import { getThemeOverride, setDarkOverride, setTheme, useProbe } from './use-probe'
import { useNetworkSpeed } from './use-network-speed'
import { PING_AVERAGES, pingTargetOptions, resolvePingGroups, type PingGroupConfig } from './ping-groups'
import { PasskeyLogin } from './PasskeyLogin'
import { Twemoji } from './Twemoji'

type Skin = 'win31' | 'win2000' | 'xp' | 'aqua'
type View = 'cards' | 'ring' | 'table'
type RetroFamily = 'win2000' | 'winxp' | 'macos9'

const SKINS: Array<{ value: Skin; label: string }> = [
  { value: 'win31', label: 'Windows 3.1' },
  { value: 'win2000', label: 'Windows 2000' },
  { value: 'xp', label: 'Windows XP' },
  { value: 'aqua', label: 'Mac OS X 10.6' },
]

function percent(value?: number, total?: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || !total || total <= 0) return 0
  return Math.max(0, Math.min(100, (value! / total!) * 100))
}

function formatTraffic(value?: number): string {
  if (!Number.isFinite(value) || value === undefined) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let amount = Math.max(0, value)
  let index = 0
  while (amount >= 1024 && index < units.length - 1) { amount /= 1024; index++ }
  return `${amount >= 100 || index < 2 ? amount.toFixed(0) : amount.toFixed(1)} ${units[index]}`
}

function formatUptime(seconds?: number): string {
  if (!Number.isFinite(seconds) || !seconds || seconds < 60) return '刚刚启动'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  if (days) return `在线 ${days} 天`
  return `在线 ${hours} 小时`
}

function formatRemaining(expiresAt?: string): string {
  if (!expiresAt) return '∞'
  const remaining = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000)
  return Number.isFinite(remaining) ? String(Math.max(0, remaining)) : '∞'
}

function latencyTone(value: number): string {
  if (!Number.isFinite(value) || value < 0) return 'var(--offline)'
  if (value < 100) return 'var(--accent-green)'
  if (value < 200) return 'var(--accent-yellow)'
  return 'var(--accent-red)'
}

function lossTone(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return 'var(--accent-green)'
  if (value < 5) return 'var(--accent-yellow)'
  return 'var(--accent-red)'
}

function Progress({ value, unlimited = false }: { value: number; unlimited?: boolean }) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0
  return <span className="progress" role="progressbar" aria-valuenow={Math.round(safe)} aria-valuemin={0} aria-valuemax={100}>
    <span className={`progress-fill${safe >= 85 ? ' hot' : ''}${unlimited ? ' unlimited' : ''}`} style={{ width: `${unlimited ? 100 : safe}%` }} />
  </span>
}

function Flag({ code }: { code?: string }) {
  const normalized = code?.trim().toUpperCase()
  return normalized && /^[A-Z]{2}$/.test(normalized) ? <Twemoji className="flag-fallback">{String.fromCodePoint(...[...normalized].map(char => 0x1f1e6 + char.charCodeAt(0) - 65))}</Twemoji> : <span className="flag-fallback">—</span>
}

function StatBox({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return <fieldset className={`groupbox stat-box stat-${id}`}><legend>{label}</legend>{children}</fieldset>
}

function FleetBar({ servers }: { servers: ProbeServer[] }) {
  return <span className="fleet-bar" role="img" aria-label={`${servers.filter(server => server.online).length} / ${servers.length}`}>
    {servers.map((server, index) => <i className={server.online ? 'on' : 'off'} key={`${server.name}-${index}`} />)}
  </span>
}

function SkinMenu({ skin, onSelect }: { skin: Skin; onSelect: (skin: Skin) => void }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.skin-menu')) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape) }
  }, [open])
  const selected = SKINS.find(item => item.value === skin)?.label || 'Windows 2000'
  return <span className="skin-menu">
    <button type="button" className="title-btn" title={`主题风格：${selected}`} aria-label={`主题风格：${selected}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(value => !value)}><Palette size={12} /></button>
    {open && <div className="skin-list" role="menu">{SKINS.map(item => <button type="button" role="menuitemradio" aria-checked={item.value === skin} className={`skin-item${item.value === skin ? ' active' : ''}`} key={item.value} onClick={() => { onSelect(item.value); setOpen(false) }}><span className="skin-check">{item.value === skin ? <Check size={10} /> : null}</span>{item.label}</button>)}</div>}
  </span>
}

function ProbeRows({ ping, config }: { ping?: ProbePingSeries[]; config: PingGroupConfig }) {
  const options = useMemo(() => pingTargetOptions(ping || []), [ping])
  const resolved = useMemo(() => resolvePingGroups(options, config), [options, config])
  return <div className="probes">
    {resolved.map((group, index) => {
      const series = group.target?.series
      const latency = series?.current_ms ?? -1
      const loss = series?.loss_pct ?? -1
      const buckets = series?.buckets || []
      const bucketAt = (slot: number) => buckets[slot - Math.max(0, 12 - buckets.length)]
      const label = group.target?.label || PING_AVERAGES.find(average => average.key === group.requested)?.label || group.requested || `延迟 ${index + 1}`
      return <div className="probe-row" key={`${group.requested}-${index}`}>
        <span className="probe-name" title={label}>{label}</span>
        <b className="probe-ms num" style={{ color: latencyTone(latency) }}>{latency < 0 ? '超时' : `${Math.round(latency)} ms`}</b>
        <span className="pill-strip" title="窗口内每个采样桶的往返时延">{Array.from({ length: 12 }, (_, slot) => bucketAt(slot)).map((bucket, slot) => <i key={slot} style={{ background: latencyTone(bucket?.ms ?? -1) }} />)}</span>
        <span className="probe-loss" style={{ color: lossTone(loss) }}>{loss < 0 ? '—' : <><b className="num">{loss.toFixed(1)}</b><i className="read-unit">%</i></>}</span>
        <span className="pill-strip thin" title="窗口内每个采样桶的丢包比例">{Array.from({ length: 12 }, (_, slot) => bucketAt(slot)).map((bucket, slot) => <i key={slot} style={{ background: lossTone(bucket?.loss ?? -1) }} />)}</span>
      </div>
    })}
  </div>
}

function CardData({ server, speed, pingGroups }: { server: ProbeServer; speed: (value?: number) => string; pingGroups: PingGroupConfig }) {
  const up = speed(server.upload_speed).split(' ')
  const down = speed(server.download_speed).split(' ')
  return <div className="card-data">
    <div className="reads">
      <div className="read-col">
        <span className="read read-up" title="上行速率"><ArrowUp className="read-icon" size={10} /><b className="num">{up[0]}</b><i className="read-unit">{up.slice(1).join(' ')}</i></span>
        <span className="read read-down" title="下行速率"><ArrowDown className="read-icon" size={10} /><b className="num">{down[0]}</b><i className="read-unit">{down.slice(1).join(' ')}</i></span>
      </div>
      <div className="read-col">
        <span className="read read-plain"><ArrowUp className="read-icon" size={10} /><b className="num">{formatTraffic(server.traffic_used_up)}</b></span>
        <span className="read read-plain"><ArrowDown className="read-icon" size={10} /><b className="num">{formatTraffic(server.traffic_used_down)}</b></span>
      </div>
      <div className="read-col">
        <span className={`read ${formatRemaining(server.expires_at) !== '∞' && Number(formatRemaining(server.expires_at)) <= 7 ? 'read-alert' : 'read-plain'}`}><CalendarDays className="read-icon" size={10} /><span className="read-text">剩余</span><b className="num" style={{ '--slot': '2.4ch' } as CSSProperties}>{formatRemaining(server.expires_at)}</b><i className="read-unit">天</i></span>
        <span className="read read-plain read-price"><span className="read-text">价格</span><b>{server.renewal_price_cny || server.renewal_price ? `${server.renewal_price_cny || server.renewal_price} / 月` : '免费'}</b></span>
      </div>
    </div>
    <ProbeRows ping={server.ping} config={pingGroups} />
  </div>
}

function ServerTitle({ server }: { server: ProbeServer }) {
  const name = server.name || '未命名节点'
  return <div className={`title-bar${server.online ? '' : ' inactive'}`}>
    <Monitor className="title-bar-icon" size={14} />
    <Flag code={server.region_country} />
    <span className="os-icon-img" title={server.os || '系统'}>{server.os?.toLowerCase().includes('windows') ? '⊞' : '◆'}</span>
    <span className="title-bar-text" title={name}>{name}</span>
    <span className="card-status"><span className={`led${server.online ? ' on' : ''}`} />{server.online ? '在线' : '离线'}</span>
  </div>
}

function ServerCard({ server, index, speed, pingGroups, ring = false }: { server: ProbeServer; index: number; speed: (value?: number) => string; pingGroups: PingGroupConfig; ring?: boolean }) {
  const trafficUsed = percent(server.traffic_used, server.traffic_limit)
  const memory = percent(server.mem_used, server.mem_total)
  const disk = percent(server.disk_used, server.disk_total)
  const meta = server.online ? formatUptime(server.uptime) : '离线'
  return <article className={`win server-card${ring ? ' ring-card' : ''}${server.online ? '' : ' offline'}`}>
    <ServerTitle server={server} />
    <div className="card-body">
      <div className="card-meta"><span className={`card-meta-item${server.online ? '' : ' expired'}`}>{meta}</span><span className="card-meta-spacer" />{server.cpu_cores ? <span className="badge">{server.cpu_cores} 核</span> : null}{server.arch ? <span className="badge">{server.arch}</span> : null}</div>
      {ring ? <div className="pies">
        <div className="pie-item"><DiskPie value={server.cpu_pct || 0} /><b>CPU {Math.round(server.cpu_pct || 0)}%</b><span className="pie-sub">{server.cpu_cores || '—'} 核</span></div>
        <div className="pie-item"><DiskPie value={memory} /><b>内存 {Math.round(memory)}%</b><span className="pie-sub">{formatTraffic(server.mem_used)} / {formatTraffic(server.mem_total)}</span></div>
        <div className="pie-item"><DiskPie value={disk} /><b>硬盘 {Math.round(disk)}%</b><span className="pie-sub">{formatTraffic(server.disk_used)} / {formatTraffic(server.disk_total)}</span></div>
      </div> : <div className="card-meters">
        <span>CPU</span><Progress value={server.cpu_pct || 0} /><span className="num">{(server.cpu_pct || 0).toFixed(2)}%</span>
        <span>内存</span><Progress value={memory} /><span className="num">{memory.toFixed(2)}%</span>
        <span>硬盘</span><Progress value={disk} /><span className="num">{disk.toFixed(2)}%</span>
        <span>用量</span><Progress value={trafficUsed} unlimited={!server.traffic_limit || server.traffic_limit <= 0} /><span className="num">{server.traffic_limit ? `${trafficUsed.toFixed(2)}%` : '∞'}</span>
      </div>}
      <CardData server={server} speed={speed} pingGroups={pingGroups} />
    </div>
  </article>
}

function DiskPie({ value }: { value: number }) {
  return <span className="disk-pie" style={{ '--pie-pct': `${Math.max(0, Math.min(100, value))}%` } as CSSProperties}><span className="disk-pie-side" /><span className="disk-pie-top" /></span>
}

function SortableTable({ servers, speed }: { servers: ProbeServer[]; speed: (value?: number) => string }) {
  const [sort, setSort] = useState<keyof ProbeServer | null>(null)
  const [descending, setDescending] = useState(true)
  const sorted = useMemo(() => [...servers].sort((left, right) => {
    if (!sort) return 0
    const a = Number(left[sort] || 0)
    const b = Number(right[sort] || 0)
    return descending ? b - a : a - b
  }), [servers, sort, descending])
  const header = (label: string, field?: keyof ProbeServer, className?: string) => <th className={className}><button type="button" className="col-head" onClick={() => { if (sort === field) setDescending(value => !value); else { setSort(field || null); setDescending(true) } }}>{label}{field && sort === field ? (descending ? ' ▼' : ' ▲') : ''}</button></th>
  return <div className="table-scroll sunken"><table className="listview"><thead><tr>{header('', undefined, 'col-status')}{header('名称', 'name')}{header('在线', 'uptime')}{header('到期')}{header('负载', 'cpu_pct')}{header('实时网速 ↓|↑', 'download_speed')}{header('CPU', 'cpu_pct')}{header('内存', 'mem_used')}{header('硬盘', 'disk_used')}{header('流量', 'traffic_used')}</tr></thead><tbody>{sorted.length === 0 ? <tr className="table-empty"><td colSpan={10}>没有匹配的服务器</td></tr> : sorted.map((server, index) => { const memory = percent(server.mem_used, server.mem_total); const disk = percent(server.disk_used, server.disk_total); return <tr className={server.online ? '' : 'offline'} key={`${server.name}-${index}`}><td className="col-status"><span className={`led${server.online ? ' on' : ''}`} /></td><td><span className="cell-flex"><Flag code={server.region_country} /><span>{server.name || `服务器 ${index + 1}`}</span></span></td><td>{server.online ? formatUptime(server.uptime) : '离线'}</td><td>{formatRemaining(server.expires_at)} 天</td><td>{(server.cpu_pct || 0).toFixed(1)}%</td><td>{speed(server.download_speed)} ↓ / {speed(server.upload_speed)} ↑</td><td><span className="cell-meter"><Progress value={server.cpu_pct || 0} /><span className="num">{(server.cpu_pct || 0).toFixed(1)}%</span></span></td><td><span className="cell-meter"><Progress value={memory} /><span className="num">{memory.toFixed(1)}%</span></span></td><td><span className="cell-meter"><Progress value={disk} /><span className="num">{disk.toFixed(1)}%</span></span></td><td>{formatTraffic(server.traffic_used)}</td></tr> })}</tbody></table></div>
}

export function RetroDesktopApp({ family }: { family: RetroFamily }) {
  const { data, error, pingGroups } = useProbe()
  const speed = useNetworkSpeed()
  const servers = data?.servers || []
  const [skin, setSkin] = useState<Skin>(() => {
    try { const value = JSON.parse(localStorage.getItem('serverstatus:w2k-skin') || 'null') as Skin; return SKINS.some(item => item.value === value) ? value : 'win2000' } catch { return 'win2000' }
  })
  const [view, setView] = useState<View>(() => {
    try { const value = JSON.parse(localStorage.getItem('serverstatus:w2k-view') || '"cards"') as View; return value === 'ring' || value === 'table' ? value : 'cards' } catch { return 'cards' }
  })
  const [dark, setDark] = useState(() => {
    if (family === 'macos9') return false
    try {
      const choice = JSON.parse(localStorage.getItem(`serverstatus:${family}-theme`) || '"light"')
      return choice === 'dark' || (choice === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)
    } catch { return document.documentElement.classList.contains('dark') }
  })
  const [region, setRegion] = useState('')
  const themeOverride = getThemeOverride()

  useEffect(() => {
    if (family === 'win2000') {
      localStorage.setItem('serverstatus:w2k-skin', JSON.stringify(skin))
      document.body.dataset.skin = skin
    } else if (family === 'winxp') {
      document.body.dataset.skin = 'xp'
    } else {
      document.body.removeAttribute('data-skin')
    }
    return () => { if (family !== 'win2000') document.body.removeAttribute('data-skin') }
  }, [family, skin])
  useEffect(() => { localStorage.setItem('serverstatus:w2k-view', JSON.stringify(view)) }, [view])
  useEffect(() => {
    document.body.classList.toggle('light', family === 'macos9' || !dark)
    return () => { document.body.classList.remove('light') }
  }, [dark, family])

  const regions = useMemo(() => [...new Set(servers.map(server => server.region_country || server.region).filter(Boolean) as string[])].sort(), [servers])
  const visible = region ? servers.filter(server => (server.region_country || server.region) === region) : servers
  const online = servers.filter(server => server.online).length
  const totalUp = servers.reduce((sum, server) => sum + (server.upload_speed || 0), 0)
  const totalDown = servers.reduce((sum, server) => sum + (server.download_speed || 0), 0)
  const totalTraffic = servers.reduce((sum, server) => sum + (server.traffic_used || 0), 0)
  const busiest = [...servers].sort((a, b) => (b.cpu_pct || 0) - (a.cpu_pct || 0))[0]
  const selectDark = () => { const next = !dark; setDark(next); localStorage.setItem(`serverstatus:${family}-theme`, JSON.stringify(next ? 'dark' : 'light')); setDarkOverride(next ? 'dark' : 'light') }
  const title = data?.title?.trim() || '服务器监控'
  const familyControl = <select className="retro-family-select" aria-label="切换复古主题" value={family} onChange={event => setTheme(event.target.value as RetroFamily)}><option value="win2000">Windows 2000</option><option value="winxp">Windows XP</option><option value="macos9">Mac OS 9 Platinum</option></select>

  if (!data && !error) return <main className="center">正在连接 Win2000 主题…</main>
  if (error && !data) return <main className="center error">连接中断：{error}</main>
  if (!data?.enabled) return <main className="center">探针尚未启用</main>

  return <main className={`desktop retro-desktop retro-${family}`}>
    {family === 'macos9' && <nav className="classic-menubar" aria-label="Mac OS 9 菜单栏"><span className="classic-menu-icon"><Monitor size={14} /></span><span className="classic-menu-item">文件</span><span className="classic-menu-item">视图</span><span className="classic-menu-item">服务器</span><span className="classic-menu-item">帮助</span><div className="classic-menu-trailing">{familyControl}<span className="classic-clock">{new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())}</span></div></nav>}
    <div className={`win app-window retro-window retro-window-${family}`}>
      <header className="title-bar retro-title-bar"><Monitor className="title-bar-icon" size={14} /><span className="title-bar-text">{title}</span>{family !== 'macos9' && familyControl}{family === 'win2000' && <SkinMenu skin={skin} onSelect={setSkin} />}{family !== 'macos9' && <button type="button" className="title-btn" title={dark ? '切换到浅色' : '切换到深色'} aria-label={dark ? '切换到浅色' : '切换到深色'} onClick={selectDark}>{dark ? <Sun size={10} /> : <Moon size={10} />}</button>}<PasskeyLogin buttonClassName="title-btn title-btn-last" iconSize={10} /></header>
      <main className="app-body"><div className="page">
        <div className="toolbar"><button type="button" className={`tool-btn${view === 'cards' ? ' active' : ''}`} onClick={() => setView('cards')}><LayoutGrid size={14} />卡片</button><button type="button" className={`tool-btn${view === 'ring' ? ' active' : ''}`} onClick={() => setView('ring')}><span aria-hidden="true">◔</span>圆环</button><button type="button" className={`tool-btn${view === 'table' ? ' active' : ''}`} onClick={() => setView('table')}><List size={14} />表格</button><span className="tool-sep" /><span className="tool-label text-muted">{servers.length} 台服务器</span>{themeOverride && <span className="tool-label text-muted">主题：{themeOverride}</span>}<button type="button" className="tool-btn refresh-btn" onClick={() => window.location.reload()} title="刷新"><RefreshCw size={13} /></button></div>
        <div className="page-content"><div className="dashboard-panel">
          <div className="stats-grid"><StatBox label="服务器" id="fleet"><span className="stat-figure"><b className="stat-big"><span className="text-online">{online} 在线</span><span className="stat-sep"> | </span><span className="text-offline">{servers.length - online} 离线</span></b><FleetBar servers={servers} /></span></StatBox><StatBox label="实时速度" id="speed"><span className="stat-figure"><b className="stat-big num">{speed(totalDown + totalUp)}</b><span className="stat-sub"><i className="net-up">↑</i> {speed(totalUp)}<span className="stat-sep"> · </span><i className="net-down">↓</i> {speed(totalDown)}</span></span></StatBox><StatBox label="累计流量" id="total"><span className="stat-figure"><b className="stat-big num">{formatTraffic(totalTraffic)}</b><span className="stat-sub"><i className="net-up">↑</i> {formatTraffic(servers.reduce((sum, server) => sum + (server.traffic_used_up || 0), 0))}<span className="stat-sep"> · </span><i className="net-down">↓</i> {formatTraffic(servers.reduce((sum, server) => sum + (server.traffic_used_down || 0), 0))}</span></span></StatBox><StatBox label="最忙节点" id="busy">{busiest ? <div className="stat-busy"><span className="stat-busy-name" title={busiest.name}>{busiest.name || '—'}</span><b className="num">{(busiest.cpu_pct || 0).toFixed(1)}%</b><Progress value={busiest.cpu_pct || 0} /></div> : <span className="text-muted">—</span>}</StatBox></div>
          <div className="tabs filter-tabs"><button type="button" className={`tab${region === '' ? ' active' : ''}`} onClick={() => setRegion('')}><span>ALL</span><span className="tab-count">全部 {servers.length}</span></button>{regions.map(item => <button type="button" className={`tab${region === item ? ' active' : ''}`} key={item} onClick={() => setRegion(item)}><Flag code={item} /><span>{item}</span><span className="tab-count">{servers.filter(server => (server.region_country || server.region) === item).length}</span></button>)}</div>
          {visible.length === 0 ? <div className="tab-panel"><p className="empty-state">这个地区没有节点</p></div> : view === 'table' ? <SortableTable servers={visible} speed={speed} /> : <div className={`servers-grid${view === 'ring' ? ' ring-grid' : ''}`}>{visible.map((server, index) => <ServerCard key={`${server.name}-${index}`} server={server} index={index} speed={speed} pingGroups={pingGroups} ring={view === 'ring'} />)}</div>}
        </div></div>
      </div></main>
      <footer className="status-bar"><div className="status-field grow">{error ? `连接中断：${error}` : `已连接 · ${online} 在线 / ${servers.length - online} 离线`}</div><div className="status-field status-credit">Powered by&nbsp;<a href={family === 'macos9' ? 'https://github.com/livid/exe' : family === 'winxp' ? 'https://github.com/botoxparty/XP.css' : 'https://github.com/guboysky/win2000'} target="_blank" rel="noreferrer">{family === 'macos9' ? 'Mac OS 9 Platinum' : family === 'winxp' ? 'Windows XP' : 'Win2000 Theme'}</a></div></footer>
    </div>
  </main>
}
