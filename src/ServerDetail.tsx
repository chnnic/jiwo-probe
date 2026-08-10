import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Activity, ArrowDown, ArrowUp, BadgeDollarSign, CalendarClock, ChevronLeft, Clock, Cpu, Database, HardDrive, MemoryStick, Monitor, MoveHorizontal, PieChart, TrendingUp, Wallet, Wifi, X, ZoomIn, ZoomOut } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ProbePingSeries, ProbeServer } from './types'
import { Twemoji } from './Twemoji'
import { Meter, ReturnRouteBadges, SystemIcon, TrafficChart, LoadTrendChart, SystemTrendChart, averagePing, bytes, expiring, expired, formatAxisDateTime, formatLossTick, hasLeadingFlag, HorizontalChart, lossScale, pct, regionFlag, regionLabel, remainingDays, speed } from './App'
import { computeRemainingValue, formatMoney } from './value'

const cycleLabel = {
  month: '月',
  quarter: '季',
  half_year: '半年',
  year: '年',
} as const

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d} 天 ${h} 小时`
  if (h > 0) return `${h} 小时 ${m} 分`
  if (m > 0) return `${m} 分钟`
  return `${seconds} 秒`
}

function RemainingValueBlock({ server }: { server: ProbeServer }) {
  const rv = computeRemainingValue(server)
  if (!rv) return null
  const percent = Math.min(100, Math.max(0, (rv.days / rv.cycleDays) * 100))
  return (
    <div className="detail-value">
      <div className="detail-value-main">
        <span>
          <BadgeDollarSign size={15} />
          剩余价值
        </span>
        <strong>{formatMoney(rv.value, rv.currency, rv.isCny)}</strong>
        <small>≈ 按剩余天数折算</small>
      </div>
      <div className="detail-value-sub">
        <span>日成本 {formatMoney(rv.daily, rv.currency, rv.isCny, rv.daily < 1)}</span>
        <span>
          剩余 {rv.days} / {rv.cycleDays} 天
        </span>
      </div>
      <div className="meter">
        <i style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

const RANGES = [
  { key: '1h', label: '1 小时', bucketLabel: (index: number, count: number) => `-${(count - index) * 5}m` },
  { key: '6h', label: '6 小时', bucketLabel: (index: number, count: number) => `-${(((count - index) * 10) / 60).toFixed(1)}h` },
  { key: '24h', label: '24 小时', bucketLabel: (index: number, count: number) => `-${(((count - index) * 30) / 60).toFixed(0)}h` },
] as const
type RangeKey = (typeof RANGES)[number]['key']

const colors = ['#8b5cf6', '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#ec4899']

function PingTrendChart({ serverIndex, initial, targetKey, mode }: { serverIndex: number; initial: ProbePingSeries[]; targetKey: string; mode: 'latency' | 'loss' }) {
  const [range, setRange] = useState<RangeKey>('1h')
  const [group, setGroup] = useState<'all' | 'cn' | 'idc'>('all')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [series, setSeries] = useState<ProbePingSeries[]>(initial)
  const [loading, setLoading] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [isFit, setIsFit] = useState(true)
  const chartRef = useRef<HTMLDivElement>(null)
  const [timeMeta, setTimeMeta] = useState({
    generatedAt: Math.floor(Date.now() / 1000),
    bucketSec: 300,
  })

  const isCnLabel = (label: string) => /电信|联通|移动/.test(label)
  const groupSeries = useMemo(() => {
    const list = series.map((item, index) => ({ item, index }))
    if (group === 'all') return list
    const cn = group === 'cn'
    return list.filter(({ item }) => item.key !== '__avg__' && isCnLabel(item.label) === cn)
  }, [series, group])
  const displaySeries = useMemo(
    () => groupSeries.filter(({ item }) => !hidden.has(item.key || item.label)),
    [groupSeries, hidden],
  )
  const toggleHidden = (key: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    void fetch(`/api/series?server=${serverIndex}&range=${range}&all=1`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<{
          success: boolean
          series?: ProbePingSeries
          all_series?: ProbePingSeries[]
          generated_at?: number
          bucket_sec?: number
        }>
      })
      .then((payload) => {
        if (payload.success) {
          setSeries([...(payload.series ? [{ ...payload.series, key: '__avg__', label: '平均' }] : []), ...(payload.all_series || [])])
          setTimeMeta({
            generatedAt: payload.generated_at ?? Math.floor(Date.now() / 1000),
            bucketSec: payload.bucket_sec ?? (range === '1h' ? 300 : range === '6h' ? 600 : 1800),
          })
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [range, serverIndex])

  const rows = useMemo(
    () =>
      Array.from({ length: displaySeries[0]?.item.buckets.length || 0 }, (_, index) => {
        const ts =
          timeMeta.generatedAt -
          (timeMeta.generatedAt % timeMeta.bucketSec) -
          ((displaySeries[0]?.item.buckets.length || 0) - 1 - index) * timeMeta.bucketSec
        const row: Record<string, string | number | null> = {
          time: formatAxisDateTime(ts, range === '1h'),
          ts,
        }
        for (const { item } of displaySeries) {
          const bucket = item.buckets[index]
          const value = mode === 'loss' ? bucket?.loss : bucket?.ms
          row[item.key || item.label] = value !== undefined && value >= 0 ? value : null
        }
        return row
      }),
    [displaySeries, timeMeta, mode, range],
  )
  const dynamicLossScale = useMemo(() => lossScale(rows), [rows])
  const fitZoom = () => {
    const el = chartRef.current
    if (!el || !rows.length) return
    const target = el.clientWidth / (rows.length * 82)
    setZoom(Math.max(0.05, Math.min(8, target)))
    setIsFit(true)
  }
  // 每个时间范围默认适应屏幕宽度；用户手动 +/- 后不再自动覆盖
  useEffect(() => {
    if (!loading && displaySeries.length) {
      const raf = requestAnimationFrame(fitZoom)
      return () => cancelAnimationFrame(raf)
    }
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, loading])

  return (
    <>
      <div className="ranges">
        {RANGES.map((item) => (
          <button type="button" className={range === item.key ? 'active' : ''} onClick={() => setRange(item.key)} key={item.key}>
            {item.label}
          </button>
        ))}
        <span className="ranges-sep" />
        <button type="button" className={group === 'all' ? 'active' : ''} onClick={() => setGroup('all')}>
          全部
        </button>
        <button type="button" className={group === 'cn' ? 'active' : ''} onClick={() => setGroup('cn')}>
          内地
        </button>
        <button type="button" className={group === 'idc' ? 'active' : ''} onClick={() => setGroup('idc')}>
          海外
        </button>
        <span className="ranges-sep" />
        <button
          type="button"
          className="zoom-btn"
          aria-label="缩小横轴"
          title={`缩小横轴（当前 ${Math.round(zoom * 100)}%）`}
          onClick={() => {
            setZoom((value) => Math.max(0.05, Math.round((value - 0.1) * 10) / 10))
            setIsFit(false)
          }}
        >
          <ZoomOut size={13} />
        </button>
        <button
          type="button"
          className={`zoom-btn${isFit ? ' active' : ''}`}
          aria-label="适应屏幕宽度"
          title="适应屏幕宽度"
          onClick={fitZoom}
        >
          <MoveHorizontal size={13} />
        </button>
        <button
          type="button"
          className="zoom-btn"
          aria-label="放大横轴"
          title={`放大横轴（当前 ${Math.round(zoom * 100)}%）`}
          onClick={() => {
            setZoom((value) => Math.min(8, Math.round((value + 0.1) * 10) / 10))
            setIsFit(false)
          }}
        >
          <ZoomIn size={13} />
        </button>
      </div>
      <div className="detail-chart" ref={chartRef}>
        {loading && <div className="loading-overlay">加载中…</div>}
        {!loading && !displaySeries.length && (
          <div className="chart-empty">
            该服务器未配置{group === 'cn' ? '内地' : '海外'}探测点
          </div>
        )}
        <HorizontalChart width={Math.max(120, rows.length * 82 * zoom)}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <XAxis dataKey="time" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={28} />
              <YAxis
                width={52}
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                unit={mode === 'loss' ? undefined : 'ms'}
                domain={mode === 'loss' ? [0, dynamicLossScale.max] : undefined}
                ticks={mode === 'loss' ? dynamicLossScale.ticks : undefined}
                tickFormatter={mode === 'loss' ? (value) => formatLossTick(Number(value)) : undefined}
              />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8 }}
                formatter={(value, _name, item) => [`${Number(value).toFixed(mode === 'loss' ? 1 : 0)}${mode === 'loss' ? '%' : 'ms'}`, series.find((line) => (line.key || line.label) === item.dataKey)?.label || String(item.dataKey)]}
                labelFormatter={(_value, payload) => formatAxisDateTime(Number((payload?.[0]?.payload as { ts?: number } | undefined)?.ts ?? 0), true)}
              />
              {displaySeries.map(({ item, index }) => {
                const key = item.key || item.label
                const active = key === targetKey
                return <Line key={key} type="monotone" dataKey={key} name={item.label} stroke={key === '__avg__' ? 'var(--foreground, #2f2350)' : colors[index % colors.length]} strokeWidth={active ? 2.5 : 1} strokeOpacity={active ? 1 : 0.45} dot={false} connectNulls={false} isAnimationActive={false} />
              })}
            </LineChart>
          </ResponsiveContainer>
        </HorizontalChart>
      </div>
      {groupSeries.length > 0 && (
        <div className="legend">
          {groupSeries.map(({ item, index }) => {
            const key = item.key || item.label
            const off = hidden.has(key)
            return (
              <button
                type="button"
                className={`${key === targetKey ? 'active' : ''}${off ? ' off' : ''}`}
                key={key}
                onClick={() => toggleHidden(key)}
                title={off ? '点击显示' : '点击隐藏'}
              >
                <i style={{ background: key === '__avg__' ? 'var(--foreground, #2f2350)' : colors[index % colors.length] }} />
                {item.label}
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}

function DetailMetric({ icon, label, value, percent }: { icon: React.ReactNode; label: string; value: string; percent: number }) {
  return (
    <div className="detail-metric">
      <div className="detail-metric-head">
        <span>
          {icon}
          {label}
        </span>
        <strong>{value}</strong>
      </div>
      <div className="meter">
        <i style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
      </div>
    </div>
  )
}

export function ServerDetail({ server, index, onClose }: { server: ProbeServer; index: number; onClose: () => void }) {
  const [selected, setSelected] = useState('__avg__')
  const [trendMode, setTrendMode] = useState<'latency' | 'loss' | 'traffic' | 'load' | 'cpu' | 'mem'>('latency')
  const name = server.name || `服务器 ${index + 1}`
  const flag = regionFlag(server.region)
  const ping = server.ping || []
  const average = averagePing(ping)
  const lines = [{ ...average, key: '__avg__' }, ...ping]

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return createPortal(
    <div className="server-detail-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="server-detail" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-label={name}>
        <header className="server-detail-header">
          <button aria-label="返回" onClick={onClose}>
            <ChevronLeft size={18} />
          </button>
          <div className="server-detail-title">
            <span className={server.online ? 'status online' : 'status'} />
            <h2>
              <Twemoji>{flag && !hasLeadingFlag(name) ? `${flag} ${name}` : name}</Twemoji>
            </h2>
            <span className={server.online ? 'detail-online' : 'detail-offline'}>{server.online ? '在线' : '离线'}</span>
          </div>
          {regionLabel(server) && <div className="detail-region">{regionLabel(server)}</div>}
          <button aria-label="关闭" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="server-detail-body">
          <div className="detail-cols">
            <section className="detail-panel">
              <h3>资源占用</h3>
              <div className="detail-grid">
                {server.cpu_pct !== undefined && <DetailMetric icon={<Cpu size={15} />} label="CPU" value={`${server.cpu_pct.toFixed(1)}%`} percent={server.cpu_pct} />}
                {server.mem_total !== undefined && <DetailMetric icon={<MemoryStick size={15} />} label="内存" value={`${bytes(server.mem_used)} / ${bytes(server.mem_total)}`} percent={pct(server.mem_used, server.mem_total)} />}
                {server.disk_total !== undefined && <DetailMetric icon={<HardDrive size={15} />} label="硬盘" value={`${bytes(server.disk_used)} / ${bytes(server.disk_total)}`} percent={pct(server.disk_used, server.disk_total)} />}
                {server.traffic_used !== undefined && (
                  <DetailMetric
                    icon={<PieChart size={15} />}
                    label="流量"
                    value={server.traffic_limit ? `${bytes(server.traffic_used, false)} / ${bytes(server.traffic_limit, false)}` : bytes(server.traffic_used, false)}
                    percent={pct(server.traffic_used, server.traffic_limit)}
                  />
                )}
                {server.loadavg && (
                  <div className="detail-loadavg">
                    <Activity size={14} />
                    <span className="loadavg-label">负载</span>
                    {server.loadavg.split(/\s+/).slice(0, 3).map((value, i) => (
                      <code key={i}>{value}</code>
                    ))}
                  </div>
                )}
                {(server.upload_speed !== undefined || server.download_speed !== undefined) && (
                  <div className="detail-speed">
                    <span className="download" title="下行速度">
                      <ArrowDown size={16} />
                      {speed(server.download_speed)}
                    </span>
                    <span className="upload" title="上行速度">
                      <ArrowUp size={16} />
                      {speed(server.upload_speed)}
                    </span>
                  </div>
                )}
              </div>
              {(server.cpu_model || server.os || server.kernel) && (
                <div className="detail-hw">
                  {server.cpu_model && (
                    <span title="CPU 型号">
                      <Cpu size={13} />
                      {server.cpu_model}
                      {server.cpu_cores !== undefined && <small>{server.cpu_cores} 核{server.cpu_threads ? ` ${server.cpu_threads} 线程` : ''}</small>}
                    </span>
                  )}
                  {server.os && (
                    <span title="操作系统">
                      <SystemIcon server={server} />
                      {server.os}
                    </span>
                  )}
                  {server.kernel && (
                    <span title="内核与架构">
                      <Monitor size={13} />
                      {server.kernel}
                      {server.arch && <small>{server.arch}</small>}
                    </span>
                  )}
                  {server.uptime !== undefined && (
                    <span title="运行时间">
                      <Clock size={13} />
                      {formatUptime(server.uptime)}
                    </span>
                  )}
                  {(() => {
                    const last = server.daily_traffic?.length ? server.daily_traffic[server.daily_traffic.length - 1] : null
                    if (!last?.total) return null
                    return (
                      <span title="今日使用流量">
                        <TrendingUp size={13} />
                        今日 {bytes(last.total)}
                      </span>
                    )
                  })()}
                  {(() => {
                    // 累计总流量: 优先主控周期统计 traffic_used_total(物理口径, 重启不清零),
                    // 回退 cumulative_up+down(agent 网卡计数, 重启清零)
                    const total = server.traffic_used_total ?? (server.cumulative_up !== undefined && server.cumulative_down !== undefined ? server.cumulative_up + server.cumulative_down : undefined)
                    if (total === undefined) return null
                    return (
                      <span title="累计总流量（上行 + 下行）">
                        <Database size={13} />
                        累计 {bytes(total)}
                      </span>
                    )
                  })()}
                </div>
              )}
            </section>

            <div className="detail-col-stack">
              {(server.expires_at || server.renewal_price !== undefined) && (
                <section className="detail-panel">
                  <h3>到期与续费</h3>
                  <div className="detail-meta">
                    {server.expires_at &&
                      (server.provider_url ? (
                        <a href={server.provider_url} target="_blank" rel="noopener noreferrer" className={expiring(server) || expired(server) ? 'warning' : ''} title={server.provider_name ? `前往 ${server.provider_name} 续费` : '前往服务商续费'}>
                          <CalendarClock size={13} />
                          {remainingDays(server.expires_at)}
                          <small>{server.expires_at}</small>
                        </a>
                      ) : (
                        <span className={expiring(server) || expired(server) ? 'warning' : ''}>
                          <CalendarClock size={13} />
                          {remainingDays(server.expires_at)}
                          <small>{server.expires_at}</small>
                        </span>
                      ))}
                    {server.renewal_price !== undefined && (
                      <span>
                        <Wallet size={13} />
                        {server.renewal_price_cny !== undefined ? `¥${server.renewal_price_cny.toFixed(2)}` : `${server.renewal_currency || 'CNY'} ${server.renewal_price}`} / {cycleLabel[server.renewal_cycle || 'month']}
                        {server.renewal_price_cny !== undefined && server.renewal_currency !== 'CNY' && <small>（{server.renewal_currency} {server.renewal_price}）</small>}
                      </span>
                    )}
                    {server.provider_name && (
                      <span>
                        <Wifi size={13} />
                        服务商: {server.provider_name}
                      </span>
                    )}
                  </div>
                  <RemainingValueBlock server={server} />
                </section>
              )}

              {!!server.return_routes?.length && (
                <section className="detail-panel">
                  <h3>回程路由</h3>
                  <ReturnRouteBadges routes={server.return_routes} telecomPaidPeer={server.telecom_paid_peer} variant={document.documentElement.classList.contains('theme-lumina') ? 'lumina' : document.documentElement.classList.contains('theme-anime') ? 'anime' : undefined} />
                </section>
              )}
            </div>
          </div>

          {!!ping.length && (
            <section className="detail-panel">
              <div className="detail-panel-head">
                <h3>{trendMode === 'latency' ? '延迟趋势' : trendMode === 'loss' ? '丢包趋势' : trendMode === 'traffic' ? '日流量趋势' : trendMode === 'load' ? '负载趋势' : trendMode === 'cpu' ? 'CPU 趋势' : '内存趋势'}</h3>
                <div className="trend-mode-switch" role="tablist" aria-label="趋势类型">
                  <button type="button" role="tab" aria-selected={trendMode === 'latency'} className={trendMode === 'latency' ? 'active' : ''} onClick={() => setTrendMode('latency')}>
                    延迟
                  </button>
                  <button type="button" role="tab" aria-selected={trendMode === 'loss'} className={trendMode === 'loss' ? 'active' : ''} onClick={() => setTrendMode('loss')}>
                    丢包
                  </button>
                  <button type="button" role="tab" aria-selected={trendMode === 'traffic'} className={trendMode === 'traffic' ? 'active' : ''} onClick={() => setTrendMode('traffic')}>
                    流量
                  </button>
                  <button type="button" role="tab" aria-selected={trendMode === 'load'} className={trendMode === 'load' ? 'active' : ''} onClick={() => setTrendMode('load')}>
                    负载
                  </button>
                  <button type="button" role="tab" aria-selected={trendMode === 'cpu'} className={trendMode === 'cpu' ? 'active' : ''} onClick={() => setTrendMode('cpu')}>
                    CPU
                  </button>
                  <button type="button" role="tab" aria-selected={trendMode === 'mem'} className={trendMode === 'mem' ? 'active' : ''} onClick={() => setTrendMode('mem')}>
                    内存
                  </button>
                </div>
              </div>
              {trendMode === 'traffic' ? (
                <TrafficChart daily={server.daily_traffic || []} containerClass="detail-chart detail-chart-traffic" />
              ) : trendMode === 'load' ? (
                <LoadTrendChart serverIndex={index} containerClass="detail-chart detail-chart-load" />
              ) : trendMode === 'cpu' ? (
                <SystemTrendChart serverIndex={index} metric="cpu" containerClass="detail-chart detail-chart-system" />
              ) : trendMode === 'mem' ? (
                <SystemTrendChart serverIndex={index} metric="mem" containerClass="detail-chart detail-chart-system" />
              ) : (
                <>
                  <div className="detail-ping-picker">
                    <Wifi size={14} />
                    <select value={selected} onChange={(event) => setSelected(event.target.value)}>
                      <option value="__avg__">平均</option>
                      {ping.map((item) => (
                        <option key={item.key || item.label} value={item.key || item.label}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <PingTrendChart serverIndex={index} initial={lines} targetKey={selected} mode={trendMode} />
                </>
              )}
            </section>
          )}
        </div>
      </section>
    </div>,
    document.body,
  )
}
