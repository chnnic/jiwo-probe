import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { ProbeServer } from './types'
import { connectionCount } from './unlocks'
import { SystemTrendChart } from './charts/SystemTrendChart'
import { useProbe } from './use-probe'
import { connBucketLabel, connHoverIndex, connSparklineMax, connSparklinePath, normalizeConnHistory } from './conn-sparkline'
import './probe-history.css'

function ConnectionHistoryDialog({ serverIndex, name, close }: { serverIndex: number; name: string; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const title = useId()
  useLayoutEffect(() => {
    const dialog = ref.current!
    const focused = document.activeElement as HTMLElement | null
    dialog.showModal()
    return () => { dialog.close(); focused?.focus({ preventScroll: true }) }
  }, [])
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])
  return createPortal(<dialog ref={ref} className="probe-history-dialog" aria-labelledby={title}
    onCancel={event => { event.preventDefault(); close() }} onKeyDown={event => event.stopPropagation()}
    onMouseDown={event => event.stopPropagation()} onClick={event => {
      event.stopPropagation()
      const rect = event.currentTarget.getBoundingClientRect()
      if (event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) close()
    }}>
    <header><div><h2 id={title}>TCP / UDP 连接数历史</h2><p>{name}</p></div><button type="button" aria-label="关闭连接数历史" onClick={close} autoFocus><X size={18} /></button></header>
    <SystemTrendChart serverIndex={serverIndex} metric="connections" fixedAxis={false} />
  </dialog>, document.body)
}

/** 卡片共用主控快照，不启动请求/采样；只有打开历史弹窗才按需读取 /api/series。 */
export function ConnectionHistory({ server, serverIndex }: { server: ProbeServer; serverIndex: number }) {
  const { connectionChartEnabled } = useProbe()
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  if (connectionChartEnabled !== true) return null
  const history = normalizeConnHistory(server.conn_history)
  if (!history) return null
  const length = history.tcp.length
  const max = connSparklineMax(history)
  const hasSamples = [...history.tcp, ...history.udp].some(value => value !== null)
  const selected = hover === null || !length ? null : Math.min(hover, length - 1)
  const name = server.name || `服务器 ${serverIndex + 1}`
  return <>
    <button type="button" className="probe-conn-history" aria-label={`查看 ${name} 连接数历史`} aria-haspopup="dialog" aria-expanded={open}
      onClick={event => { event.stopPropagation(); setOpen(true) }} onMouseDown={event => event.stopPropagation()}
      onFocus={() => setHover(Math.max(0, length - 1))} onBlur={() => setHover(null)}
      onKeyDown={event => {
        event.stopPropagation()
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault()
          setHover(value => Math.max(0, Math.min(length - 1, (value ?? length - 1) + (event.key === 'ArrowLeft' ? -1 : 1))))
        }
      }}>
      <span className="probe-conn-heading"><span><i className="probe-conn-tcp-dot" />TCP <i className="probe-conn-udp-dot" />UDP</span><span>近 1 小时 <span aria-hidden="true">↗</span></span></span>
      <span className="probe-conn-plot" onPointerMove={event => {
        const rect = event.currentTarget.getBoundingClientRect()
        setHover(connHoverIndex((event.clientX - rect.left) / rect.width, length))
      }} onPointerLeave={() => setHover(null)}>
        <svg viewBox="0 0 120 40" preserveAspectRatio="none" role="img" aria-label="TCP 与 UDP 共用纵轴的连接数折线图">
          <line className="probe-conn-base" x1="0" x2="120" y1="37" y2="37" vectorEffect="non-scaling-stroke" />
          <path className="probe-conn-tcp" d={connSparklinePath(history.tcp, max)} vectorEffect="non-scaling-stroke" />
          <path className="probe-conn-udp" d={connSparklinePath(history.udp, max)} vectorEffect="non-scaling-stroke" />
          {hasSamples && selected !== null && <line className="probe-conn-guide" x1={length <= 1 ? 60 : selected / (length - 1) * 120} x2={length <= 1 ? 60 : selected / (length - 1) * 120} y1="0" y2="40" vectorEffect="non-scaling-stroke" />}
        </svg>
        {!hasSamples && <span className="probe-conn-empty">暂无连接数采样</span>}
        {hasSamples && selected !== null && <span className="probe-conn-tip"><small>{connBucketLabel(selected, length)} · 均值</small>TCP {connectionCount(history.tcp[selected] ?? undefined)} · UDP {connectionCount(history.udp[selected] ?? undefined)}</span>}
      </span>
    </button>
    {open && <ConnectionHistoryDialog serverIndex={serverIndex} name={name} close={() => setOpen(false)} />}
  </>
}
