import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Database, LayoutGrid, List, Monitor, Moon, Network, Rows3, Search, Server, Sun } from 'lucide-react'
import type { ProbePayload, ThemeName } from '../types'
import { ThemeSelect, ProbeLicenseFooter } from '../App'
import { PasskeyLogin } from '../PasskeyLogin'
import { getDarkOverride, getThemeOverride, setDarkOverride } from '../use-probe'
import { useNetworkSpeed } from '../use-network-speed'
import { isExpiring, miniSummary, selectServers, providerName, type MiniStatus, type MiniSort } from '../mini/mini-model'
import LuminaPlusCard, { size } from './LuminaPlusCard'
import { parseLuminaPlusView, speedTone, type LuminaPlusView } from './luminaplus-model'
import './luminaplus.css'

const sorts: Record<MiniSort, string> = { default: '默认排序', name: '名称 A–Z', cpu: 'CPU 占用 ↓', memory: '内存占用 ↓', traffic: '已用流量 ↓', latency: '延迟最低', expiry: '到期最近' }

export default function LuminaPlusApp({ data, error, onThemeChange }: { data: ProbePayload; error?: string; onThemeChange: (name: ThemeName | null) => void }) {
  const servers = data.servers || []
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<MiniStatus>('all')
  const [provider, setProvider] = useState('')
  const [sort, setSort] = useState<MiniSort>('default')
  const [view, setView] = useState<LuminaPlusView>(() => { try { return parseLuminaPlusView(localStorage.getItem('jiwo-luminaplus-view')) } catch { return 'card' } })
  const changeView = (next: LuminaPlusView) => { setView(next); try { localStorage.setItem('jiwo-luminaplus-view', next) } catch { /* Private mode still works for this session. */ } }
  const [, setColorRevision] = useState(0)
  const color = getDarkOverride()
  const colorMode = color === 'gold' ? 'dark' : color === 'platinum' ? 'light' : color || 'auto'
  const formatSpeed = useNetworkSpeed()
  const speed = (value?: number) => value === undefined ? '—' : formatSpeed(value)
  const visible = useMemo(() => selectServers(servers, { query, status, provider, sort }), [servers, query, status, provider, sort])
  const summary = useMemo(() => miniSummary(servers), [servers])
  const providers = useMemo(() => [...new Set(servers.map(providerName))].sort((a, b) => a.localeCompare(b, 'zh-CN')), [servers])
  const filters: { key: MiniStatus; label: string; count: number }[] = [
    { key: 'all', label: '全部', count: servers.length }, { key: 'online', label: '在线', count: summary.online },
    { key: 'offline', label: '离线', count: servers.length - summary.online }, { key: 'expiring', label: '临期', count: servers.filter(server => isExpiring(server)).length },
  ]
  return <div className="lp-app">
    <header className="lp-header"><div className="lp-header-inner"><a href="#" className="lp-brand"><span className="lp-brand-mark">{data.logo ? <img src={data.logo} alt="" /> : <Network size={23} />}</span><span><h1>{data.title?.trim() || '服务器状态'}</h1><small>LuminaPlus <b>·</b> 实时服务器监测</small></span></a>
      <nav aria-label="外观与登录"><PasskeyLogin buttonClassName="lp-icon-button" /><ThemeSelect value={getThemeOverride()} onChange={onThemeChange} />
        <div className="lp-filter lp-color-picker" role="group" aria-label="明暗模式">{([{ key: 'auto', label: '自动明暗', Icon: Monitor }, { key: 'light', label: '浅色模式', Icon: Sun }, { key: 'dark', label: '深色模式', Icon: Moon }] as const).map(item => <button key={item.key} type="button" aria-label={item.label} title={item.label} aria-pressed={colorMode === item.key} onClick={() => { setDarkOverride(item.key === 'auto' ? null : item.key); setColorRevision(value => value + 1) }}><item.Icon size={16} aria-hidden="true" /></button>)}</div>
      </nav>
    </div></header>
    <main className="lp-main">
      <section className="lp-summary" aria-label="集群概览">
        <div><span><Server size={16} />在线节点</span><strong>{summary.online}<small>/ {servers.length}</small></strong><p>{servers.length - summary.online} 台离线</p></div>
        <div><span><Database size={16} />已用流量</span><strong>{size(summary.traffic)}</strong><p>按主控计费口径汇总</p></div>
        <div><span><ArrowUp size={16} className="lp-blue" />实时上行</span><strong className="lp-speed-tone" data-tone={speedTone(summary.upload)}>{speed(summary.upload)}</strong><p>周期出站 {size(summary.outbound)}</p></div>
        <div><span><ArrowDown size={16} className="lp-green" />实时下行</span><strong className="lp-speed-tone" data-tone={speedTone(summary.download)}>{speed(summary.download)}</strong><p>周期入站 {size(summary.inbound)}</p></div>
      </section>
      <div className="lp-section-title"><h2>所有节点 <small>{visible.length} / {servers.length}</small></h2><span role="status" className={error ? 'has-error' : ''}><i />{error ? '连接中断，显示最近数据' : '数据已同步'}</span></div>
      <section className="lp-toolbar" aria-label="节点筛选"><label className="lp-search"><Search size={16} /><input type="search" aria-label="搜索节点" placeholder="搜索名称、地区、服务商…" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <div className="lp-filter" aria-label="节点状态">{filters.map(item => <button key={item.key} type="button" aria-pressed={status === item.key} onClick={() => setStatus(item.key)}>{item.label}<small>{item.count}</small></button>)}</div>
        <select aria-label="筛选服务商" value={provider} onChange={event => setProvider(event.target.value)}><option value="">全部服务商</option>{providers.map(item => <option key={item} value={item}>{item}</option>)}{provider && !providers.includes(provider) && <option value={provider}>{provider}（暂无节点）</option>}</select>
        <select aria-label="节点排序" value={sort} onChange={event => setSort(event.target.value as MiniSort)}>{Object.entries(sorts).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <div className="lp-filter lp-view-picker" role="group" aria-label="显示模式">{([{ key: 'card', label: '完整', Icon: LayoutGrid }, { key: 'compact', label: '紧凑', Icon: Rows3 }, { key: 'list', label: '列表', Icon: List }] as const).map(item => <button key={item.key} type="button" aria-label={`${item.label}视图`} aria-pressed={view === item.key} title={`${item.label}视图`} onClick={() => changeView(item.key)}><item.Icon size={17} aria-hidden="true" /></button>)}</div>
      </section>
      <section className={`lp-nodes lp-view-${view}`} aria-label="节点列表">{visible.map(({ server, index }) => <LuminaPlusCard key={index} server={server} index={index} view={view} />)}{!visible.length && <div className="lp-empty"><Search size={26} /><h3>{servers.length ? '没有匹配的节点' : '暂无服务器数据'}</h3><p>{servers.length ? '换个关键词，或清除筛选条件。' : '等待主控上报。'}</p>{!!servers.length && <button type="button" onClick={() => { setQuery(''); setStatus('all'); setProvider('') }}>清除筛选</button>}</div>}</section>
      <footer className="lp-footer"><span>Powered by <a href="https://github.com/chnnic/jiwo-probe" target="_blank" rel="noreferrer">Jiwo Probe</a></span><a href="https://github.com/shanyang242/Komari-Theme-LuminaPlus" target="_blank" rel="noreferrer">Design inspired by LuminaPlus</a></footer>
      <ProbeLicenseFooter badges={data.license_badge} />
    </main>
  </div>
}
