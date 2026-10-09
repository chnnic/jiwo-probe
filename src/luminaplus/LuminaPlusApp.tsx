import { memo, useMemo, useState } from 'react'
import { Droplet, Globe2, Grid3X3, LayoutGrid, Leaf, List, Moon, Network, Rows3, ScrollText, Search, Sun } from 'lucide-react'
import type { ProbePayload, ThemeName } from '../types'
import { ThemeSelect } from '../ThemePicker'
import { PasskeyLogin } from '../PasskeyLogin'
import { followControllerLuminaPlusAppearance, getThemeOverride, setLuminaPlusAppearance } from '../use-probe'
import { LUMINAPLUS_MODE_NAMES, LUMINAPLUS_PALETTE_NAMES, nextLuminaPlusPalette, type LuminaPlusMode, type LuminaPlusPalette } from './luminaplus-color'
import { isExpiring, miniSummary, selectServers, providerName, type MiniStatus, type MiniSort } from '../mini/mini-model'
import LuminaPlusCard from './LuminaPlusCard'
import { parseLuminaPlusView, regionKey, type LuminaPlusView, type SpeedTrail } from './luminaplus-model'
import LuminaPlusOverview from './LuminaPlusOverview'
import { useLuminaPlusSnapshot } from './use-luminaplus-snapshot'
import { LuminaPlusLicenseFooter } from './LuminaPlusLicenseFooter'
import { ForwardOverview } from '../deferred'
import './luminaplus.css'

const sorts: Record<MiniSort, string> = { default: '默认排序', name: '名称 A–Z', cpu: 'CPU 占用 ↓', memory: '内存占用 ↓', traffic: '已用流量 ↓', latency: '延迟最低', expiry: '到期最近' }

export default function LuminaPlusApp({ data, error, onThemeChange }: { data: ProbePayload; error?: string; onThemeChange: (name: ThemeName | null) => void }) {
  const snapshot = useLuminaPlusSnapshot(data)
  return <LuminaPlusHome data={snapshot.data} trails={snapshot.trails} error={error} onThemeChange={onThemeChange} />
}

const LuminaPlusHome = memo(function LuminaPlusHome({ data, trails, error, onThemeChange }: { data: ProbePayload; trails: SpeedTrail[]; error?: string; onThemeChange: (name: ThemeName | null) => void }) {
  const servers = data.servers || []
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<MiniStatus>('all')
  const [provider, setProvider] = useState('')
  const [region, setRegion] = useState('')
  const [sort, setSort] = useState<MiniSort>('default')
  const [view, setView] = useState<LuminaPlusView>(() => { try { return parseLuminaPlusView(localStorage.getItem('jiwo-luminaplus-view')) } catch { return 'large' } })
  const changeView = (next: LuminaPlusView) => { setView(next); try { localStorage.setItem('jiwo-luminaplus-view', next) } catch { /* Private mode still works for this session. */ } }
  const [, setColorRevision] = useState(0)
  const root = document.documentElement
  // 配色与明暗各一个按钮，互不影响
  const palette: LuminaPlusPalette = root.classList.contains('lp-paper') ? 'paper' : root.classList.contains('lp-mint') ? 'mint' : 'classic'
  const mode: LuminaPlusMode = root.classList.contains('dark') || root.classList.contains('gold') ? 'dark' : 'light'
  const nextPalette = nextLuminaPlusPalette(palette)
  const nextMode: LuminaPlusMode = mode === 'dark' ? 'light' : 'dark'
  const PaletteIcon = palette === 'paper' ? ScrollText : palette === 'mint' ? Leaf : Droplet
  const ModeIcon = mode === 'dark' ? Moon : Sun
  const changeAppearance = (next: { palette: LuminaPlusPalette; mode: LuminaPlusMode }) => { setLuminaPlusAppearance(next); setColorRevision(value => value + 1) }
  const visible = useMemo(() => selectServers(servers, { query, status, provider, sort }).filter(({ server }) => !region || regionKey(server) === region), [servers, query, status, provider, sort, region])
  const regions = useMemo(() => [...servers.reduce((counts, server) => { const key = regionKey(server); counts.set(key, (counts.get(key) || 0) + 1); return counts }, new Map<string, number>())].sort((a, b) => b[1] - a[1]), [servers])
  const summary = useMemo(() => miniSummary(servers), [servers])
  const providers = useMemo(() => [...new Set(servers.map(providerName))].sort((a, b) => a.localeCompare(b, 'zh-CN')), [servers])
  const filters: { key: MiniStatus; label: string; count: number }[] = [
    { key: 'all', label: '全部', count: servers.length }, { key: 'online', label: '在线', count: summary.online },
    { key: 'offline', label: '离线', count: servers.length - summary.online }, { key: 'expiring', label: '临期', count: servers.filter(server => isExpiring(server)).length },
  ]
  return <div className="lp-app" data-view={view}>
    <header className="lp-header"><div className="lp-header-inner"><a href="#" className="lp-brand" aria-label="返回首页"><span className="lp-brand-mark">{data.logo ? <img src={data.logo} alt="" /> : <Network size={23} />}</span><span><h1 title={data.title?.trim() || '服务器状态'}>{data.title?.trim() || '服务器状态'}</h1><small>集群实时探针</small></span></a>
      <nav aria-label="外观与登录"><PasskeyLogin buttonClassName="lp-icon-button" /><ThemeSelect value={getThemeOverride()} onChange={name => { if (name === null) followControllerLuminaPlusAppearance(); onThemeChange(name) }} />
        <button className="lp-icon-button" type="button" aria-label={`切换至 ${LUMINAPLUS_PALETTE_NAMES[nextPalette]} 配色`} title={`配色：${LUMINAPLUS_PALETTE_NAMES[palette]}；点击切换至 ${LUMINAPLUS_PALETTE_NAMES[nextPalette]}`} onClick={() => changeAppearance({ palette: nextPalette, mode })}><PaletteIcon size={18} aria-hidden="true" /></button>
        <button className="lp-icon-button" type="button" aria-label={`切换至${LUMINAPLUS_MODE_NAMES[nextMode]}模式`} title={`当前${LUMINAPLUS_MODE_NAMES[mode]}；点击切换至${LUMINAPLUS_MODE_NAMES[nextMode]}`} onClick={() => changeAppearance({ palette, mode: nextMode })}><ModeIcon size={18} aria-hidden="true" /></button>
      </nav>
    </div></header>
    <main className="lp-main">
      <LuminaPlusOverview servers={servers} />
      <ForwardOverview data={data} />
      <div className="lp-section-title"><h2>所有节点 <small>{visible.length} / {servers.length}</small></h2><span role="status" className={error ? 'has-error' : ''}><i />{error ? '连接中断，显示最近数据' : '数据已同步'}</span></div>
      <section className="lp-toolbar" aria-label="节点筛选"><label className="lp-search"><Search size={16} /><input type="search" aria-label="搜索节点" placeholder="搜索名称、地区、服务商…" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <div className="lp-filter" aria-label="节点状态">{filters.map(item => <button key={item.key} type="button" aria-pressed={status === item.key} onClick={() => setStatus(item.key)}>{item.label}<small>{item.count}</small></button>)}</div>
        <select aria-label="筛选服务商" value={provider} onChange={event => setProvider(event.target.value)}><option value="">全部服务商</option>{providers.map(item => <option key={item} value={item}>{item}</option>)}{provider && !providers.includes(provider) && <option value={provider}>{provider}（暂无节点）</option>}</select>
        <select aria-label="节点排序" value={sort} onChange={event => setSort(event.target.value as MiniSort)}>{Object.entries(sorts).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <div className="lp-filter lp-view-picker" role="group" aria-label="显示模式">{([{ key: 'large', label: '大卡片', Icon: LayoutGrid }, { key: 'compact', label: '小卡片', Icon: Rows3 }, { key: 'mini', label: '迷你卡片', Icon: Grid3X3 }, { key: 'list', label: '列表', Icon: List }] as const).map(item => <button key={item.key} type="button" aria-label={`${item.label}视图`} aria-pressed={view === item.key} title={`${item.label}视图`} onClick={() => changeView(item.key)}><item.Icon size={17} aria-hidden="true" /></button>)}</div>
      </section>
      <div className="lp-region-filter" role="group" aria-label="地区筛选"><Globe2 size={15} /><button type="button" aria-pressed={!region} onClick={() => setRegion('')}>全部地区 <small>{servers.length}</small></button>{regions.map(([name, count]) => <button key={name} type="button" aria-pressed={region === name} onClick={() => setRegion(region === name ? '' : name)}>{name}<small>{count}</small></button>)}</div>
      <section className={`lp-nodes lp-view-${view}`} aria-label="节点列表">{visible.map(({ server, index }) => <LuminaPlusCard key={index} server={server} index={index} view={view} trail={trails[index]} />)}{!visible.length && <div className="lp-empty"><Search size={26} /><h3>{servers.length ? '没有匹配的节点' : '暂无服务器数据'}</h3><p>{servers.length ? '换个关键词，或清除筛选条件。' : '等待主控上报。'}</p>{!!servers.length && <button type="button" onClick={() => { setQuery(''); setStatus('all'); setProvider(''); setRegion('') }}>清除筛选</button>}</div>}</section>
      <footer className="lp-footer"><span>Powered by <a href="https://github.com/chnnic/jiwo-probe" target="_blank" rel="noreferrer">Jiwo Probe</a></span><a href="https://github.com/shanyang242/Komari-Theme-LuminaPlus" target="_blank" rel="noreferrer">Design inspired by LuminaPlus</a></footer>
    </main>
    <LuminaPlusLicenseFooter badges={data.license_badge} />
  </div>
})
