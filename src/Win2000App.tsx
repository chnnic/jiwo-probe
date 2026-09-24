import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Check, LayoutGrid, List, Monitor, Moon, Palette, RefreshCw, Sun } from 'lucide-react'
import type { ProbeServer, ThemeName } from './types'
import { getThemeOverride, setDarkOverride, setTheme, useProbe } from './use-probe'
import { useNetworkSpeed } from './use-network-speed'
import { PasskeyLogin } from './PasskeyLogin'
import { CardPingGroups } from './CardPingGroups'
import { Twemoji } from './Twemoji'

type Skin = 'win31' | 'win2000' | 'xp' | 'aqua'
type View = 'cards' | 'rings' | 'table'

const SKINS: Array<{ value: Skin; label: string }> = [
  { value: 'win31', label: 'Windows 3.1' },
  { value: 'win2000', label: 'Windows 2000' },
  { value: 'xp', label: 'Windows XP' },
  { value: 'aqua', label: 'Mac OS X 10.6' },
]
const THEMES: Array<{ value: ThemeName | null; label: string }> = [
  { value: null, label: '跟随主控' },
  { value: 'pixel', label: '像素' },
  { value: 'flat', label: '扁平' },
  { value: 'anime', label: '动漫' },
  { value: 'glass', label: '玻璃' },
  { value: 'lumina', label: 'Lumina' },
  { value: 'premium', label: 'Premium' },
  { value: 'ran', label: '岚 · Ran' },
  { value: 'glassmorphism', label: 'Glassmorphism' },
  { value: 'emerald', label: 'Emerald' },
  { value: 'win2000', label: 'Windows 2000' },
]

function percent(value?: number, total?: number): number {
  if (!total || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, ((value || 0) / total) * 100))
}

function segment(value: number, count = 24): string {
  const filled = Math.round(Math.max(0, Math.min(1, value)) * count)
  return '▮'.repeat(filled) + '▯'.repeat(count - filled)
}

function latencyColor(ms: number): string {
  if (ms < 80) return 'good'
  if (ms < 160) return 'warn'
  return 'bad'
}

function formatUptime(seconds?: number): string {
  if (!seconds || seconds < 60) return '刚刚启动'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  return days ? `在线 ${days} 天 ${hours} 小时` : `在线 ${hours} 小时`
}

function NodeMeter({ label, value }: { label: string; value: number }) {
  return <div className="w2k-meter-row"><span>{label}</span><b>{segment(value / 100)}</b><em>{value.toFixed(1)}%</em></div>
}

function NodeCard({ server, index, speed }: { server: ProbeServer; index: number; speed: (value?: number) => string }) {
  const name = server.name || `服务器 ${index + 1}`
  const ping = server.ping?.filter((item) => item.current_ms >= 0).sort((a, b) => a.current_ms - b.current_ms)[0]
  const used = percent(server.traffic_used, server.traffic_limit)
  return (
    <article className={`w2k-node ${server.online ? '' : 'offline'}`}>
      <header className="w2k-node-title">
        <span className={`w2k-led ${server.online ? 'online' : 'offline'}`} />
        {server.region_country && <Twemoji>{server.region_country}</Twemoji>}
        <strong title={name}>{name}</strong>
        <span className="w2k-node-state">{server.online ? '在线' : '离线'}</span>
      </header>
      <div className="w2k-node-subtitle"><span>{server.os || server.cpu_model || '系统信息暂缺'}</span><span>{formatUptime(server.uptime)}</span></div>
      <div className="w2k-meters">
        <NodeMeter label="CPU" value={server.cpu_pct || 0} />
        <NodeMeter label="内存" value={percent(server.mem_used, server.mem_total)} />
        <NodeMeter label="硬盘" value={percent(server.disk_used, server.disk_total)} />
        <NodeMeter label="用量" value={used} />
      </div>
      <div className="w2k-traffic">
        <span className="up"><ArrowUp size={12} />{speed(server.upload_speed)}</span>
        <span className="down"><ArrowDown size={12} />{speed(server.download_speed)}</span>
        <span>↑ {formatTraffic(server.traffic_used_up)} </span>
        <span>↓ {formatTraffic(server.traffic_used_down)}</span>
      </div>
      <CardPingGroups variant="classic" ping={server.ping} serverIndex={index} serverName={server.name} />
      {ping && <div className={`w2k-ping-line ${latencyColor(ping.current_ms)}`}><span>{ping.label}</span><b>{ping.current_ms.toFixed(0)} ms</b><code>{segment(Math.max(0, 1 - ping.current_ms / 300))}</code><em>{ping.loss_pct.toFixed(1)}%</em></div>}
    </article>
  )
}

function formatTraffic(value?: number): string {
  if (!Number.isFinite(value) || value === undefined) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let n = Math.max(0, value)
  let i = 0
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
  return `${n >= 100 || i < 2 ? n.toFixed(0) : n.toFixed(1)} ${units[i]}`
}

function Ring({ value, label, tone }: { value: number; label: string; tone: string }) {
  const deg = Math.round(Math.max(0, Math.min(100, value)) * 3.6)
  return <div className={`w2k-ring ${tone}`} style={{ '--ring': `${deg}deg` } as React.CSSProperties}><div><strong>{value.toFixed(0)}%</strong><span>{label}</span></div></div>
}

export function Win2000App() {
  const { data, error } = useProbe()
  const speed = useNetworkSpeed()
  const servers = data?.servers || []
  const [skin, setSkin] = useState<Skin>(() => {
    const value = localStorage.getItem('win2000-skin') as Skin | null
    return SKINS.some((item) => item.value === value) ? value! : 'win2000'
  })
  const [view, setView] = useState<View>(() => (localStorage.getItem('win2000-view') as View) || 'cards')
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [region, setRegion] = useState('全部')
  const [theme, setThemeState] = useState<ThemeName | null>(() => getThemeOverride())

  useEffect(() => {
    localStorage.setItem('win2000-skin', skin)
    document.documentElement.dataset.w2kSkin = skin
  }, [skin])
  useEffect(() => { localStorage.setItem('win2000-view', view) }, [view])

  const regions = useMemo(() => ['全部', ...new Set(servers.map((server) => server.region_country || server.region).filter(Boolean) as string[])], [servers])
  const visible = region === '全部' ? servers : servers.filter((server) => (server.region_country || server.region) === region)
  const online = servers.filter((server) => server.online).length
  const totalUp = servers.reduce((sum, server) => sum + (server.upload_speed || 0), 0)
  const totalDown = servers.reduce((sum, server) => sum + (server.download_speed || 0), 0)
  const totalTraffic = servers.reduce((sum, server) => sum + (server.traffic_used || 0), 0)
  const worst = [...servers].sort((a, b) => (b.cpu_pct || 0) - (a.cpu_pct || 0))[0]

  if (!data && !error) return <main className="center">正在启动 Win2000 主题…</main>
  if (error && !data) return <main className="center error">主控暂时不可用<br /><small>{error}</small></main>
  if (!data?.enabled) return <main className="center">探针尚未启用</main>

  const changeTheme = (value: string) => {
    const next = value === '' ? null : value as ThemeName
    setTheme(next)
    setThemeState(next)
  }
  const toggleDark = () => {
    const next = dark ? 'light' : 'dark'
    setDarkOverride(next)
    setDark(!dark)
  }
  return (
    <main className={`w2k-desktop ${dark ? 'dark' : 'light'} skin-${skin}`}>
      <section className="w2k-window" aria-label="Win2000 服务器监控">
        <header className="w2k-titlebar">
          <div><Monitor size={14} /><strong>{data.title?.trim() || '服务器状态'}</strong></div>
          <div className="w2k-title-controls"><button aria-label="最小化">_</button><button aria-label="最大化">□</button><button aria-label="关闭">×</button></div>
        </header>
        <nav className="w2k-toolbar">
          <div className="w2k-toolbar-tabs"><button className={view === 'cards' ? 'active' : ''} onClick={() => setView('cards')}><LayoutGrid size={14} />卡片</button><button className={view === 'rings' ? 'active' : ''} onClick={() => setView('rings')}>◔ 圆环</button><button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}><List size={14} />表格</button></div>
          <span className="w2k-toolbar-count">{servers.length} 台服务器</span>
          <label className="w2k-skin-select"><Palette size={13} /><select value={skin} onChange={(event) => setSkin(event.target.value as Skin)}>{SKINS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="w2k-theme-select"><select value={theme || ''} onChange={(event) => changeTheme(event.target.value)}>{THEMES.map((item) => <option key={item.value || 'master'} value={item.value || ''}>{item.label}</option>)}</select></label>
          <button className="w2k-icon-button" onClick={toggleDark} title="切换明暗模式">{dark ? <Sun size={14} /> : <Moon size={14} />}</button><PasskeyLogin />
        </nav>
        <section className="w2k-summary">
          <div><span>节点状态</span><strong><b>{online}</b> 在线 / {servers.length - online} 离线</strong><code className="w2k-segments">{segment(online / Math.max(1, servers.length), 16)}</code></div>
          <div><span>实时速度</span><strong>{speed(totalDown)} <small>↓</small> / {speed(totalUp)} <small>↑</small></strong><em>当前总下行 / 总上行</em></div>
          <div><span>累计流量</span><strong>{formatTraffic(totalTraffic)}</strong><em>所有节点合计</em></div>
          <div><span>最忙节点</span><strong>{worst?.name || '—'}</strong><em>{worst ? `${(worst.cpu_pct || 0).toFixed(1)}% CPU` : '暂无数据'}</em></div>
        </section>
        <div className="w2k-filterbar">{regions.map((item) => <button key={item} className={region === item ? 'active' : ''} onClick={() => setRegion(item)}>{item} {item === '全部' ? servers.length : visible.filter((server) => (server.region_country || server.region) === item).length}</button>)}<button className="w2k-refresh" onClick={() => window.location.reload()} title="刷新"><RefreshCw size={13} /></button></div>
        {view === 'cards' && <section className="w2k-grid">{visible.map((server, index) => <NodeCard key={`${server.name}-${index}`} server={server} index={servers.indexOf(server)} speed={speed} />)}</section>}
        {view === 'rings' && <section className="w2k-rings">{visible.map((server, index) => <article className="w2k-ring-card" key={`${server.name}-${index}`}><header><span className={`w2k-led ${server.online ? 'online' : 'offline'}`} />{server.name || `服务器 ${index + 1}`}</header><div className="w2k-ring-row"><Ring value={server.cpu_pct || 0} label="CPU" tone="blue" /><Ring value={percent(server.mem_used, server.mem_total)} label="内存" tone="green" /><Ring value={percent(server.disk_used, server.disk_total)} label="硬盘" tone="orange" /></div><footer>{speed(server.download_speed)} ↓　{speed(server.upload_speed)} ↑</footer></article>)}</section>}
        {view === 'table' && <div className="w2k-table-wrap"><table className="w2k-table"><thead><tr><th>状态</th><th>节点</th><th>CPU</th><th>内存</th><th>硬盘</th><th>实时速度</th><th>延迟</th></tr></thead><tbody>{visible.map((server, index) => { const ping = server.ping?.find((item) => item.current_ms >= 0); return <tr key={`${server.name}-${index}`}><td><span className={`w2k-led ${server.online ? 'online' : 'offline'}`} /></td><td>{server.name || `服务器 ${index + 1}`}</td><td>{(server.cpu_pct || 0).toFixed(1)}%</td><td>{percent(server.mem_used, server.mem_total).toFixed(1)}%</td><td>{percent(server.disk_used, server.disk_total).toFixed(1)}%</td><td>{speed(server.download_speed)} ↓ / {speed(server.upload_speed)} ↑</td><td>{ping ? `${ping.current_ms.toFixed(0)} ms` : '—'}</td></tr> })}</tbody></table></div>}
        <footer className="w2k-statusbar"><span>已连接 · {online} 在线 / {servers.length - online} 离线</span><span>Powered by <a href="https://github.com/guboysky/win2000" target="_blank" rel="noreferrer">Win2000 Theme</a></span></footer>
      </section>
    </main>
  )
}
