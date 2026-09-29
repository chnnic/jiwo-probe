import { ArrowDown, ArrowUp, ChevronRight, Database, Gauge, X } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { ProbeServer } from '../types'
import { useNetworkSpeed } from '../use-network-speed'
import { bytes } from '../App'
import { trafficRuleLabel, trafficUsageLabel } from '../traffic-display'
import { rankLiveSpeeds, rankPeriodTraffic, speedTone, type LiveSpeedSort } from './luminaplus-model'
import { trafficPopoverPosition } from './luminaplus-traffic'

export function LuminaPlusRanking({ servers, metric, children }: { servers: ProbeServer[]; metric: 'speed' | 'traffic'; children: ReactNode }) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const anchorPosition = useRef({ top: 0, left: 0 })
  const focusOnOpen = useRef(false)
  const [open, setOpen] = useState(false)
  const [sort, setSort] = useState<LiveSpeedSort>('total')
  const [position, setPosition] = useState({ top: 12, left: 12 })
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [order, setOrder] = useState<number[]>([])
  const formatSpeed = useNetworkSpeed()
  const isTraffic = metric === 'traffic'
  const title = isTraffic ? '周期流量排行榜' : '实时速度排行榜'
  const Icon = isTraffic ? Database : Gauge
  const sorts = [{ key: 'total', label: isTraffic ? '计费用量' : '合计' }, { key: 'upload', label: '上行' }, { key: 'download', label: '下行' }] as const
  const rankServers = isTraffic ? rankPeriodTraffic : rankLiveSpeeds
  const format = (value?: number) => value === undefined ? '—' : isTraffic ? bytes(value) : formatSpeed(value)
  const ranked = open ? rankServers(servers, sort) : []
  const holdOrder = hovered || focused
  const byIndex = new Map(ranked.map(row => [row.index, row]))
  const rows = holdOrder ? order.flatMap(index => { const row = byIndex.get(index); return row ? [row] : [] }) : ranked
  const top = Math.max(1, ...ranked.map(row => row.value))
  const close = (restoreFocus = false) => { setOpen(false); if (restoreFocus) trigger.current?.focus({ preventScroll: true }) }

  useEffect(() => {
    if (open && !holdOrder) setOrder(rankServers(servers, sort).map(row => row.index))
  }, [open, servers, sort, holdOrder, rankServers])

  useLayoutEffect(() => {
    if (!open || !panel.current || !trigger.current) return
    const anchor = trigger.current.getBoundingClientRect(), rect = panel.current.getBoundingClientRect()
    anchorPosition.current = { top: anchor.top, left: anchor.left }
    setPosition(trafficPopoverPosition(anchor, rect.width, rect.height, innerWidth, innerHeight))
    setHovered(false); setFocused(false)
    window.dispatchEvent(new CustomEvent('lp-traffic-open', { detail: id }))
    if (focusOnOpen.current) { panel.current.focus({ preventScroll: true }); focusOnOpen.current = false }
  }, [open, id])

  useEffect(() => {
    if (!open) return
    const inside = (target: EventTarget | null) => target instanceof Node && (panel.current?.contains(target) || trigger.current?.contains(target))
    const outside = (event: Event) => { if (!inside(event.target)) close() }
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close(true) } }
    const scroll = (event: Event) => {
      if (inside(event.target)) return
      const rect = trigger.current?.getBoundingClientRect()
      if (!rect || Math.abs(rect.top - anchorPosition.current.top) > 1 || Math.abs(rect.left - anchorPosition.current.left) > 1) close()
    }
    const resize = () => close()
    const another = (event: Event) => { if ((event as CustomEvent<string>).detail !== id) close() }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', outside)
    document.addEventListener('keydown', keydown)
    window.addEventListener('scroll', scroll, true)
    window.addEventListener('resize', resize)
    window.addEventListener('lp-traffic-open', another)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('focusin', outside)
      document.removeEventListener('keydown', keydown)
      window.removeEventListener('scroll', scroll, true)
      window.removeEventListener('resize', resize)
      window.removeEventListener('lp-traffic-open', another)
    }
  }, [open, id])

  return <article className="lp-overview-card lp-overview-bandwidth">
    {children}
    <button ref={trigger} type="button" className="lp-speed-ranking-trigger" aria-label={`查看${title}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} onClick={event => { focusOnOpen.current = event.detail === 0; setOpen(value => !value) }} />
    {open && createPortal(<div ref={panel} id={id} className={`lp-traffic-popover lp-speed-ranking${isTraffic ? ' lp-period-ranking' : ''}`} role="dialog" aria-label={title} tabIndex={-1} style={position}>
      <header className="lp-traffic-heading"><div><h2><Icon size={17} />{title}</h2><span>{isTraffic ? '各节点当前计费周期 · 点击进入详情' : '在线服务器 · 点击名称进入详情'}</span></div><button type="button" aria-label={`关闭${title}`} onClick={() => close(true)}><X size={16} /></button></header>
      <div className="lp-ranking-sort" role="group" aria-label={isTraffic ? '周期流量排序' : '网速排序'}>{sorts.map(item => <button type="button" key={item.key} aria-pressed={sort === item.key} onClick={() => { setSort(item.key); setOrder(rankServers(servers, item.key).map(row => row.index)) }}>{item.label}</button>)}</div>
      <ol className="lp-ranking-list" aria-label={isTraffic ? '周期流量排名' : '实时网速排名'} onPointerEnter={event => { if (event.pointerType === 'mouse') setHovered(true) }} onPointerLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
        {rows.map((row, rank) => <li key={row.index}><a href={`#/server/${row.index}`} aria-label={`查看 ${row.server.name || `服务器 ${row.index + 1}`} 详情`} onClick={() => close()}>
          <span className="lp-ranking-number" data-top={rank < 3}>{rank + 1}</span>
          <div className="lp-ranking-node"><div><strong title={row.server.name}>{row.server.name || `服务器 ${row.index + 1}`}</strong><b className={isTraffic ? 'lp-period-ranking-value' : 'lp-speed-tone'} data-tone={isTraffic ? undefined : speedTone(row.value)}>{format(row.value)}</b></div>
            <div className="lp-ranking-directions"><span><ArrowUp size={12} />{format(row.upload)}</span><span><ArrowDown size={12} />{format(row.download)}</span></div>
            {isTraffic && <p className="lp-ranking-period" title={`${row.server.period_start || '未知'} ～ ${row.server.period_end || '未知'} · ${trafficUsageLabel(row.server)} · ${trafficRuleLabel(row.server)}`}>
              {!row.server.online && <span>离线 · </span>}{row.server.period_start && row.server.period_end ? `${row.server.period_start.slice(5, 10)}–${row.server.period_end.slice(5, 10)}` : '周期未提供'} · {trafficRuleLabel(row.server)}
            </p>}
            <div className="lp-ranking-meter" aria-hidden="true"><i style={{ width: `${row.value / top * 100}%` }} /></div>
          </div><ChevronRight size={14} aria-hidden="true" />
        </a></li>)}
        {!rows.length && <li className="lp-ranking-empty">{isTraffic ? '暂无已上报的周期流量数据' : `暂无在线服务器的${sorts.find(item => item.key === sort)?.label}速度数据`}</li>}
      </ol>
      <p className="lp-traffic-note">{ranked.length} 台已上报 · {sort === 'total' ? isTraffic ? '主控计费用量' : '上行 + 下行' : sort === 'upload' ? '上行' : '下行'}降序{holdOrder ? ' · 操作时顺序保持不动' : isTraffic ? ' · 各节点周期可能不同' : ' · 随快照更新'}</p>
    </div>, document.body)}
  </article>
}
