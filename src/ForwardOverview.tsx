import { Fragment, useState } from 'react'
import { ChevronDown, Network } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ProbePayload } from './types'
import { chainTraffic, formatGb, forwardSummary, groupHealth, hopTone, latencyTone, sortChains, type ForwardStatus } from './forward-model'
import './probe-history.css'

const roles = { entry: '入口', mid: '中转', exit: '出口' }
const STATUS_LABEL: Record<ForwardStatus, string> = { ok: '正常', warn: '偏慢', down: '异常' }
const latency = (value?: number) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? `${Math.round(value)} ms` : '—'
const loss = (value?: number) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? `${value.toFixed(1)}%` : '—'
const time = (value: number) => new Date(value * 1000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
const day = (value: string) => value.slice(5).replace('-', '/')

/**
 * 转发链总览（各主题共用，Premium 有自己的转发页）。沿用主控快照/展示开关，不另开轮询。
 * 与主控转发链列表、主控 CSS 同一口径：顶部汇总正常 / 偏慢 / 异常，问题链路置顶并写明原因，
 * 拓扑的组与连线按状态着色，另展示接口已下发的 7 天流量。判断规则见 forward-model.ts。
 */
export function ForwardOverview({ data }: { data: ProbePayload }) {
  const [selected, setSelected] = useState('')
  if (data.show_forward === false || (!data.show_forward && !data.forward?.length)) return null
  const chains = sortChains(data.forward || [])
  const summary = forwardSummary(data.forward || [])
  const current = chains.find((item) => item.chain.name === selected) || chains[0]
  const chain = current?.chain
  const traffic = chain ? chainTraffic(chain) : null
  const peak = traffic ? Math.max(...traffic.daily.map((item) => item.gb), 0) : 0
  return <details className="probe-forward" open>
    <summary><Network size={17} /><h2>转发链拓扑与延迟</h2>
      <span className="probe-forward-summary">共 {summary.total} 条<b data-status="ok">正常 {summary.ok}</b><b data-status="warn">偏慢 {summary.warn}</b><b data-status="down">异常 {summary.down}</b></span>
      <ChevronDown size={16} /></summary>
    {!chain || !current ? <p className="probe-forward-empty">暂无转发链数据，等待主控探测上报。</p> : <div className="probe-forward-content">
      <div className="probe-forward-chains" role="group" aria-label="转发链列表（异常与偏慢置顶）">
        {chains.map((item) => {
          const total = chainTraffic(item.chain)?.total
          return <button type="button" key={item.chain.name} data-status={item.status} aria-pressed={item === current} onClick={() => setSelected(item.chain.name)} title={item.reasons.join('；') || STATUS_LABEL[item.status]}>
            <span className="probe-forward-chain-name"><i aria-hidden="true" />{item.chain.name}</span>
            <span className="probe-forward-chain-stats"><strong data-tone={latencyTone(item.chain.end_to_end_ms)}>{latency(item.chain.end_to_end_ms)}</strong><span>丢包 {loss(item.chain.loss_pct)}</span>{total !== undefined && <span>7 天 {formatGb(total)}</span>}</span>
            {item.reasons.length > 0 && <small>{item.reasons.join(' · ')}</small>}
          </button>
        })}
      </div>
      <div className="probe-forward-detail" data-status={current.status}>
        <header><h3><i aria-hidden="true" />{chain.name}<span>{STATUS_LABEL[current.status]}</span></h3>
          <span>端到端 <strong>{latency(chain.end_to_end_ms)}</strong></span><span>丢包 <strong>{loss(chain.loss_pct)}</strong></span>
          {current.reasons.length > 0 && <p>{current.reasons.join('；')}</p>}
        </header>
        <div className="probe-forward-topology" aria-label={`${chain.name} 转发拓扑`}>
          {chain.groups.map((group, index) => {
            const health = groupHealth(group)
            const groupStatus = !health || health.total === 0 ? undefined : health.healthy === 0 ? 'down' : health.healthy < health.total ? 'warn' : 'ok'
            const tone = hopTone(group)
            return <Fragment key={`${group.name}-${index}`}>
              <section className="probe-forward-group" data-status={groupStatus}>
                <h3><small>{roles[group.role]}</small><span title={group.name}>{group.name}</span>{health && <em>{health.healthy}/{health.total} 可用</em>}</h3>
                <ul>{group.servers.map((server, i) => <li key={`${server.name}-${i}`}>
                  {group.role !== 'exit' && <i data-healthy={server.healthy} title={server.healthy ? '探测正常' : '探测异常'} />}
                  <span title={server.name}>{server.name}</span>
                  {group.role !== 'exit' && <strong data-tone={server.healthy ? latencyTone(server.to_next_ms) : 'down'}>{server.healthy ? latency(server.to_next_ms) : '不可达'}</strong>}
                </li>)}</ul>
              </section>
              {index < chain.groups.length - 1 && <span className="probe-forward-hop" data-tone={tone} title={tone === 'down' ? '该组无可用服务器' : '到下一组的延迟'}><b>{tone === 'down' ? '中断' : latency(group.to_next_ms)}</b><i aria-hidden="true" /></span>}
            </Fragment>
          })}
        </div>
        <div className="probe-forward-panels">
          {!!chain.trend?.length && <div className="probe-forward-panel"><h4>端到端延迟 · 近 {Math.round(chain.trend.length * (chain.bucket_sec || 300) / 60)} 分钟</h4>
            <div className="probe-forward-trend" role="img" aria-label={`${chain.name} 端到端延迟趋势`}>
              <ResponsiveContainer width="100%" height="100%"><LineChart data={chain.trend.map((point) => ({ ...point, e2e_ms: Number.isFinite(point.e2e_ms) && point.e2e_ms >= 0 ? point.e2e_ms : null }))} margin={{ top: 10, left: 0, right: 16, bottom: 0 }}>
                <XAxis dataKey="ts" type="number" domain={['dataMin', 'dataMax']} tickFormatter={time} tick={{ fontSize: 11 }} minTickGap={30} axisLine={false} tickLine={false} />
                <YAxis width={55} tick={{ fontSize: 11 }} tickFormatter={(value) => `${value} ms`} domain={[0, 'auto']} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => [latency(Number(value)), '端到端延迟']} labelFormatter={(value) => time(Number(value))} />
                <Line dataKey="e2e_ms" type="linear" stroke="var(--ph-tcp)" strokeWidth={2} dot={chain.trend.length === 1} connectNulls={false} isAnimationActive={false} />
              </LineChart></ResponsiveContainer>
            </div>
          </div>}
          {traffic && traffic.total <= 0 && <div className="probe-forward-panel"><h4>近 7 天无流量</h4></div>}
          {traffic && traffic.total > 0 && <div className="probe-forward-panel"><h4>近 7 天流量 · 合计 {formatGb(traffic.total)}</h4>
            <div className="probe-forward-bars" role="img" aria-label={`${chain.name} 近 7 天每日流量`}>
              {traffic.daily.map((item) => <span key={item.date} title={`${item.date} · ${formatGb(item.gb)}`}>
                <i style={{ height: `${peak > 0 ? Math.max(item.gb > 0 ? 4 : 0, item.gb / peak * 100) : 0}%` }} /><small>{day(item.date)}</small>
              </span>)}
            </div>
            {traffic.servers.length > 0 && <ol className="probe-forward-top">{traffic.servers.map((server) => <li key={server.name}><span title={server.name}>{server.name}</span><small>{roles[server.role as keyof typeof roles] ?? server.role}</small><strong>{formatGb(server.total_gb)}</strong></li>)}</ol>}
          </div>}
        </div>
      </div>
    </div>}
  </details>
}
