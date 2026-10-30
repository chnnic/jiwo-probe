// 哪吒主题：照哪吒 V1 默认前台（hamster1963/nezha-dash-v1，Apache-2.0）的页面结构与视觉重写，
// 数据仍是本站的主控快照；来源说明见 NOTICE.md。点卡片进详情沿用 Lite 的六标签详情页。
import { lazy, memo, Suspense, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowDownUp, ArrowUp, Columns3, Map as MapIcon, Moon, Network, Search, Share2, Sun, SunMoon } from 'lucide-react'
import type { ProbePayload, ProbeServer, ThemeName } from '../types'
import { ThemeSelect } from '../ThemePicker'
import { PasskeyLogin } from '../PasskeyLogin'
import { Twemoji } from '../Twemoji'
import { applyAppearance, getNezhaMode, getThemeOverride, setNezhaMode } from '../use-probe'
import { useNetworkSpeed } from '../use-network-speed'
import { bytes, hasLeadingFlag, probeRegion, regionFlag } from '../server-format'
import { SystemIcon, displayReturnRoute, routeCarrierLabels } from '../components/ServerVisuals'
import { ProbeLicenseBar } from '../components/ProbeLicenseBar'
import { ForwardOverview } from '../deferred'
import { billingInfo, cpuPct, osShortName, diskPct, memPct, nezhaOverview, NEZHA_SORT_LABELS, NEZHA_SORT_TYPES, regionTabs, selectNezhaServers, totalDown, totalUp, uptimeLabel, usageTone, type NezhaSortOrder, type NezhaSortType, type NezhaStatus } from './nezha-model'
import '../mini/mini.css'
import './nezha.css'

const ProbeRegionGlobe = lazy(() => import('../ProbeRegionGlobe').then((module) => ({ default: module.ProbeRegionGlobe })))

function readPref(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback } catch { return fallback }
}
function writePref(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* 隐私模式下只在本页生效 */ }
}

export default function NezhaApp({ data, error, onThemeChange }: { data: ProbePayload; error?: string; onThemeChange: (name: ThemeName | null) => void }) {
  const servers = data.servers || []
  const [status, setStatus] = useState<NezhaStatus>('all')
  const [group, setGroup] = useState('all')
  const [query, setQuery] = useState('')
  const [sort, setSortState] = useState<NezhaSortType>(() => { const saved = readPref('jiwo-nezha-sort', 'default'); return (NEZHA_SORT_TYPES as string[]).includes(saved) ? saved as NezhaSortType : 'default' })
  const [order, setOrderState] = useState<NezhaSortOrder>(() => readPref('jiwo-nezha-order', 'desc') === 'asc' ? 'asc' : 'desc')
  const [inline, setInline] = useState(() => readPref('jiwo-nezha-inline', '0') === '1')
  const [showMap, setShowMap] = useState(() => readPref('jiwo-nezha-map', '0') === '1')
  const [showForward, setShowForward] = useState(() => readPref('jiwo-nezha-forward', '1') === '1')
  const toggle = (key: string, value: boolean, set: (next: boolean) => void) => { set(!value); writePref(key, value ? '0' : '1') }
  const setSort = (next: NezhaSortType) => { setSortState(next); writePref('jiwo-nezha-sort', next); if (next === 'default') { setOrderState('desc'); writePref('jiwo-nezha-order', 'desc') } }
  const setOrder = (next: NezhaSortOrder) => { setOrderState(next); writePref('jiwo-nezha-order', next) }
  const overview = useMemo(() => nezhaOverview(servers), [servers])
  const tabs = useMemo(() => regionTabs(servers), [servers])
  const visible = useMemo(() => selectNezhaServers(servers, { status, group, query, sort, order }), [servers, status, group, query, sort, order])
  const globeRegions = useMemo(() => servers.map(probeRegion).filter(Boolean), [servers])
  const forwardEnabled = data.show_forward !== false && (!!data.show_forward || !!data.forward?.length)
  const title = data.title?.trim() || '服务器状态'
  return (
    <div className="nz-app">
      <NezhaHeader data={data} title={title} online={overview.online} error={error} onThemeChange={onThemeChange} />
      <main className="nz-main">
        <NezhaGreeting />
        <section className="nz-overview" aria-label="服务器概览">
          <button type="button" className="nz-card nz-overview-card tone-blue" aria-pressed={status === 'all'} onClick={() => setStatus('all')}>
            <p>总服务器</p><div><i className="nz-dot blue" /><strong>{overview.total}</strong></div>
          </button>
          <button type="button" className={`nz-card nz-overview-card tone-green${status === 'online' ? ' is-active' : ''}`} aria-pressed={status === 'online'} onClick={() => setStatus(status === 'online' ? 'all' : 'online')}>
            <p>在线服务器</p><div><i className="nz-dot green" /><strong>{overview.online}</strong></div>
          </button>
          <button type="button" className={`nz-card nz-overview-card tone-red${status === 'offline' ? ' is-active' : ''}`} aria-pressed={status === 'offline'} onClick={() => setStatus(status === 'offline' ? 'all' : 'offline')}>
            <p>离线服务器</p><div><i className="nz-dot red" /><strong>{overview.offline}</strong></div>
          </button>
          <NetworkCard up={overview.up} down={overview.down} upSpeed={overview.upSpeed} downSpeed={overview.downSpeed} />
        </section>
        {servers.length > 0 && (
          <div className="nz-controls">
            <section className="nz-controls-start">
              <button type="button" className="nz-round-button" aria-pressed={showMap} aria-label={showMap ? '收起地区分布' : '展开地区分布'} title="地区分布" onClick={() => toggle('jiwo-nezha-map', showMap, setShowMap)}><MapIcon size={13} /></button>
              {forwardEnabled && <button type="button" className="nz-round-button" aria-pressed={showForward} aria-label={showForward ? '隐藏转发链' : '显示转发链'} title="转发链拓扑与延迟" onClick={() => toggle('jiwo-nezha-forward', showForward, setShowForward)}><Share2 size={13} /></button>}
              <button type="button" className="nz-round-button" aria-pressed={inline} aria-label={inline ? '切换为卡片视图' : '切换为列表视图'} title={inline ? '卡片视图' : '列表视图'} onClick={() => toggle('jiwo-nezha-inline', inline, setInline)}><Columns3 size={13} /></button>
              {tabs.length > 2 && (
                <div className="nz-group-switch" role="tablist" aria-label="按地区分组">
                  {tabs.map((tab) => <button key={tab.key} type="button" role="tab" aria-selected={group === tab.key} onClick={() => setGroup(tab.key)}><Twemoji>{tab.label}</Twemoji></button>)}
                </div>
              )}
            </section>
            <label className="nz-pill nz-search"><Search size={14} /><input type="search" aria-label="搜索服务器" placeholder="搜索" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
            <div className={`nz-pill nz-sort${sort !== 'default' ? ' is-active' : ''}`}>
              <button type="button" aria-label="切换排序方向" disabled={sort === 'default'} onClick={() => setOrder(order === 'asc' ? 'desc' : 'asc')}>
                {sort === 'default' ? <ArrowDownUp size={14} /> : order === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}<span>排序</span>
              </button>
              <i aria-hidden="true">|</i>
              <select aria-label="排序项" value={sort} onChange={(event) => setSort(event.target.value as NezhaSortType)}>
                {NEZHA_SORT_TYPES.map((type) => <option key={type} value={type}>{NEZHA_SORT_LABELS[type]}</option>)}
              </select>
            </div>
          </div>
        )}
        {showMap && globeRegions.length > 0 && (
          <section className="nz-card nz-map" aria-label="地区分布">
            <Suspense fallback={<div className="nz-loading">正在加载地区分布…</div>}><ProbeRegionGlobe regions={globeRegions} /></Suspense>
          </section>
        )}
        {forwardEnabled && showForward && <div className="nz-forward"><ForwardOverview data={data} /></div>}
        {inline ? (
          <section className="nz-inline-list" aria-label="服务器列表">{visible.map(({ server, index }) => <NezhaInlineCard key={index} server={server} index={index} />)}</section>
        ) : (
          <section className="nz-card-list" aria-label="服务器列表">{visible.map(({ server, index }) => <NezhaCard key={index} server={server} index={index} />)}</section>
        )}
        {!visible.length && <div className="nz-empty">{servers.length ? '没有符合条件的服务器' : '暂无服务器数据，等待主控上报'}</div>}
        <footer className="nz-footer">
          <span>Powered by <a href="https://github.com/chnnic/jiwo-probe" target="_blank" rel="noreferrer">Jiwo Probe</a></span>
          <span>界面参考 <a href="https://github.com/hamster1963/nezha-dash-v1" target="_blank" rel="noreferrer">Nezha Dash</a></span>
        </footer>
      </main>
      <ProbeLicenseBar badges={data.license_badge} storageKey="jiwo-nezha-license-anim" className="probe-license-bar nz-license" toggleClassName="probe-license-toggle" />
    </div>
  )
}

// 「自动」：主控写了 nezha-light / nezha-dark 时跟随主控，否则跟随系统
const MODE_NAMES = { light: '浅色', dark: '深色', system: '自动' } as const

function NezhaHeader({ data, title, online, error, onThemeChange }: { data: ProbePayload; title: string; online: number; error?: string; onThemeChange: (name: ThemeName | null) => void }) {
  const [mode, setMode] = useState<'light' | 'dark' | 'system'>(() => getNezhaMode() ?? 'system')
  // 跟随系统时，系统切换明暗立刻生效
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!media) return
    const listener = () => { if (getNezhaMode() === null) applyAppearance() }
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [])
  const next = mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light'
  const ModeIcon = mode === 'light' ? Sun : mode === 'dark' ? Moon : SunMoon
  return (
    <header className="nz-header">
      <a href="#" className="nz-brand" aria-label="返回首页">
        {data.logo ? <img src={data.logo} alt="" /> : <Network size={20} />}
        <span>{title}</span>
        <i className="nz-separator" aria-hidden="true" />
        <small>集群实时探针</small>
      </a>
      <nav className="nz-handles" aria-label="外观与登录">
        <PasskeyLogin buttonClassName="nz-outline-button" iconSize={16} />
        <ThemeSelect value={getThemeOverride()} onChange={onThemeChange} />
        <button type="button" className="nz-outline-button" aria-label={`切换到${MODE_NAMES[next]}`} title={`明暗：${mode === 'system' ? '自动（跟随主控或系统）' : MODE_NAMES[mode]}；点击切换到${MODE_NAMES[next]}`} onClick={() => { setNezhaMode(next === 'system' ? null : next); setMode(next) }}><ModeIcon size={16} /></button>
        <span className="nz-outline-button nz-online" role="status" title={error ? `连接中断，显示最近数据：${error}` : '实时数据已连接'}>
          <b>{online}</b><span>{error ? '离线' : '在线'}</span><i className={error ? 'nz-dot red' : 'nz-dot green'} />
        </span>
      </nav>
    </header>
  )
}

// 「👋 概览 · 当前时间」：单独成组件，每秒只刷新这一行
function NezhaGreeting() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const pad = (value: number) => String(value).padStart(2, '0')
  return (
    <section className="nz-greeting">
      <p>👋 概览</p>
      <div><span>当前时间</span><time dateTime={now.toISOString()}>{pad(now.getHours())}<i>:</i>{pad(now.getMinutes())}<i>:</i>{pad(now.getSeconds())}</time></div>
    </section>
  )
}

function NetworkCard({ up, down, upSpeed, downSpeed }: { up: number; down: number; upSpeed: number; downSpeed: number }) {
  const networkSpeed = useNetworkSpeed()
  return (
    <div className="nz-card nz-overview-card tone-purple nz-network-card">
      <p>网络</p>
      <section className="nz-network-total"><span className="up">↑{bytes(up, false)}</span><span className="down">↓{bytes(down, false)}</span></section>
      <section className="nz-network-speed"><span><ArrowUp size={11} />{networkSpeed(upSpeed)}</span><span><ArrowDown size={11} />{networkSpeed(downSpeed)}</span></section>
    </div>
  )
}

// 网速沿用站点设置的单位（如「36.9 Mbps」），数字照常、单位缩小，窄列里放得下
function SpeedValue({ text }: { text: string }) {
  const match = /^([\d.,]+)\s*(.+)$/.exec(text)
  return match ? <>{match[1]}<small className="nz-unit">{match[2]}</small></> : <>{text}</>
}

function UsageBar({ value }: { value: number }) {
  return <span className="nz-usage"><i className={usageTone(value)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></span>
}

function Flag({ server }: { server: ProbeServer }) {
  const name = server.name || ''
  const flag = hasLeadingFlag(name) ? '' : regionFlag(probeRegion(server))
  return <span className="nz-flag">{flag ? <Twemoji>{flag}</Twemoji> : null}</span>
}

function Billing({ server }: { server: ProbeServer }) {
  const info = billingInfo(server)
  if (!info) return null
  return (
    <div className="nz-billing">
      {info.price && <p>价格：{info.price}</p>}
      {info.permanent ? <p>剩余：永久</p> : info.days !== undefined && (info.expired ? <p className="is-expired">已过期：{-info.days} 天</p> : <p>剩余：{info.days} 天</p>)}
      {!info.permanent && !info.expired && info.remainPct !== undefined && <span className="nz-remain"><i className={info.remainPct < 30 ? 'bad' : info.remainPct < 70 ? 'warn' : 'ok'} style={{ width: `${info.remainPct}%` }} /></span>}
    </div>
  )
}

// 哪吒前台的 PlanInfo：流量额度（绿）与三网回程（蓝）两种标签
function Plan({ server }: { server: ProbeServer }) {
  const routes = (server.return_routes || []).filter((route) => route.route_type && !/unknown/i.test(route.route_type))
  const carriers = routes.map((route) => `${routeCarrierLabels[route.carrier as keyof typeof routeCarrierLabels] || route.carrier} ${displayReturnRoute(route.route_type || '')}`)
  if (!server.traffic_limit && !carriers.length) return null
  return (
    <section className="nz-plan">
      {!!server.traffic_limit && <span className="green">{bytes(server.traffic_limit, false)}</span>}
      {!!carriers.length && <span className="blue">{carriers.join('｜')}</span>}
    </section>
  )
}

function useDetailLink(index: number) {
  const open = () => { location.hash = `#/server/${index}` }
  return {
    onClick: open,
    onKeyDown: (event: React.KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open() } },
    role: 'button' as const,
    tabIndex: 0,
  }
}

const NezhaCard = memo(function NezhaCard({ server, index }: { server: ProbeServer; index: number }) {
  const networkSpeed = useNetworkSpeed()
  const link = useDetailLink(index)
  const name = server.name || `服务器 ${index + 1}`
  if (!server.online) {
    return (
      <article className="nz-card nz-server is-offline" {...link} aria-label={`${name}（离线），查看详情`}>
        <section className="nz-server-name"><i className="nz-dot red" /><Flag server={server} /><div><p><Twemoji>{name}</Twemoji></p><Billing server={server} /></div></section>
        <Plan server={server} />
      </article>
    )
  }
  const metrics: Array<{ label: string; value: React.ReactNode; bar?: number }> = [
    { label: 'CPU', value: `${cpuPct(server).toFixed(2)}%`, bar: cpuPct(server) },
    { label: '内存', value: `${memPct(server).toFixed(2)}%`, bar: memPct(server) },
    { label: '存储', value: `${diskPct(server).toFixed(2)}%`, bar: diskPct(server) },
    { label: '上传', value: <SpeedValue text={networkSpeed(server.upload_speed)} /> },
    { label: '下载', value: <SpeedValue text={networkSpeed(server.download_speed)} /> },
  ]
  return (
    <article className="nz-card nz-server" {...link} aria-label={`${name}，查看详情`}>
      <section className="nz-server-name"><i className="nz-dot green" /><Flag server={server} /><div><p><Twemoji>{name}</Twemoji></p><Billing server={server} /></div></section>
      <div className="nz-server-body">
        <section className="nz-metrics">
          {metrics.map((item) => <div key={item.label}><p>{item.label}</p><strong>{item.value}</strong>{item.bar !== undefined && <UsageBar value={item.bar} />}</div>)}
        </section>
        <section className="nz-transfer">
          <span className="secondary" title="本期上行流量">上传：{bytes(totalUp(server), false)}</span>
          <span className="outline" title="本期下行流量">下载：{bytes(totalDown(server), false)}</span>
        </section>
        <Plan server={server} />
      </div>
    </article>
  )
})

const NezhaInlineCard = memo(function NezhaInlineCard({ server, index }: { server: ProbeServer; index: number }) {
  const networkSpeed = useNetworkSpeed()
  const link = useDetailLink(index)
  const name = server.name || `服务器 ${index + 1}`
  const head = <section className="nz-server-name"><i className={server.online ? 'nz-dot green' : 'nz-dot red'} /><Flag server={server} /><div><p><Twemoji>{name}</Twemoji></p><Billing server={server} /></div></section>
  if (!server.online) return <article className="nz-card nz-inline is-offline" {...link} aria-label={`${name}（离线），查看详情`}>{head}</article>
  const columns: Array<{ label: string; value: React.ReactNode; bar?: number; icon?: boolean }> = [
    { label: '系统', value: osShortName(server.os), icon: true },
    { label: '在线', value: uptimeLabel(server.uptime) },
    { label: 'CPU', value: `${cpuPct(server).toFixed(2)}%`, bar: cpuPct(server) },
    { label: '内存', value: `${memPct(server).toFixed(2)}%`, bar: memPct(server) },
    { label: '存储', value: `${diskPct(server).toFixed(2)}%`, bar: diskPct(server) },
    { label: '上传', value: <SpeedValue text={networkSpeed(server.upload_speed)} /> },
    { label: '下载', value: <SpeedValue text={networkSpeed(server.download_speed)} /> },
    { label: '上传总量', value: bytes(totalUp(server), false) },
    { label: '下载总量', value: bytes(totalDown(server), false) },
  ]
  return (
    <article className="nz-card nz-inline" {...link} aria-label={`${name}，查看详情`}>
      {head}
      <i className="nz-inline-separator" aria-hidden="true" />
      <section className="nz-inline-metrics">
        {columns.map((item) => (
          <div key={item.label} className={item.icon ? 'has-icon' : undefined}>
            {item.icon && <span className="nz-os-icon"><SystemIcon server={server} /></span>}
            <span><p>{item.label}</p><strong>{item.value}</strong>{item.bar !== undefined && <UsageBar value={item.bar} />}</span>
          </div>
        ))}
      </section>
    </article>
  )
})
