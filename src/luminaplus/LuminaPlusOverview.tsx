import { ArrowDown, ArrowUp, CircleDollarSign, Database, Network, Server } from 'lucide-react'
import type { ProbeServer } from '../types'
import { miniSummary } from '../mini/mini-model'
import { useNetworkSpeed } from '../use-network-speed'
import { assetOverview, speedTone } from './luminaplus-model'
import { size } from './LuminaPlusCard'
import { LuminaPlusRanking } from './LuminaPlusRanking'

const money = (value: number) => value.toLocaleString('zh-CN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
function NumberUnit({ text }: { text: string }) {
  const [number, ...unit] = text.split(' ')
  return <>{number}<small>{unit.join(' ')}</small></>
}

export default function LuminaPlusOverview({ servers }: { servers: ProbeServer[] }) {
  const summary = miniSummary(servers)
  const assets = assetOverview(servers)
  const main = assets.groups[0]
  const formatSpeed = useNetworkSpeed()
  const speed = (value?: number) => value === undefined ? '—' : formatSpeed(value)
  const totalSpeed = summary.upload === undefined && summary.download === undefined ? undefined : (summary.upload || 0) + (summary.download || 0)
  const onlinePercent = servers.length ? summary.online / servers.length * 100 : 0
  return <section className="lp-summary" aria-label="集群概览">
    <article className="lp-overview-card"><header><span>在线节点</span><Server size={17} /></header>
      <strong className="lp-overview-value">{summary.online}<small>/ {servers.length}</small></strong>
      <div className="lp-overview-foot"><span>在线率 {onlinePercent.toFixed(0)}%</span><span>{servers.length - summary.online} 台离线</span></div>
      <div className="lp-online-meter" role="img" aria-label={`在线率 ${onlinePercent.toFixed(0)}%`}><i style={{ width: `${onlinePercent}%` }} /></div>
    </article>
    <LuminaPlusRanking servers={servers} metric="speed"><header><span>实时带宽</span><Network size={17} /></header>
      <strong className="lp-overview-value lp-speed-tone" data-tone={speedTone(totalSpeed)}><NumberUnit text={speed(totalSpeed)} /></strong>
      <div className="lp-overview-directions"><span><ArrowUp size={13} />{speed(summary.upload)}</span><span><ArrowDown size={13} />{speed(summary.download)}</span></div>
      <div className="lp-overview-foot"><span>上行 + 下行</span><span className="lp-ranking-hint">查看排行 ›</span></div>
    </LuminaPlusRanking>
    <LuminaPlusRanking servers={servers} metric="traffic"><header><span>周期流量</span><Database size={17} /></header>
      <strong className="lp-overview-value"><NumberUnit text={size(summary.traffic)} /></strong>
      <div className="lp-overview-directions"><span><ArrowUp size={13} />{size(summary.outbound)}</span><span><ArrowDown size={13} />{size(summary.inbound)}</span></div>
      <div className="lp-overview-foot"><span title="按主控计费口径汇总">主控计费</span><span className="lp-ranking-hint">查看排行 ›</span></div>
    </LuminaPlusRanking>
    <article className="lp-overview-card lp-overview-assets"><header><span>资产概览</span><CircleDollarSign size={17} /></header>
      <strong className="lp-overview-value">{main?.valued ? <>{main.currency === 'CNY' && <em>¥</em>}{money(main.remaining)}<small>{main.currency !== 'CNY' && main.currency}</small></> : '—'}</strong>
      <div className="lp-overview-directions"><span>剩余价值估算{assets.groups.length > 1 && ` · 另有 ${assets.groups.length - 1} 种货币`}</span></div>
      <details className="lp-asset-breakdown"><summary>费用与统计口径</summary><div>
        {assets.groups.map(group => <p key={group.currency}><b>{group.currency}</b><span>月均 {money(group.monthly)}</span><span>剩余 {group.valued ? money(group.remaining) : '—'}</span><small>{group.priced} 台有价格 · {group.valued} 台有到期日期</small></p>)}
        <p>{assets.unpriced} 台未配置价格。优先采用主控折合人民币；无汇率时分币种展示，不直接相加。剩余价值按剩余天数折算，不是余额。</p>
      </div></details>
    </article>
  </section>
}
