import { ArrowDown, ArrowUp, ChartNoAxesCombined, X } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ProbeServer } from '../types'
import { bytes } from '../server-format'
import { trafficPopoverPosition, trafficWeek } from './luminaplus-traffic'

const size = (value?: number) => value === undefined ? '—' : bytes(value)

export function LuminaPlusTrafficPopover({ server, name }: { server: ProbeServer; name: string }) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const anchorPosition = useRef({ top: 0, left: 0 })
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const keyboardOpen = useRef(false)
  const [mode, setMode] = useState<'hover' | 'pinned' | null>(null)
  const [position, setPosition] = useState({ left: 12, top: 12 })
  const [selected, setSelected] = useState(6)
  const open = mode !== null
  const week = trafficWeek(server)
  const day = week.days[selected]
  const maximum = Math.max(1, ...week.days.map(item => item.total ?? 0))
  const reported = week.days.filter(item => item.total !== undefined).length
  const cancelLeave = () => { clearTimeout(leaveTimer.current); leaveTimer.current = undefined }
  const close = (restoreFocus = false) => {
    cancelLeave()
    setMode(null)
    if (restoreFocus) trigger.current?.focus({ preventScroll: true })
  }
  const leave = () => {
    cancelLeave()
    if (mode === 'hover') leaveTimer.current = setTimeout(() => setMode(null), 180)
  }

  useLayoutEffect(() => {
    if (!open || !trigger.current || !panel.current) return
    const rect = panel.current.getBoundingClientRect()
    const anchor = trigger.current.getBoundingClientRect()
    anchorPosition.current = { top: anchor.top, left: anchor.left }
    setPosition(trafficPopoverPosition(anchor, rect.width, rect.height, window.innerWidth, window.innerHeight))
    setSelected(6)
    window.dispatchEvent(new CustomEvent('lp-traffic-open', { detail: id }))
    if (keyboardOpen.current) { panel.current.focus({ preventScroll: true }); keyboardOpen.current = false }
  }, [open, id])

  useEffect(() => {
    if (!open) return
    const inside = (target: EventTarget | null) => target instanceof Node && (panel.current?.contains(target) || trigger.current?.contains(target))
    const outside = (event: Event) => { if (!inside(event.target)) close() }
    const scroll = (event: Event) => {
      if (inside(event.target)) return
      const rect = trigger.current?.getBoundingClientRect()
      // A queued scroll event from focusing the trigger must not close a just-opened panel.
      if (!rect || Math.abs(rect.top - anchorPosition.current.top) > 1 || Math.abs(rect.left - anchorPosition.current.left) > 1) close()
    }
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close(true) } }
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
      cancelLeave()
    }
  }, [open, id])
  useEffect(() => () => cancelLeave(), [])

  return <>
    <button ref={trigger} type="button" className="lp-icon-button lp-traffic-trigger" aria-label={`查看 ${name} 今日与七日流量`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
      onPointerEnter={event => { if (event.pointerType === 'mouse') { cancelLeave(); setMode(current => current || 'hover') } }} onPointerLeave={leave}
      onClick={event => {
        cancelLeave()
        keyboardOpen.current = event.detail === 0
        if (mode === 'hover' && keyboardOpen.current) { panel.current?.focus({ preventScroll: true }); keyboardOpen.current = false }
        setMode(current => current === 'pinned' ? null : 'pinned')
      }}>
      <ChartNoAxesCombined size={17} aria-hidden="true" />
    </button>
    {open && createPortal(<div ref={panel} id={id} className="lp-traffic-popover" role="dialog" aria-label={`${name} 流量统计`} tabIndex={-1} style={position} onPointerEnter={cancelLeave} onPointerLeave={leave}>
      <header className="lp-traffic-heading"><div><h2>今日流量</h2><span title={name}>{name}</span></div><button type="button" aria-label="关闭流量小窗" onClick={() => close(true)}><X size={16} /></button></header>
      <div className="lp-traffic-today"><strong>{size(week.today.total)}</strong><time dateTime={week.today.date}>{week.today.date}</time></div>
      <div className="lp-traffic-directions"><span><ArrowUp size={15} />上行 <b>{size(week.today.upload)}</b></span><span><ArrowDown size={15} />下行 <b>{size(week.today.download)}</b></span></div>
      <section className="lp-traffic-week" aria-label="近七日流量统计"><div className="lp-traffic-week-heading"><h3>近七日流量</h3><small>{reported === 7 ? '每日总量' : `已上报 ${reported}/7 天`}</small></div>
        <div className="lp-traffic-bars" role="group" aria-label="选择日期查看每日流量">{week.days.map((item, index) => <button type="button" key={item.date} aria-label={`${item.date}：${item.total === undefined ? '未上报' : size(item.total)}`} aria-pressed={selected === index} onPointerEnter={event => { if (event.pointerType === 'mouse') setSelected(index) }} onFocus={() => setSelected(index)} onClick={() => setSelected(index)}>
          <span className="lp-traffic-bar-track" aria-hidden="true"><i data-missing={item.total === undefined} data-zero={item.total === 0} style={{ height: item.total === undefined ? '0%' : `${item.total / maximum * 100}%` }} />{item.total === undefined && <em>—</em>}</span>
          <span>{index === 6 ? '今天' : item.date.slice(5).replace('-', '/')}</span>
        </button>)}</div>
        <div className="lp-traffic-day" aria-live="polite"><div><time dateTime={day.date}>{day.date.slice(5).replace('-', '/')}</time><strong>{day.total === undefined ? '未上报' : size(day.total)}</strong></div><span><ArrowUp size={12} />{size(day.upload)}<ArrowDown size={12} />{size(day.download)}</span></div>
      </section>
      <p className="lp-traffic-note">{week.utc ? 'UTC 日期' : '本地日期'} · {week.estimated ? '根据累计流量估算' : '主控日流量'} · 缺失不补零</p>
    </div>, document.body)}
  </>
}
