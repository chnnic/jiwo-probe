import { Fragment, useState } from 'react'
import { ArrowRight, ChevronDown, Network } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ProbePayload } from './types'
import './probe-history.css'

const roles = { entry: '入口', mid: '中转', exit: '出口' }
const latency = (value?: number) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? `${Math.round(value)} ms` : '—'
const time = (value: number) => new Date(value * 1000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })

/** 与服务器卡片分开，沿用主控快照/展示开关，不另开轮询。Premium 有自己的转发页。 */
export function ForwardOverview({ data }: { data: ProbePayload }) {
  const [selected, setSelected] = useState('')
  if (data.show_forward === false || (!data.show_forward && !data.forward?.length)) return null
  const chains = data.forward || []
  const chain = chains.find(item => item.name === selected) || chains[0]
  return <details className="probe-forward" open>
    <summary><Network size={17} /><h2>转发链拓扑与延迟</h2><span>{chains.length} 条链路</span><ChevronDown size={16} /></summary>
    {!chain ? <p className="probe-forward-empty">暂无转发链数据，等待主控探测上报。</p> : <div className="probe-forward-content">
      <div className="probe-forward-toolbar"><label>转发链<select aria-label="选择转发链" value={chain.name} onChange={event => setSelected(event.target.value)}>{chains.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
        <span>端到端 <strong>{latency(chain.end_to_end_ms)}</strong></span><span>丢包 <strong>{Number.isFinite(chain.loss_pct) && chain.loss_pct >= 0 ? `${chain.loss_pct.toFixed(1)}%` : '—'}</strong></span>
      </div>
      <div className="probe-forward-topology" aria-label={`${chain.name} 转发拓扑`}>
        {chain.groups.map((group, index) => <Fragment key={`${group.name}-${index}`}>
          <section className="probe-forward-group"><h3><small>{roles[group.role]}</small>{group.name}</h3>
            <ul>{group.servers.map((server, i) => <li key={`${server.name}-${i}`}><i data-healthy={server.healthy} title={server.healthy ? '探测正常' : '探测异常'} /><span title={server.name}>{server.name}</span><strong>{server.healthy ? latency(server.to_next_ms) : '—'}</strong></li>)}</ul>
          </section>
          {index < chain.groups.length - 1 && <span className="probe-forward-hop"><b>{latency(group.to_next_ms)}</b><ArrowRight size={25} /><small>下一组</small></span>}
        </Fragment>)}
      </div>
      {!!chain.trend?.length && <div className="probe-forward-trend" role="img" aria-label={`${chain.name} 端到端延迟趋势`}>
        <ResponsiveContainer width="100%" height="100%"><LineChart data={chain.trend.map(point => ({ ...point, e2e_ms: Number.isFinite(point.e2e_ms) && point.e2e_ms >= 0 ? point.e2e_ms : null }))} margin={{ top: 10, left: 0, right: 16, bottom: 0 }}>
          <XAxis dataKey="ts" type="number" domain={['dataMin', 'dataMax']} tickFormatter={time} tick={{ fontSize: 11 }} minTickGap={30} axisLine={false} tickLine={false} />
          <YAxis width={55} tick={{ fontSize: 11 }} tickFormatter={value => `${value} ms`} domain={[0, 'auto']} axisLine={false} tickLine={false} />
          <Tooltip formatter={value => [latency(Number(value)), '端到端延迟']} labelFormatter={value => time(Number(value))} />
          <Line dataKey="e2e_ms" type="linear" stroke="var(--ph-tcp)" strokeWidth={2} dot={chain.trend.length === 1} connectNulls={false} isAnimationActive={false} />
        </LineChart></ResponsiveContainer>
      </div>}
    </div>}
  </details>
}
