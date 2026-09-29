import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { ProbeServer } from '../types'
import { bytes, hasLeadingFlag, regionFlag, regionLabel, TrafficChart } from '../App'
import { UnlockPanel } from '../ServerCapabilities'
import { ConnectionLabel } from '../ConnectionLabel'
import { connectionCount } from '../unlocks'
import { useNetworkSpeed } from '../use-network-speed'
import { computeMonthlyTrafficCost, computeRemainingValue, formatMoney } from '../value'
import { serverHealth } from '../PremiumProbePage'
import { Twemoji } from '../Twemoji'
import { averageLatency, ratio, validNumber } from './mini-model'
import { MiniLatencyTrends, MiniSystemTrends } from './MiniTrends'

const tabs = [
  { key: 'overview', label: '概览' }, { key: 'latency', label: '延迟' },
  { key: 'system', label: '系统' }, { key: 'traffic', label: '流量' }, { key: 'routes', label: '回程' },
  { key: 'unlocks', label: '解锁' },
] as const
type DetailTab = typeof tabs[number]['key']
const size = (value?: number) => validNumber(value) === undefined ? '—' : bytes(value)
const percent = (value?: number) => value === undefined ? '—' : `${value.toFixed(1)}%`
function duration(value?: number) {
  if (validNumber(value) === undefined) return '未上报'
  return `${Math.floor(value! / 86400)}天${Math.floor(value! % 86400 / 3600)}时`
}
function InfoRows({ rows }: { rows: [string, ReactNode][] }) {
  return <dl className="mini-detail-rows">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
}

export default function MiniServerDetail({ server, index, onClose, showHealthScore = false }: { server: ProbeServer; index: number; onClose: () => void; showHealthScore?: boolean }) {
  const [tab, setTab] = useState<DetailTab>('overview')
  const dialog = useRef<HTMLElement>(null)
  const id = useId()
  const formatSpeed = useNetworkSpeed()
  const name = server.name || `服务器 ${index + 1}`
  const flag = regionFlag(server.region || server.region_country)
  const latency = averageLatency(server)
  const period = server.period_start && server.period_end ? `${server.period_start} ～ ${server.period_end}` : '未设置'
  const quota = server.traffic_limit === 0 ? '不限' : size(server.traffic_limit)
  const monthly = computeMonthlyTrafficCost(server)
  const remaining = computeRemainingValue(server)
  const cycles = { month: '月', quarter: '季', half_year: '半年', year: '年' }
  const originalCurrency = server.renewal_currency || 'CNY'
  const renewal = validNumber(server.renewal_price_cny) !== undefined
    ? `${formatMoney(server.renewal_price_cny!, 'CNY', true, true)} / ${cycles[server.renewal_cycle || 'month']}${server.renewal_price !== undefined && originalCurrency !== 'CNY' ? `（${originalCurrency} ${server.renewal_price}）` : ''}`
    : validNumber(server.renewal_price) !== undefined ? `${formatMoney(server.renewal_price!, originalCurrency, originalCurrency === 'CNY', true)} / ${cycles[server.renewal_cycle || 'month']}` : '续费 —'
  const speed = (value?: number) => validNumber(value) === undefined ? '—' : formatSpeed(value!)
  const system = [server.os, server.kernel, server.arch].filter(Boolean).join(' · ') || '未上报'
  const processor = [server.cpu_model, server.cpu_cores !== undefined ? `${server.cpu_cores}核` : '', server.cpu_threads !== undefined ? `${server.cpu_threads}线程` : ''].filter(Boolean).join(' · ') || '未上报'
  const total = server.traffic_used_total ?? (server.cumulative_up !== undefined && server.cumulative_down !== undefined ? server.cumulative_up + server.cumulative_down : undefined)
  const networkRows: [string, ReactNode][] = [
    ['实时 下行 / 上行', `${speed(server.download_speed)} / ${speed(server.upload_speed)}`],
    ['连接数', <span className="mini-detail-connections"><span><ConnectionLabel protocol="TCP" />{connectionCount(server.tcp_connections)}</span><span><ConnectionLabel protocol="UDP" />{connectionCount(server.udp_connections)}</span></span>],
  ]
  const trafficRows: [string, ReactNode][] = [
    ['计费周期', period], ['周期流量', `${size(server.traffic_used)} / ${quota}`],
    ['周期 上行 / 下行', `${size(server.traffic_used_up)} / ${size(server.traffic_used_down)}`],
    ['网卡累计 上 / 下', `${size(server.cumulative_up)} / ${size(server.cumulative_down)}`],
    ['累计总流量', size(total)], ['到期时间', server.expires_at || '未设置'],
    ['续费价格', renewal],
    ['每月每 TB 费用', monthly ? `${monthly.perTB > 0 && monthly.perTB < .01 ? '< ' : ''}${formatMoney(monthly.perTB > 0 && monthly.perTB < .01 ? .01 : monthly.perTB, monthly.currency, monthly.isCny, true)} / TB / 月（${monthly.currency}）` : '无法计算'],
    ...(remaining ? [['剩余价值（估算）', formatMoney(remaining.value, remaining.currency, remaining.isCny)] as [string, ReactNode]] : []),
  ]

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.querySelector<HTMLButtonElement>('.mini-detail-close')?.focus({ preventScroll: true })
    return () => { document.body.style.overflow = overflow; previousFocus?.focus({ preventScroll: true }) }
  }, [])

  return createPortal(<div className="server-detail-backdrop mini-detail-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="server-detail mini-detail-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
      if (event.key !== 'Tab') return
      const elements = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], select, [tabindex="0"]')].filter(element => !element.closest('[inert]') && element.getClientRects().length)
      const first = elements[0], last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }}>
      <header className="mini-detail-header">
        <div className="mini-detail-heading"><i className={`mini-status-dot${server.online ? '' : ' is-offline'}`} /><h2 id={`${id}-title`} title={name}><Twemoji>{flag && !hasLeadingFlag(name) ? `${flag} ${name}` : name}</Twemoji></h2><button type="button" className="mini-detail-close" aria-label="关闭详情" onClick={onClose}><X size={22} /></button></div>
        <div className="mini-detail-subtitle"><span>{server.provider_name || '未标注服务商'}</span>{regionLabel(server) && <span>{regionLabel(server)}</span>}<span>{server.online ? '在线' : '离线'} · {duration(server.uptime)}</span></div>
      </header>
      <div className="mini-detail-tablist" role="tablist" aria-label="服务器详情项目">
        {tabs.map((item, slot) => <button type="button" key={item.key} role="tab" id={`${id}-tab-${item.key}`} aria-controls={`${id}-panel-${item.key}`} aria-selected={tab === item.key} tabIndex={tab === item.key ? 0 : -1} onClick={() => setTab(item.key)} onKeyDown={event => {
          const next = event.key === 'ArrowRight' ? (slot + 1) % tabs.length : event.key === 'ArrowLeft' ? (slot + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null
          if (next === null) return
          event.preventDefault(); setTab(tabs[next].key)
          event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
        }}>{item.label}</button>)}
      </div>
      <div className="mini-detail-content">
        {/* 同一网格叠放六页，保留自然高度，由内容最多的页决定公共高度。 */}
        {tabs.map(item => <div key={item.key} className="mini-detail-panel" role="tabpanel" id={`${id}-panel-${item.key}`} aria-labelledby={`${id}-tab-${item.key}`} aria-hidden={tab !== item.key} inert={tab !== item.key} tabIndex={tab === item.key ? 0 : -1}>
        {item.key === 'overview' && <>
          <div className="mini-detail-stats">{[
            ['CPU', percent(validNumber(server.cpu_pct))], ['内存', percent(ratio(server.mem_used, server.mem_total))],
            ['硬盘', percent(ratio(server.disk_used, server.disk_total))], ['平均延迟', latency === undefined ? '—' : `${latency.toFixed(0)} ms`],
          ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
          <InfoRows rows={[
            ['状态', server.online ? '在线' : '离线'], ['系统', system], ['CPU', processor], ['负载', server.loadavg || '未上报'],
            ['内存', `${size(server.mem_used)} / ${size(server.mem_total)}`], ['硬盘', `${size(server.disk_used)} / ${size(server.disk_total)}`],
            ...networkRows, ...trafficRows,
            ...(showHealthScore ? [['健康评分', `${serverHealth(server).score} · ${serverHealth(server).label}`] as [string, ReactNode]] : []),
          ]} />
        </>}
        {item.key === 'latency' && <MiniLatencyTrends server={server} index={index} />}
        {item.key === 'system' && <MiniSystemTrends server={server} index={index} />}
        {item.key === 'traffic' && <>
          <InfoRows rows={trafficRows} />
          <h3 className="mini-detail-chart-title">每日流量</h3>
          {server.daily_traffic?.length ? <TrafficChart daily={server.daily_traffic} /> : <p className="mini-detail-empty">暂无每日流量记录。</p>}
        </>}
        {item.key === 'routes' && <>
          <p className="mini-detail-description">三网回程 · 最近一次检测结果</p>
          <div className="mini-detail-routes">{(['telecom', 'unicom', 'mobile'] as const).map(carrier => {
            const route = server.return_routes?.find(item => item.carrier === carrier)
            const detected = route?.route_type?.replace(/^CMIN$/i, 'CMI') || '未检测'
            const routeType = carrier === 'telecom' && server.telecom_paid_peer && detected === '163' ? '163 PP' : detected
            const time = route?.tested_at ? Date.parse(route.tested_at) : NaN
            return <section key={carrier}><span>{({ telecom: '中国电信', unicom: '中国联通', mobile: '中国移动' })[carrier]}</span><strong>{routeType}</strong><small>{route?.region || '地区未上报'}</small><small>{Number.isFinite(time) ? new Date(time).toLocaleString('zh-CN', { hour12: false }) : '检测时间未上报'}</small></section>
          })}</div>
        </>}
        {item.key === 'unlocks' && <UnlockPanel unlocks={server.unlocks} />}
        </div>)}
      </div>
    </section>
  </div>, document.body)
}
