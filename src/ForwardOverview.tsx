import { Fragment, useMemo, useState, type CSSProperties } from 'react'
import { ChevronDown, Network } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ProbePayload, ProbeServer } from './types'
import { availabilityCells, availabilityPct, chainLiveSpeed, chainTraffic, chainTrafficDay, flowDuration, FORWARD_TRAFFIC_NOTE, formatAvailability, formatJitter, flowLevel, formatGb, forwardSummary, groupHealth, hopTone, latencyTone, mayHaveRouteSelection, routeFork, sortChains, trendCells, type ForwardStatus } from './forward-model'
import { useNetworkSpeed } from './use-network-speed'
import './probe-history.css'

const roles = { entry: '入口', mid: '中转', exit: '出口' }
const STATUS_LABEL: Record<ForwardStatus, string> = { ok: '正常', warn: '偏慢', down: '异常' }
const latency = (value?: number) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? `${Math.round(value)} ms` : '—'
const loss = (value?: number) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? `${value.toFixed(1)}%` : '—'
const time = (value: number) => new Date(value * 1000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
const day = (value: string) => value.slice(5).replace('-', '/')
// 主控按 bucket_sec 汇总一次延迟与丢包（默认 300 秒）；页面每 3 秒刷新，数字只在下一轮探测后变化
const probeInterval = (bucketSec?: number) => `主控每 ${Math.max(1, Math.round((bucketSec || 300) / 60))} 分钟探测一次`
// 放在页首后默认折叠；访客展开或折叠后记在本浏览器
const OPEN_KEY = 'probe-forward-open'
const readOpen = () => { try { return localStorage.getItem(OPEN_KEY) === '1' } catch { return false } }

/**
 * 转发链总览（各主题共用，Premium 有自己的转发页）。沿用主控快照/展示开关，不另开轮询。
 * 与主控转发链列表、主控 CSS 同一口径：顶部汇总正常 / 偏慢 / 异常，问题链路置顶并写明原因，
 * 拓扑的组与连线按状态着色，另展示接口已下发的 7 天流量。判断规则见 forward-model.ts。
 */
export function ForwardOverview({ data }: { data: ProbePayload }) {
  const [selected, setSelected] = useState('')
  // 选中的某一天（按链记录，切换链路时自动回到 7 天汇总）
  const [daySel, setDaySel] = useState<{ chain: string; index: number } | null>(null)
  const [open, setOpen] = useState(readOpen)
  const networkSpeed = useNetworkSpeed()
  // 转发链里的服务器按名称对应快照里的实时上下行（byte/s），每 3 秒随快照刷新
  const liveByName = useMemo(() => new Map((data.servers || []).filter((server) => server.name).map((server) => [server.name as string, server])), [data.servers])
  const liveBytes = (server?: ProbeServer) => server ? (server.upload_speed || 0) + (server.download_speed || 0) : 0
  if (data.show_forward === false || (!data.show_forward && !data.forward?.length)) return null
  const chains = sortChains(data.forward || [])
  const summary = forwardSummary(data.forward || [])
  const current = chains.find((item) => item.chain.name === selected) || chains[0]
  const chain = current?.chain
  const traffic = chain ? chainTraffic(chain) : null
  const fork = chain ? routeFork(chain) : null
  const chainSpeed = chain ? chainLiveSpeed(chain) : null
  const chainAvailability = chain ? availabilityPct(chain) : null
  const jitter = chain ? formatJitter(chain.jitter_ms) : null
  const peak = traffic ? Math.max(...traffic.daily.map((item) => item.gb), 0) : 0
  const dayIndex = chain && daySel?.chain === chain.name ? daySel.index : null
  const dayDetail = chain && dayIndex !== null ? chainTrafficDay(chain, dayIndex) : null
  return <details className="probe-forward" open={open} onToggle={(event) => {
    const next = event.currentTarget.open
    setOpen(next)
    try { localStorage.setItem(OPEN_KEY, next ? '1' : '0') } catch { /* 隐私模式下不记忆 */ }
  }}>
    <summary><Network size={17} /><h2>转发链拓扑与延迟</h2>
      <span className="probe-forward-summary">共 {summary.total} 条<b data-status="ok">正常 {summary.ok}</b><b data-status="warn">偏慢 {summary.warn}</b><b data-status="down">异常 {summary.down}</b></span>
      <ChevronDown size={16} /></summary>
    {!chain || !current ? <p className="probe-forward-empty">暂无转发链数据，等待主控探测上报。</p> : <div className="probe-forward-content">
      <div className="probe-forward-chains" role="group" aria-label="转发链列表（异常与偏慢置顶）">
        {chains.map((item) => {
          const total = chainTraffic(item.chain)?.total
          const availability = availabilityPct(item.chain)
          const speed = chainLiveSpeed(item.chain)
          const dayCells = availabilityCells(item.chain)
          return <button type="button" key={item.chain.name} data-status={item.status} aria-pressed={item === current} onClick={() => setSelected(item.chain.name)} title={item.reasons.join('；') || STATUS_LABEL[item.status]}>
            <span className="probe-forward-chain-name"><i aria-hidden="true" />{item.chain.name}</span>
            <span className="probe-forward-chain-stats"><strong data-tone={latencyTone(item.chain.end_to_end_ms)}>{latency(item.chain.end_to_end_ms)}</strong><span title={probeInterval(item.chain.bucket_sec)}>丢包 {loss(item.chain.loss_pct)}</span>{availability !== null && <span title="近 24 小时可用率">可用 {formatAvailability(availability)}</span>}{total !== undefined && <span title={`流量由${FORWARD_TRAFFIC_NOTE}`}>7 天 {formatGb(total)}</span>}{speed && speed.total > 0 && <span className="probe-forward-chain-speed" title="入口在这条链上的实时下行 / 上行">↓ {networkSpeed(speed.down)} ↑ {networkSpeed(speed.up)}</span>}</span>
            {item.reasons.length > 0 && <small>{item.reasons.join(' · ')}</small>}
            {dayCells ? <span className="probe-forward-cells" data-span="day" aria-label="近 24 小时状态">
              {dayCells.map((cell) => <i key={cell.key} data-tone={cell.tone} title={cell.label} />)}
            </span> : !!item.chain.trend?.length && <span className="probe-forward-cells" aria-label={`近 ${Math.round(item.chain.trend.length * (item.chain.bucket_sec || 300) / 60)} 分钟状态`}>
              {trendCells(item.chain).map((cell) => <i key={cell.ts} data-tone={cell.tone} title={cell.label} />)}
            </span>}
          </button>
        })}
      </div>
      <div className="probe-forward-detail" data-status={current.status}>
        <header><h3><i aria-hidden="true" />{chain.name}<span>{STATUS_LABEL[current.status]}</span></h3>
          <span>端到端 <strong>{latency(chain.end_to_end_ms)}</strong></span>{jitter && <span title="端到端延迟的波动幅度">抖动 <strong>{jitter}</strong></span>}<span>丢包 <strong>{loss(chain.loss_pct)}</strong><small className="probe-forward-interval">（{probeInterval(chain.bucket_sec)}）</small></span>
          {chainAvailability !== null && <span>24 小时可用 <strong>{formatAvailability(chainAvailability)}</strong></span>}
          {chainSpeed && <span title="入口在这条链上的实时下行 / 上行">当前网速 <strong>↓ {networkSpeed(chainSpeed.down)}</strong> <strong>↑ {networkSpeed(chainSpeed.up)}</strong></span>}
          {current.reasons.length > 0 && <p>{current.reasons.join('；')}</p>}
        </header>
        <div className="probe-forward-topology" aria-label={`${chain.name} 转发拓扑`}>
          {chain.groups.map((group, index) => {
            const isFork = fork?.hop === index
            const health = groupHealth(group)
            const groupStatus = !health || health.total === 0 ? undefined : health.healthy === 0 ? 'down' : health.healthy < health.total ? 'warn' : 'ok'
            const tone = hopTone(group)
            // 连线光点：速度按到下一组的延迟，密度按本组服务器的实时流量
            const groupBytes = group.servers.reduce((sum, server) => sum + liveBytes(liveByName.get(server.name)), 0)
            const hopBytes = chainSpeed ? chainSpeed.total : groupBytes
            const flow = tone === 'down' ? 0 : flowLevel(hopBytes)
            return <Fragment key={`${group.name}-${index}`}>
              <section className="probe-forward-group" data-status={groupStatus}>
                <h3><small>{roles[group.role]}</small><span title={group.name}>{group.name}</span>{health && <em>{health.healthy}/{health.total} 可用</em>}</h3>
                <ul>{group.servers.map((server, i) => {
                  const live = liveByName.get(server.name)
                  return <li key={`${server.name}-${i}`}>
                    {group.role !== 'exit' && <i data-healthy={server.healthy} title={server.healthy ? '探测正常' : '探测异常'} />}
                    <span title={server.name}>{server.name}</span>
                    {live && <em className="probe-forward-speed" data-active={flowLevel(liveBytes(live)) > 0 || undefined} title="实时上行 / 下行">
                      <span>↑ {networkSpeed(live.upload_speed)}</span><span>↓ {networkSpeed(live.download_speed)}</span>
                    </em>}
                    {group.role !== 'exit' && <strong data-tone={server.healthy ? latencyTone(server.to_next_ms) : 'down'}>{server.healthy ? latency(server.to_next_ms) : '不可达'}</strong>}
                    {group.role !== 'exit' && typeof server.loss_pct === 'number' && server.loss_pct > 0 && <small className="probe-forward-server-loss" title="本台到下一跳的丢包率">丢包 {loss(server.loss_pct)}</small>}
                    {server.route && <small className="probe-forward-route-tag" title="当前走的路">→ {server.route}</small>}
                  </li>
                })}</ul>
              </section>
              {isFork && fork && <div className="probe-forward-fork" role="group" aria-label="选路段">
                <p>选路段{fork.policy && <> · {fork.policy}</>}</p>
                {fork.routes.map((route) => {
                  const routeBytes = (route.selected_by || []).reduce((sum, name) => sum + liveBytes(liveByName.get(name)), 0)
                  const routeFlow = route.selected && route.tone !== 'down' ? flowLevel(routeBytes) : 0
                  return <div key={route.name} className="probe-forward-route" data-selected={route.selected || undefined}>
                    <div className="probe-forward-route-head">
                      <strong>{route.name}</strong>
                      <span className="probe-forward-route-via">{route.via.length ? route.via.map((name) => <em key={name}>{name}</em>) : <em data-direct>直连</em>}</span>
                      <b data-tone={route.tone}>{latency(route.latency_ms)}</b>
                      {route.loss_pct > 0 && <small data-tone={route.loss_pct >= 5 ? 'down' : 'ok'}>丢包 {loss(route.loss_pct)}</small>}
                    </div>
                    <span className="probe-forward-hop" data-tone={route.tone} data-flow={routeFlow} style={{ '--fw-flow-duration': `${flowDuration(route.latency_ms)}s` } as CSSProperties}><i aria-hidden="true" /></span>
                    <small className="probe-forward-route-by">{route.selected ? `在用${route.selected_by?.length ? `：${route.selected_by.join('、')}` : ''}` : '备用'}</small>
                  </div>
                })}
              </div>}
              {!isFork && index < chain.groups.length - 1 && <span className="probe-forward-hop" data-tone={tone} data-flow={flow}
                style={{ '--fw-flow-duration': `${flowDuration(group.to_next_ms)}s` } as CSSProperties}
                title={tone === 'down' ? '该组无可用服务器' : `到下一组 ${latency(group.to_next_ms)} · ${chainSpeed ? '本链实时' : '本组实时'} ${networkSpeed(hopBytes)}`}>
                <b>{tone === 'down' ? '中断' : latency(group.to_next_ms)}</b><i aria-hidden="true" />
              </span>}
            </Fragment>
          })}
        </div>
        {mayHaveRouteSelection(chain) && <p className="probe-forward-note">主控接口暂未提供选路结构：连续多个中转组可能是「选路段」里的并行路线（按最低延迟择一），此处按顺序画出，端到端延迟按各段相加，可能偏高。</p>}
        <div className="probe-forward-panels">
          {!!chain.trend?.length && <div className="probe-forward-panel"><h4>端到端延迟与丢包 · 近 {Math.round(chain.trend.length * (chain.bucket_sec || 300) / 60)} 分钟
              <span className="probe-forward-legend"><i data-series="latency" />延迟<i data-series="loss" />丢包</span></h4>
            <div className="probe-forward-trend" role="img" aria-label={`${chain.name} 端到端延迟与丢包趋势`}>
              {/* 延迟用左轴（ms），丢包用右轴（%，至少显示到 10%，避免 0% 贴底时看不出来） */}
              <ResponsiveContainer width="100%" height="100%"><LineChart data={chain.trend.map((point) => ({
                ...point,
                e2e_ms: Number.isFinite(point.e2e_ms) && point.e2e_ms >= 0 ? point.e2e_ms : null,
                loss: Number.isFinite(point.loss) && point.loss >= 0 ? point.loss : null,
              }))} margin={{ top: 10, left: 0, right: 0, bottom: 0 }}>
                <XAxis dataKey="ts" type="number" domain={['dataMin', 'dataMax']} tickFormatter={time} tick={{ fontSize: 11 }} minTickGap={30} axisLine={false} tickLine={false} />
                <YAxis yAxisId="ms" width={55} tick={{ fontSize: 11 }} tickFormatter={(value) => `${value} ms`} allowDecimals={false} tickCount={5} domain={[0, (max: number) => Math.max(4, Math.ceil(max * 1.15 / 4) * 4)]} axisLine={false} tickLine={false} />
                <YAxis yAxisId="loss" orientation="right" width={44} tickCount={3} allowDecimals={false} tick={{ fontSize: 11 }} tickFormatter={(value) => `${value}%`} domain={[0, (max: number) => Math.min(100, Math.max(10, Math.ceil(max / 10) * 10))]} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value, name) => name === 'loss' ? [`${Number(value).toFixed(1)}%`, '丢包'] : [latency(Number(value)), '端到端延迟']} labelFormatter={(value) => time(Number(value))} />
                <Line yAxisId="ms" dataKey="e2e_ms" name="e2e_ms" type="linear" stroke="var(--ph-accent)" strokeWidth={2} dot={chain.trend.length === 1} connectNulls={false} isAnimationActive={false} />
                <Line yAxisId="loss" dataKey="loss" name="loss" type="stepAfter" stroke="var(--fw-down)" strokeWidth={1.5} strokeDasharray="4 3" dot={chain.trend.length === 1} connectNulls={false} isAnimationActive={false} />
              </LineChart></ResponsiveContainer>
            </div>
          </div>}
          {traffic && traffic.total <= 0 && <div className="probe-forward-panel"><h4>近 7 天无流量<small className="probe-forward-interval">（{FORWARD_TRAFFIC_NOTE}）</small></h4></div>}
          {traffic && traffic.total > 0 && <div className="probe-forward-panel"><h4>近 7 天流量 · 合计 {formatGb(traffic.total)}<small className="probe-forward-interval">（{FORWARD_TRAFFIC_NOTE}）</small></h4>
            <div className="probe-forward-bars" role="group" aria-label={`${chain.name} 近 7 天每日流量，点击某天查看明细`} data-selected={dayIndex !== null || undefined}>
              {traffic.daily.map((item, index) => <button type="button" key={item.date} aria-pressed={dayIndex === index} title={`${item.date} · ${formatGb(item.gb)}${dayIndex === index ? ' · 再次点击返回 7 天汇总' : ' · 点击查看当日明细'}`}
                onClick={() => setDaySel(dayIndex === index ? null : { chain: chain.name, index })}>
                <i style={{ height: `${peak > 0 ? Math.max(item.gb > 0 ? 4 : 0, item.gb / peak * 100) : 0}%` }} /><small>{day(item.date)}</small>
              </button>)}
            </div>
            {dayDetail ? <div className="probe-forward-day" aria-live="polite">
              <p><strong>{dayDetail.date}</strong> 当日合计 <strong>{formatGb(dayDetail.total)}</strong><button type="button" onClick={() => setDaySel(null)}>返回 7 天汇总</button></p>
              {dayDetail.servers.length > 0
                ? <ol className="probe-forward-top">{dayDetail.servers.map((server) => <li key={server.name}><span title={server.name}>{server.name}</span><small>{roles[server.role as keyof typeof roles] ?? server.role} · {server.group}</small><strong>{formatGb(server.gb)}</strong></li>)}</ol>
                : <p className="probe-forward-empty">当天各节点均无流量。</p>}
            </div> : <>
              <p className="probe-forward-hint">点击柱子查看当天各节点流量</p>
              {traffic.servers.length > 0 && <ol className="probe-forward-top">{traffic.servers.map((server) => <li key={server.name}><span title={server.name}>{server.name}</span><small>{roles[server.role as keyof typeof roles] ?? server.role}</small><strong>{formatGb(server.total_gb)}</strong></li>)}</ol>}
            </>}
          </div>}
        </div>
      </div>
    </div>}
  </details>
}
