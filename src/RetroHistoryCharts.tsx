import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Chart, Filler, LinearScale, LineController, LineElement, PointElement, Tooltip } from 'chart.js'
import { Maximize2, Minimize2 } from 'lucide-react'
import { bytes } from './App'
import { historyValue, memoryPoints, metricPoints, pingPoints } from './retro-history'
import type { HistoryPoint, HistoryRange, PingHistory, SystemHistory } from './retro-history'
import type { ProbePingSeries, ProbeServer } from './types'
import { useNetworkSpeed } from './use-network-speed'

Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip, Filler)

const ranges = [{ key: '1h', label: '1 小时' }, { key: '6h', label: '6 小时' }, { key: '24h', label: '24 小时' }] as const
const emptySystem: SystemHistory = {}
const emptyPing: PingHistory = {}
const emptyDaily: NonNullable<ProbeServer['daily_traffic']> = []
const percent = (value: number) => `${Number(value.toFixed(2))}%`
const latency = (value: number) => `${Number(value.toFixed(1))} ms`
const connections = (value: number) => String(Math.round(value))
const dateLabel = (timestamp: number, dateOnly = false) => new Intl.DateTimeFormat('zh-CN', dateOnly
  ? { month: '2-digit', day: '2-digit' }
  : { hour: '2-digit', minute: '2-digit', hour12: false }).format(timestamp)

interface HistoryLine {
  key: string
  label: string
  color: number
  points: HistoryPoint[]
  fill?: boolean
}

function useHistory<T>(url: string | null, revision: number) {
  const [state, setState] = useState<{ url: string | null; revision: number; data?: T; receivedAt: number; loading: boolean; error: boolean }>({ url, revision, receivedAt: 0, loading: !!url, error: false })
  useEffect(() => {
    if (!url) return
    const controller = new AbortController()
    setState({ url, revision, receivedAt: 0, loading: true, error: false })
    void fetch(url, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const payload = await response.json() as T & { success?: boolean }
        if (!payload.success) throw new Error('History unavailable')
        if (!controller.signal.aborted) setState({ url, revision, data: payload, receivedAt: Math.floor(Date.now() / 1000), loading: false, error: false })
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ url, revision, receivedAt: 0, loading: false, error: true })
      })
    return () => controller.abort()
  }, [url, revision])
  return state.url === url && state.revision === revision ? state : { data: undefined, receivedAt: 0, loading: !!url, error: false }
}

function HistoryCanvas({ title, lines, format, dateOnly = false }: { title: string; lines: HistoryLine[]; format: (value: number) => string; dateOnly?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart<'line', HistoryPoint[]> | null>(null)
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const styles = getComputedStyle(canvas)
    const color = (index: number) => styles.getPropertyValue(`--graph-line-${index % 8 + 1}`).trim()
    const timestamps = lines.flatMap((line) => line.points.map((point) => point.x))
    const first = Math.min(...timestamps)
    const last = Math.max(...timestamps)
    const span = last - first
    const chart = new Chart<'line', HistoryPoint[]>(canvas, {
      type: 'line',
      data: { datasets: lines.map((line) => ({
        label: line.label,
        data: line.points,
        borderColor: color(line.color),
        backgroundColor: color(line.color) + '20',
        borderWidth: 1.25,
        pointRadius: line.points.filter((point) => point.y !== null).length === 1 ? 2 : 0,
        pointHoverRadius: 3,
        pointHitRadius: 8,
        tension: 0,
        fill: !!line.fill,
        spanGaps: false,
      })) },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        parsing: false,
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
        layout: { padding: { top: 6, right: 8, bottom: 2, left: 4 } },
        font: { family: 'Tahoma, Microsoft YaHei, sans-serif', size: 10 },
        scales: {
          x: {
            type: 'linear',
            ...(last > first ? { min: first, max: last } : {}),
            grid: { color: styles.getPropertyValue('--graph-grid').trim(), tickLength: 0 },
            border: { display: false },
            ticks: {
              color: styles.getPropertyValue('--graph-axis').trim(),
              font: { size: 9 },
              maxTicksLimit: 5,
              maxRotation: 0,
              padding: 6,
              stepSize: dateOnly ? 86400000 : span > 6 * 3600000 ? 6 * 3600000 : span > 3600000 ? 3600000 : 15 * 60000,
              callback: (value) => !dateOnly && span > 6 * 3600000
                ? `${dateLabel(Number(value), true)} ${dateLabel(Number(value))}`
                : dateLabel(Number(value), dateOnly),
            },
          },
          y: {
            beginAtZero: true,
            suggestedMax: 1,
            grid: { color: styles.getPropertyValue('--graph-grid').trim(), tickLength: 0 },
            border: { display: false },
            ticks: { color: styles.getPropertyValue('--graph-axis').trim(), font: { size: 9 }, maxTicksLimit: 6, padding: 5, callback: (value) => format(Number(value)) },
          },
        },
        plugins: {
          tooltip: {
            backgroundColor: '#ffffe1',
            titleColor: '#000',
            bodyColor: '#000',
            borderColor: '#808080',
            borderWidth: 1,
            cornerRadius: 0,
            titleFont: { size: 11 },
            bodyFont: { size: 11 },
            callbacks: {
              title: (items) => items.length && items[0].parsed.x !== null ? new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', ...(dateOnly ? {} : { hour: '2-digit', minute: '2-digit', hour12: false }) }).format(items[0].parsed.x) : '',
              label: (item) => `${item.dataset.label}: ${item.parsed.y === null ? '—' : format(item.parsed.y)}`,
            },
          },
        },
      },
    })
    chartRef.current = chart
    // The canvas must repaint when XP / 2000 or their light/dark skin changes.
    const repaint = () => {
      const theme = getComputedStyle(canvas)
      for (const axis of ['x', 'y'] as const) {
        const scale = chart.options.scales?.[axis]
        if (scale?.ticks) scale.ticks.color = theme.getPropertyValue('--graph-axis').trim()
        if (scale?.grid) scale.grid.color = theme.getPropertyValue('--graph-grid').trim()
      }
      chart.update('none')
    }
    const observer = new MutationObserver(repaint)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    return () => { observer.disconnect(); chart.destroy(); chartRef.current = null }
  }, [lines, format, dateOnly])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    lines.forEach((line, index) => chart.setDatasetVisibility(index, !hidden.has(line.key)))
    chart.update('none')
  }, [hidden, lines, format, dateOnly])

  return (
    <>
      <div className="retro-chart-legend" role="group" aria-label={`${title}曲线`}>
        {lines.map((line) => <button key={line.key} type="button" aria-pressed={!hidden.has(line.key)} className={hidden.has(line.key) ? 'off' : ''} onClick={() => setHidden((current) => {
          const next = new Set(current)
          if (next.has(line.key)) next.delete(line.key)
          else next.add(line.key)
          return next
        })} title={`${hidden.has(line.key) ? '显示' : '隐藏'}${line.label}`}>
          <i style={{ borderColor: `var(--graph-line-${line.color % 8 + 1})` }} />{line.label}
        </button>)}
      </div>
      <div className="retro-chart-canvas"><canvas ref={canvasRef} role="img" aria-label={`${title}历史趋势，可使用上方图例显示或隐藏曲线`}>{title}历史趋势</canvas></div>
    </>
  )
}

function HistoryPanel({ id, title, readout, lines, format, expanded, onExpand, loading = false, error = false, onRetry, controls, dateOnly = false }: {
  id: string; title: string; readout: ReactNode; lines: HistoryLine[]; format: (value: number) => string
  expanded: boolean; onExpand: () => void; loading?: boolean; error?: boolean; onRetry: () => void; controls?: ReactNode; dateOnly?: boolean
}) {
  const hasData = lines.some((line) => line.points.some((point) => point.y !== null))
  return (
    <fieldset className={`retro-chart-box${expanded ? ' expanded' : ''}`} data-chart={id}>
      <legend>{title}</legend>
      <div className="retro-chart-head">
        <div className="retro-chart-readout">{readout}</div>
        <button type="button" className="retro-chart-expand" aria-label={`${expanded ? '还原' : '展开'}${title}`} title={expanded ? '还原' : '展开'} aria-expanded={expanded} onClick={onExpand}>
          {expanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
        </button>
      </div>
      {controls}
      <div className="retro-chart-plot" aria-busy={loading}>
        {loading || error || !hasData ? <div className="retro-chart-state" role="status">
          <span>{loading ? '正在加载历史…' : error ? '历史加载失败' : `暂无${title}历史`}</span>
          {error && <button type="button" onClick={onRetry}>重试</button>}
        </div> : <HistoryCanvas title={title} lines={lines} format={format} dateOnly={dateOnly} />}
      </div>
    </fieldset>
  )
}

export function RetroHistoryCharts({ server, index }: { server: ProbeServer; index: number }) {
  const [range, setRange] = useState<HistoryRange>('1h')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [days, setDays] = useState<'all' | '7d' | '30d'>('7d')
  const [group, setGroup] = useState<'all' | 'cn' | 'idc'>('all')
  const networkSpeed = useNetworkSpeed()
  const hasPing = !!server.ping?.length
  const systemState = useHistory<{ series?: SystemHistory }>(`/api/series?server=${index}&range=${range}&metric=system`, revision)
  const pingState = useHistory<PingHistory>(hasPing ? `/api/series?server=${index}&range=${range}&all=1` : null, revision)
  const system = systemState.data?.series || emptySystem
  const ping = pingState.data || emptyPing
  const daily = server.daily_traffic || emptyDaily

  const systemLines = useMemo(() => ({
    cpu: [{ key: 'cpu', label: 'CPU', color: 0, points: metricPoints(system.cpu_pct), fill: true }],
    memory: [{ key: 'memory', label: '内存', color: 1, points: memoryPoints(system), fill: true }],
    network: [
      { key: 'download', label: '下行', color: 0, points: metricPoints(system.download_speed), fill: true },
      { key: 'upload', label: '上行', color: 1, points: metricPoints(system.upload_speed), fill: true },
    ],
    connections: [
      { key: 'tcp', label: 'TCP', color: 0, points: metricPoints(system.tcp_connections) },
      { key: 'udp', label: 'UDP', color: 1, points: metricPoints(system.udp_connections) },
    ],
  }), [system])
  const pingLines = useMemo(() => {
    const all: ProbePingSeries[] = [...(ping.series ? [{ ...ping.series, key: '__avg__', label: '平均' }] : []), ...(ping.all_series || [])]
    const selected = all.map((line, color) => ({ line, color })).filter(({ line }) => group === 'all' || (line.key !== '__avg__' && /电信|联通|移动/.test(line.label) === (group === 'cn')))
    const makeLines = (mode: 'latency' | 'loss') => selected.map(({ line, color }) => ({ key: line.key || line.label, label: line.label, color, points: pingPoints(line, mode, ping, range, pingState.receivedAt) }))
    return { latency: makeLines('latency'), loss: makeLines('loss') }
  }, [ping, range, group, pingState.receivedAt])
  const trafficLines = useMemo(() => {
    const shown = days === 'all' ? daily : daily.slice(days === '7d' ? -7 : -30)
    return ([['total', '总流量'], ['uplink', '上行'], ['downlink', '下行']] as const).map(([key, label], color) => ({
      key, label, color, points: shown.map((row) => ({ x: new Date(`${row.date}T00:00:00`).getTime(), y: historyValue(row[key]) })).filter((point) => Number.isFinite(point.x)),
    }))
  }, [daily, days])

  const current = (value: number | undefined, format: (value: number) => string) => historyValue(value) === null ? '—' : format(value!)
  const currentMemory = server.mem_total && server.mem_used !== undefined ? server.mem_used / server.mem_total * 100 : undefined
  const panelProps = (id: string) => ({ id, expanded: expanded === id, onExpand: () => setExpanded(expanded === id ? null : id), onRetry: () => setRevision((value) => value + 1) })
  const systemStatus = { loading: systemState.loading, error: systemState.error }
  const pingStatus = { loading: pingState.loading, error: pingState.error }
  const pingReadout = (mode: 'latency' | 'loss') => (server.ping || []).filter((line) => group === 'all' || /电信|联通|移动/.test(line.label) === (group === 'cn')).map((line) => <span key={line.key || line.label}>{line.label} <b>{mode === 'latency' && line.current_ms < 0 ? '超时' : current(mode === 'latency' ? line.current_ms : line.loss_pct, mode === 'latency' ? latency : percent)}</b></span>)

  return (
    <>
      <div className="ranges retro-history-range" role="group" aria-label="历史时间范围">
        <span>历史范围：</span>
        {ranges.map((item) => <button type="button" key={item.key} className={range === item.key ? 'active' : ''} aria-pressed={range === item.key} onClick={() => setRange(item.key)}>{item.label}</button>)}
        <button type="button" onClick={() => setRevision((value) => value + 1)} disabled={systemState.loading || pingState.loading}>刷新历史</button>
        <span className="retro-history-note">日流量按天独立查看</span>
      </div>
      {hasPing && <div className="ranges retro-probe-range" role="group" aria-label="延迟与丢包线路范围">
        <span>探测线路：</span>
        {([{ key: 'all', label: '全部' }, { key: 'cn', label: '内地' }, { key: 'idc', label: '海外' }] as const).map((item) => <button type="button" key={item.key} className={group === item.key ? 'active' : ''} aria-pressed={group === item.key} onClick={() => setGroup(item.key)}>{item.label}</button>)}
      </div>}
      <div className="retro-charts-grid">
        <HistoryPanel {...panelProps('cpu')} {...systemStatus} title="CPU 使用率" readout={<b>{current(server.cpu_pct, percent)}</b>} lines={systemLines.cpu} format={percent} />
        <HistoryPanel {...panelProps('memory')} {...systemStatus} title="内存使用率" readout={<><b>{current(currentMemory, percent)}</b><span>已用 {current(server.mem_used, bytes)} / {current(server.mem_total, bytes)}</span></>} lines={systemLines.memory} format={percent} />
        <HistoryPanel {...panelProps('network')} {...systemStatus} title="网络速度" readout={<><span>▼ <b>{current(server.download_speed, networkSpeed)}</b></span><span>▲ <b>{current(server.upload_speed, networkSpeed)}</b></span></>} lines={systemLines.network} format={networkSpeed} />
        <HistoryPanel {...panelProps('connections')} {...systemStatus} title="连接数" readout={<><span>TCP <b>{current(server.tcp_connections, connections)}</b></span><span>UDP <b>{current(server.udp_connections, connections)}</b></span></>} lines={systemLines.connections} format={connections} />
        <HistoryPanel {...panelProps('traffic')} title="日流量" readout={<span>最近一日 <b>{current(daily.at(-1)?.total, bytes)}</b></span>} lines={trafficLines} format={bytes} dateOnly controls={
          <div className="ranges retro-traffic-range" role="group" aria-label="日流量范围">
            {([{ key: 'all', label: '全部' }, { key: '7d', label: '7 日' }, { key: '30d', label: '30 日' }] as const).map((item) => <button type="button" key={item.key} className={days === item.key ? 'active' : ''} aria-pressed={days === item.key} onClick={() => setDays(item.key)}>{item.label}</button>)}
          </div>
        } />
        {hasPing && <>
          <HistoryPanel {...panelProps('latency')} {...pingStatus} title="延迟监测" readout={pingReadout('latency')} lines={pingLines.latency} format={latency} />
          <HistoryPanel {...panelProps('loss')} {...pingStatus} title="丢包监测" readout={pingReadout('loss')} lines={pingLines.loss} format={percent} />
        </>}
      </div>
    </>
  )
}
