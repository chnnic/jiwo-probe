import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ProbePingSeries, ProbeServer } from '../types'
import { useNetworkSpeed } from '../use-network-speed'
import { ConnectionLabel } from '../ConnectionLabel'
import { connectionCount } from '../unlocks'
import { MINI_RANGES, connectionTrendRows, formatConnectionAverage, pingTrendRows, systemTrendRows, trendValue, type MiniRange, type SystemSeries, type TrendRow } from './mini-trends'

const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f97316']
type SeriesPayload = { success: boolean; generated_at?: number; bucket_sec?: number; series?: ProbePingSeries; all_series?: ProbePingSeries[] }
type History<T> = { data?: T; loading: boolean; error: boolean }
function useHistory<T extends { success: boolean }>(serverIndex: number, range: MiniRange, metric: 'ping' | 'system'): History<T> {
  const [state, setState] = useState<History<T>>({ loading: true, error: false })
  useEffect(() => {
    const controller = new AbortController()
    setState({ loading: true, error: false })
    void fetch(`/api/series?server=${serverIndex}&range=${range}&${metric === 'system' ? 'metric=system' : 'all=1'}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const payload = await response.json() as T
        if (!payload.success) throw new Error('History unavailable')
        if (!controller.signal.aborted) setState({ data: payload, loading: false, error: false })
      })
      .catch(() => { if (!controller.signal.aborted) setState({ loading: false, error: true }) })
    return () => controller.abort()
  }, [serverIndex, range, metric])
  return state
}
function RangePicker({ value, onChange }: { value: MiniRange; onChange: (value: MiniRange) => void }) {
  return <div className="mini-trend-ranges" role="group" aria-label="历史时间范围">{MINI_RANGES.map(item => <button key={item.key} type="button" aria-pressed={item.key === value} onClick={() => onChange(item.key)}>{item.label}</button>)}</div>
}
type TrendLine = { key: string; label: string; color: string }
const clock = (time: number) => new Date(time * 1000).toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' })
function TrendPlot({ rows, lines, format, loading, error, empty, percent = false, integer = false }: { rows: TrendRow[]; lines: TrendLine[]; format: (value: number) => string; loading: boolean; error: boolean; empty?: string; percent?: boolean; integer?: boolean }) {
  const hasPoints = rows.some(row => lines.some(line => row[line.key] != null))
  const values = rows.flatMap(row => lines.map(line => row[line.key]).filter((value): value is number => value != null))
  const low = values.length ? Math.min(...values) : 0, high = values.length ? Math.max(...values) : 1
  const padding = Math.max((high - low) * .12, high * .02, .1)
  const domain: [number, number] = [integer ? 0 : Math.max(0, low - padding), integer ? Math.max(1, Math.ceil(high + padding)) : percent ? Math.max(high, Math.min(100, high + padding)) : high + padding]
  return <div className="mini-trend-plot">
    {loading ? <p className="mini-trend-placeholder" role="status">加载历史数据…</p> : error ? <p className="mini-trend-placeholder" role="status">历史数据暂不可用，请切换时间范围重试。</p> : !hasPoints ? <p className="mini-trend-placeholder">{empty || '暂无历史记录，等待主控上报。'}</p> :
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 10, right: 8, bottom: 0, left: 0 }} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="var(--mini-border)" />
          <XAxis dataKey="ts" type="number" domain={['dataMin', 'dataMax']} tickFormatter={clock} tick={{ fontSize: 10, fill: 'var(--mini-muted)' }} minTickGap={38} tickCount={3} axisLine={false} tickLine={false} />
          <YAxis width={58} domain={domain} allowDecimals={!integer} tickFormatter={value => format(value).replace(/\s+/g, '')} tick={{ fontSize: 10, fill: 'var(--mini-muted)' }} tickCount={4} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ fontSize: 11, background: 'var(--mini-surface)', border: '1px solid var(--mini-border)', borderRadius: 10, color: 'var(--mini-text)' }} labelFormatter={label => new Date(Number(label) * 1000).toLocaleString('zh-CN', { hour12: false })} formatter={(value, name) => [format(Number(value)), name]} />
          {lines.map(line => <Line key={line.key} type="linear" dataKey={line.key} name={line.label} stroke={line.color} strokeWidth={1.6} dot={rows.filter(row => row[line.key] != null).length === 1 ? { r: 2 } : false} activeDot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />)}
        </LineChart>
      </ResponsiveContainer>}
  </div>
}
function ChartCard({ title, value, children, className = '' }: { title: string; value?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`mini-trend-card ${className}`} aria-label={title}><header><h3>{title}</h3>{value && <span>{value}</span>}</header>{children}</section>
}
export function MiniLatencyTrends({ server, index }: { server: ProbeServer; index: number }) {
  const [range, setRange] = useState<MiniRange>('1h')
  const [mode, setMode] = useState<'latency' | 'loss'>('latency')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const history = useHistory<SeriesPayload>(index, range, 'ping')
  const series = useMemo(() => history.data ? [
    ...(history.data.series ? [{ ...history.data.series, key: '__avg__', label: '平均' }] : []),
    ...(history.data.all_series || []),
  ] : server.ping || [], [history.data, server.ping])
  const targets = series.map((line, slot) => ({ key: `line${slot}`, id: line.key || line.label, label: line.label, color: line.key === '__avg__' ? 'var(--mini-text)' : colors[slot % colors.length], series: line }))
  const visible = targets.filter(line => !hidden.has(line.id))
  const bucketSec = history.data?.bucket_sec || MINI_RANGES.find(item => item.key === range)!.bucketSec
  const rows = useMemo(() => history.data ? pingTrendRows(series, history.data.generated_at ?? Math.floor(Date.now() / 1000), bucketSec, mode) : [], [history.data, series, bucketSec, mode])
  const format = (value: number) => `${Number(value.toFixed(mode === 'loss' ? 1 : 0))}${mode === 'loss' ? '%' : 'ms'}`
  return <div className="mini-trends mini-latency-trends">
    <div className="mini-trend-toolbar"><RangePicker value={range} onChange={setRange} /><div className="mini-trend-selection"><button type="button" onClick={() => setHidden(new Set())}>全选</button><button type="button" onClick={() => setHidden(new Set(targets.map(line => line.id)))}>全不选</button></div></div>
    <section className="mini-trend-card mini-latency-card" aria-label="延迟与丢包趋势">
      <div className="mini-trend-targets" role="group" aria-label="显示的测试目标">{targets.map(line => <button type="button" key={line.id} title={line.label} aria-pressed={!hidden.has(line.id)} onClick={() => setHidden(previous => { const next = new Set(previous); if (next.has(line.id)) next.delete(line.id); else next.add(line.id); return next })}><i style={{ background: line.color }} />{line.label}</button>)}</div>
      <header><h3>{mode === 'loss' ? '丢包走势（%）' : '延迟走势（ms）'}</h3><span>粒度 {Math.round(bucketSec / 60)} 分钟</span></header>
      <div className="mini-trend-mode mini-segment" role="group" aria-label="延迟图表类型"><button type="button" aria-pressed={mode === 'latency'} onClick={() => setMode('latency')}>延迟</button><button type="button" aria-pressed={mode === 'loss'} onClick={() => setMode('loss')}>丢包</button></div>
      <TrendPlot rows={rows} lines={visible} format={format} loading={history.loading} error={history.error} empty={!visible.length && targets.length ? '请选择上方测试目标以显示曲线。' : undefined} />
      <div className="mini-trend-values" aria-label="测试目标当前数值">{visible.map(line => {
        const value = trendValue(mode === 'loss' ? line.series.loss_pct : line.series.current_ms)
        return <span key={line.id}><i style={{ background: line.color }} />{line.label}<strong>{value === null ? '—' : format(value)}</strong></span>
      })}</div>
    </section>
  </div>
}
export function MiniSystemTrends({ server, index }: { server: ProbeServer; index: number }) {
  const [range, setRange] = useState<MiniRange>('1h')
  const history = useHistory<{ success: boolean; bucket_sec?: number; series?: SystemSeries }>(index, range, 'system')
  const rows = useMemo(() => systemTrendRows(history.data?.series || {}), [history.data])
  const reportedBucketSec = history.data?.bucket_sec
  const bucketSec = reportedBucketSec && Number.isFinite(reportedBucketSec) && reportedBucketSec > 0 ? reportedBucketSec : MINI_RANGES.find(item => item.key === range)!.bucketSec
  const connections = useMemo(() => connectionTrendRows(history.data?.series || {}, bucketSec), [history.data, bucketSec])
  const speed = useNetworkSpeed()
  const formatPercent = (value: number) => `${Number(value.toFixed(1))}%`
  const cpu = trendValue(server.cpu_pct)
  const mem = trendValue(server.mem_used), total = trendValue(server.mem_total)
  const memory = mem !== null && total !== null && total > 0 ? mem / total * 100 : null
  const currentSpeed = (value?: number) => trendValue(value) === null ? '—' : speed(value!)
  return <div className="mini-trends mini-system-trends">
    <div className="mini-trend-toolbar"><RangePicker value={range} onChange={setRange} /></div>
    <ChartCard title="CPU 使用率" value={cpu === null ? '—' : formatPercent(cpu)}><TrendPlot rows={rows} lines={[{ key: 'cpu', label: 'CPU 使用率', color: 'var(--mini-accent)' }]} format={formatPercent} loading={history.loading} error={history.error} /></ChartCard>
    <ChartCard title="内存使用率" value={memory === null ? '—' : formatPercent(memory)}><TrendPlot rows={rows} lines={[{ key: 'mem', label: '内存使用率', color: 'var(--mini-green)' }]} format={formatPercent} loading={history.loading} error={history.error} percent /></ChartCard>
    <ChartCard title="网络速度" value={<><span className="mini-trend-down">↓ {currentSpeed(server.download_speed)}</span><span className="mini-trend-up">↑ {currentSpeed(server.upload_speed)}</span></>}><TrendPlot rows={rows} lines={[{ key: 'download', label: '下行', color: 'var(--mini-blue)' }, { key: 'upload', label: '上行', color: 'var(--mini-green)' }]} format={speed} loading={history.loading} error={history.error} /></ChartCard>
    <ChartCard title="TCP / UDP 连接数" className="mini-connections-chart" value={<><span className="mini-trend-up"><ConnectionLabel protocol="TCP" />{connectionCount(server.tcp_connections)}</span><span className="mini-trend-down"><ConnectionLabel protocol="UDP" />{connectionCount(server.udp_connections)}</span></>}>
      <TrendPlot rows={connections} lines={[{ key: 'tcp', label: 'TCP', color: 'var(--mini-green)' }, { key: 'udp', label: 'UDP', color: 'var(--mini-blue)' }]} format={formatConnectionAverage} loading={history.loading} error={history.error} integer empty="主控暂无 TCP / UDP 历史记录；请确认已开启连接数采集，并等待历史积累。" />
      <p className="mini-connections-note">主控历史 · 每 {Math.round(bucketSec / 60)} 分钟平均值 · 最多 24 小时。刷新后重新读取主控记录；缺失数据保留空档，不补零。整机连接数，非代理用户数。</p>
    </ChartCard>
  </div>
}
