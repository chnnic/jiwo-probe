import { ArrowDown, ArrowUp, CalendarDays, Cpu, Database, Gauge, Globe2, HardDrive, Hourglass, MemoryStick, RefreshCw, Wallet } from 'lucide-react'
import { memo, type CSSProperties } from 'react'
import type { ProbeServer } from '../types'
import { bytes, hasLeadingFlag, regionCountryLabel, regionFlag } from '../server-format'
import { SystemIcon, ReturnRouteBadges } from '../components/ServerVisuals'
import { CardPingGroups } from '../CardPingGroups'
import { ConnectionHistory } from '../ConnectionHistory'
import { UnlockButton } from '../ServerCapabilities'
import { ConnectionLabel } from '../ConnectionLabel'
import { connectionCount } from '../unlocks'
import { Twemoji } from '../Twemoji'
import { useNetworkSpeed } from '../use-network-speed'
import { averageLatency, expiryTime, ratio, validNumber } from '../mini/mini-model'
import { trafficRuleLabel, trafficUsageLabel } from '../traffic-display'
import { filledSegments, loadMetric, quotaMetric, resetDays, speedTone, combinedSpeedTrail, type LuminaPlusView, type SpeedTrail } from './luminaplus-model'
import { SpeedPulse } from './SpeedPulse'
import { LuminaPlusTrafficPopover } from './LuminaPlusTrafficPopover'
import { trafficWeek } from './luminaplus-traffic'
import { CYCLE_LABELS, isPermanent } from '../renewal'

export const size = (value?: number) => validNumber(value) === undefined ? '—' : bytes(value)
const percent = (value?: number) => validNumber(value) === undefined ? '—' : `${value!.toFixed(1)}%`

function LuminaPlusConnections({ server }: { server: ProbeServer }) {
  return <div className="probe-connections probe-connections--card lp-connections" aria-label="整机连接数" title="TCP：整机已建立连接；UDP：整机 socket。非代理用户数；未上报显示 —。">
    <span title={`整机 TCP ESTABLISHED 连接数：${connectionCount(server.tcp_connections)}`}><ConnectionLabel protocol="TCP" /><strong>{connectionCount(server.tcp_connections)}</strong></span>
    <span title={`整机 UDP socket 数：${connectionCount(server.udp_connections)}`}><ConnectionLabel protocol="UDP" /><strong>{connectionCount(server.udp_connections)}</strong></span>
  </div>
}

function SegmentMeter({ value, tone, label }: { value?: number; tone: string; label: string }) {
  const count = filledSegments(value)
  return <div className={`lp-meter lp-tone-${tone}`} role="img" aria-label={`${label}：${value === undefined ? '未上报或无可用额度' : `${value.toFixed(1)}%`}`}>
    {Array.from({ length: 20 }, (_, i) => <i key={i} data-filled={i < count} style={{ '--lp-segment': i } as CSSProperties} />)}
  </div>
}

function LuminaPlusCard({ server, index, view, trail }: { server: ProbeServer; index: number; view: LuminaPlusView; trail?: SpeedTrail }) {
  const formatSpeed = useNetworkSpeed()
  const name = server.name || `服务器 ${index + 1}`
  const flag = !hasLeadingFlag(name) ? regionFlag(server.region || server.region_country) : ''
  const country = regionCountryLabel(server) || server.region_name || server.region
  const load = loadMetric(server)
  const quota = quotaMetric(server)
  const reset = resetDays(server.period_end)
  const expiresAt = expiryTime(server)
  const expiryDate = expiresAt === undefined ? undefined : new Date(expiresAt).toLocaleDateString('sv-SE')
  const days = expiresAt === undefined ? undefined : Math.ceil((expiresAt - Date.now()) / 86400000)
  const age = validNumber(server.uptime) === undefined ? '—' : server.uptime! >= 86400 ? `${Math.floor(server.uptime! / 86400)} 天` : `${Math.floor(server.uptime! / 3600)} 时`
  const permanent = isPermanent(server)
  const cycle = CYCLE_LABELS[server.renewal_cycle || 'month']
  const currency = server.renewal_currency || 'CNY'
  const price = validNumber(server.renewal_price) === undefined ? undefined : `${currency} ${server.renewal_price!.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} / ${cycle}`
  const compactPrice = validNumber(server.renewal_price) === undefined ? '—' : `${currency}${server.renewal_price!.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 2 })}/${cycle}`
  const remainingDays = permanent ? '永久' : days === undefined ? '—' : days < 0 ? `已过期 ${Math.abs(days)} 天` : days === 0 ? '今天到期' : `${days} 天`
  const directions = (['upload', 'download'] as const).map(direction => ({
    direction, Icon: direction === 'upload' ? ArrowUp : ArrowDown,
    label: direction === 'upload' ? '上行' : '下行',
    value: direction === 'upload' ? server.upload_speed : server.download_speed,
    total: direction === 'upload' ? server.traffic_used_up : server.traffic_used_down,
  }))
  const resources = [
    { label: 'CPU', Icon: Cpu, tone: 'cpu', value: percent(validNumber(server.cpu_pct)), percent: validNumber(server.cpu_pct), note: server.cpu_cores ? `${server.cpu_cores} 核${server.cpu_threads ? ` · ${server.cpu_threads} 线程` : ''}` : '核心数未上报' },
    { label: '内存', Icon: MemoryStick, tone: 'memory', value: percent(ratio(server.mem_used, server.mem_total)), percent: ratio(server.mem_used, server.mem_total), note: `${size(server.mem_used)} / ${size(server.mem_total)}` },
    { label: '磁盘', Icon: HardDrive, tone: 'disk', value: percent(ratio(server.disk_used, server.disk_total)), percent: ratio(server.disk_used, server.disk_total), note: `${size(server.disk_used)} / ${size(server.disk_total)}` },
    { label: '负载', Icon: Gauge, tone: 'load', value: load.value === undefined ? '—' : load.value.toFixed(2), percent: load.percent, note: server.loadavg || '负载未上报' },
  ]
  if (view === 'list') {
    // 今日上下行合计：与流量弹窗同一套「今天」口径（主控按 UTC 估算时用 UTC 日期）
    const today = trafficWeek(server).today
    const latency = averageLatency(server)
    return <article className={`lp-list-row${server.online ? '' : ' is-offline'}`} aria-label={name}>
      <div className="lp-list-identity"><a href={`#/server/${index}`} className="lp-name" title={`${name} · 查看详情`}><i className="lp-status" aria-label={server.online ? '在线' : '离线'} />{flag && <Twemoji>{flag}</Twemoji>}<h2>{name}</h2></a><small>{country || '地区未知'} · {server.provider_name || '服务商未上报'}</small><div className="lp-routes" role="group" aria-label="电信、联通、移动回程"><ReturnRouteBadges routes={server.return_routes || []} telecomPaidPeer={server.telecom_paid_peer} variant="lumina" /></div></div>
      <div className="lp-list-resources">{resources.slice(0, 3).map(item => <span key={item.label}><span>{item.label}</span><strong>{item.value}</strong></span>)}</div>
      <div className="lp-list-network"><span className="lp-blue"><ArrowUp size={13} /><span className="lp-speed-tone" data-tone={speedTone(server.upload_speed)}>{validNumber(server.upload_speed) === undefined ? '—' : formatSpeed(server.upload_speed!)}</span></span><span className="lp-green"><ArrowDown size={13} /><span className="lp-speed-tone" data-tone={speedTone(server.download_speed)}>{validNumber(server.download_speed) === undefined ? '—' : formatSpeed(server.download_speed!)}</span></span><small className="lp-list-today" title={`今日上下行合计 ${size(today.total)}（上行 ${size(today.upload)} · 下行 ${size(today.download)}）`} aria-label={`今日上下行合计 ${size(today.total)}`}><span aria-hidden="true"><ArrowUp size={12} /><ArrowDown size={12} /></span>{size(today.total)}</small></div>
      <div className="lp-list-connections"><LuminaPlusConnections server={server} /><small>平均延迟 <strong>{latency === undefined ? '—' : `${latency.toFixed(0)} ms`}</strong></small></div>
      <div className="lp-card-actions"><UnlockButton server={server} /><LuminaPlusTrafficPopover server={server} name={name} /></div>
    </article>
  }
  return <article className={`lp-card${server.online ? '' : ' is-offline'}`} aria-label={name}>
    <header className="lp-card-head">
      <a href={`#/server/${index}`} className="lp-name" title={`${name} · 查看详情`}><i className="lp-status" aria-label={server.online ? '在线' : '离线'} />{flag && <Twemoji>{flag}</Twemoji>}<h2>{name}</h2></a>
      <div className="lp-card-actions"><UnlockButton server={server} /><LuminaPlusTrafficPopover server={server} name={name} /><span className="lp-os" title={server.os || '系统未上报'}><SystemIcon server={server} /></span></div>
    </header>
    <div className="lp-badges"><span title={country || '地区未上报'}>{country || '地区未知'}</span>{view !== 'mini' && server.provider_name && <span title={server.provider_name}>{server.provider_name}</span>}{view !== 'mini' && <span className={`lp-state-badge ${server.online ? 'is-online' : ''}`}>{server.online ? '在线' : '离线'}</span>}{view !== 'compact' && price && <span className="lp-price" title={price}><Wallet size={13} />{price}</span>}</div>
    <div className="lp-resources">{resources.map(item => <div className="lp-resource" key={item.label}>
      <div className="lp-resource-label"><span><item.Icon size={15} />{item.label}</span><strong>{item.value}</strong></div>
      <p title={item.note}>{item.note}</p><SegmentMeter value={item.percent} tone={item.tone} label={item.label === '负载' ? '每核归一化负载' : item.label} />
    </div>)}</div>
    {view === 'large' ? <section className="lp-network" aria-label="网络速度与周期流量">
      <div className="lp-speed-grid">{(['upload', 'download'] as const).map(direction => {
        const up = direction === 'upload', Icon = up ? ArrowUp : ArrowDown
        const value = up ? server.upload_speed : server.download_speed
        const text = validNumber(value) === undefined ? '—' : formatSpeed(value!)
        const [amount, unit] = text.split(' ')
        return <div className={`lp-speed lp-${direction}`} key={direction}><div className="lp-speed-value"><span><Icon size={17} />{up ? '上行' : '下行'}</span><strong className="lp-speed-tone" data-tone={speedTone(value)}>{amount}<small>{unit}</small></strong></div>
          <SpeedPulse samples={trail?.[direction] || []} value={value} online={server.online} />
          <div className="lp-period" title={`本周期${up ? '上行' : '下行'}流量`}><span><Globe2 size={15} />{up ? '出站' : '入站'}</span><b>{size(up ? server.traffic_used_up : server.traffic_used_down)}</b></div></div>
      })}</div>
      <LuminaPlusConnections server={server} />
    </section> : view === 'compact' ? <section className="lp-info-strip" aria-label="实时速度、周期流量、到期费用与连接数">
      <div className="lp-info-tile lp-info-speeds" role="group" aria-label="实时速度">{directions.map(({ direction, Icon, label, value }) => {
        const [amount, unit] = (validNumber(value) === undefined ? '—' : formatSpeed(value!)).split(' ')
        return <span key={direction} className={`lp-info-speed lp-${direction}`} title={`${label}实时速度`}><Icon size={11} /><strong className="lp-speed-tone" data-tone={speedTone(value)}>{amount}<small>{unit}</small></strong></span>
      })}<SpeedPulse samples={combinedSpeedTrail(trail)} value={validNumber(server.upload_speed) !== undefined && validNumber(server.download_speed) !== undefined ? server.upload_speed! + server.download_speed! : undefined} online={server.online} /></div>
      <div className="lp-info-tile lp-info-totals" role="group" aria-label="周期流量">{directions.map(({ direction, Icon, label, total }) => <span key={direction} title={`本周期${label}流量`}><Icon size={11} /><strong>{size(total)}</strong></span>)}</div>
      <div className="lp-info-tile lp-info-billing" role="group" aria-label="剩余天数与续费费用"><span className="lp-info-expiry" title={permanent ? '永久买断，无到期日' : `到期日期：${expiryDate || '未设置'} · ${remainingDays}`}><CalendarDays size={11} /><strong>{permanent ? '永久' : days === undefined ? '—' : days > 0 ? `余 ${days}天` : remainingDays}</strong></span><span className="lp-info-price" title={price || '续费价格未设置'}><Wallet size={11} /><strong>{compactPrice}</strong></span></div>
      <div className="lp-info-tile" role="group" aria-label="连接数"><LuminaPlusConnections server={server} /></div>
    </section> : <section className="lp-mini-network" aria-label="实时速度、周期流量与连接数">
      {directions.map(({ direction, Icon, label, value, total }) => <div className="lp-mini-flow" key={direction}>
        <span className={`lp-${direction}`} title={`${label}实时速度`}><Icon size={13} /><strong className="lp-speed-tone" data-tone={speedTone(value)}>{validNumber(value) === undefined ? '—' : formatSpeed(value!)}</strong></span>
        <span title={`本周期${label}流量`}><small>周期{label}</small><b>{size(total)}</b></span>
      </div>)}
      <LuminaPlusConnections server={server} />
    </section>}
    {view !== 'mini' && <div className="lp-quota" title={`${trafficUsageLabel(server)} · ${trafficRuleLabel(server)}`}>
      <div className="lp-quota-heading"><span><Database size={14} />{quota.unlimited ? '不限流量' : quota.exceeded ? '额度已超出' : `剩余 ${size(quota.remaining)}`}{reset !== undefined && <small>· {reset === 0 ? '今天重置' : `${reset}天后重置`}</small>}</span>{view === 'compact' ? <span className="lp-quota-age" title="运行时间">{server.online ? '在线' : '离线'}：{age}</span> : <span>{size(quota.used)} / {quota.unlimited ? '不限' : size(quota.limit)}</span>}</div>
      <div className="lp-quota-meter"><SegmentMeter value={quota.percent} tone={quota.exceeded ? 'danger' : 'traffic'} label="已用计费额度" />{view === 'compact' && <span>{size(quota.used)} / {quota.unlimited ? '不限' : size(quota.limit)}</span>}</div>
    </div>}
    <ConnectionHistory server={server} serverIndex={index} />
    <CardPingGroups ping={server.ping} serverIndex={index} serverName={server.name} variant="classic" averageOnly={view === 'mini'} />
    <div className="lp-routes" role="group" aria-label="电信、联通、移动回程"><ReturnRouteBadges routes={server.return_routes || []} telecomPaidPeer={server.telecom_paid_peer} variant="lumina" /></div>
    {view === 'mini' ? <footer className="lp-mini-footer"><span title="到期日期"><CalendarDays size={12} /><time dateTime={expiryDate}>{permanent ? '永久' : expiryDate || '未设置到期'}</time></span><strong title={`剩余天数 · 已运行 ${age}`} className={days !== undefined && days <= 30 ? 'is-warm' : ''}>{remainingDays}</strong></footer> : view === 'large' && <div className="lp-lifetime" role="group" aria-label="运行时间与到期信息">
      <div><span><RefreshCw size={15} />运行时间</span><strong className="lp-age">{age}</strong></div>
      <div><span><CalendarDays size={15} />到期日期</span><time dateTime={expiryDate}>{permanent ? '永久' : expiryDate || '未设置'}</time></div>
      <div><span><Hourglass size={15} />剩余天数</span><strong className={days !== undefined && days <= 30 ? 'is-warm' : ''}>{remainingDays}</strong></div>
    </div>}
  </article>
}

export default memo(LuminaPlusCard)
