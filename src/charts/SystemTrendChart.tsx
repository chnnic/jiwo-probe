import { useEffect, useRef, useState } from 'react'
import { MoveHorizontal, ZoomIn, ZoomOut } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { connectionTrendRows, formatConnectionAverage, systemTrendRows, type SystemSeries, type TrendRow } from '../mini/mini-trends'
import { useProbeRange } from '../use-probe-range'
import { probeBucketLabel, probeRangeBucketSec } from '../probe-ranges'
import { formatAxisDateTime } from '../server-format'
import { HorizontalChart } from './HorizontalChart'

// 系统指标历史曲线；连接数同样直接读取主控桶平均值，不使用当前会话采样。
const SYSTEM_LINES = {
  cpu: { label: 'CPU 使用率', color: 'var(--progress-cpu, #3b82f6)' },
  mem: { label: '内存使用率', color: 'var(--progress-memory, #8b5cf6)' },
  disk: { label: '硬盘使用率', color: 'var(--progress-disk, #f59e0b)' },
} as const

// 趋势图曲线色: 黑金/白金下 --progress-* 已是渐变字符串(SVG stroke 不接受渐变, 曲线会失效),
// 必须渲染时用纯色: 白金=主题金(CPU 中金/内存深金), 黑金=亮金
function systemLineColor(metric: 'cpu' | 'mem' | 'disk'): string {
  const root = document.documentElement
  if (root.classList.contains('platinum')) return metric === 'cpu' ? '#c9962b' : metric === 'mem' ? '#a87c22' : '#8a6210'
  if (root.classList.contains('gold')) return '#d8b46a'
  return SYSTEM_LINES[metric].color
}

export function SystemTrendChart({ serverIndex, metric, containerClass = 'detail-chart', fixedAxis = true }: { serverIndex: number; metric: 'cpu' | 'mem' | 'disk' | 'connections'; containerClass?: string; fixedAxis?: boolean }) {
  const { range, setRange, options: ranges, historyDays } = useProbeRange()
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [rows, setRows] = useState<TrendRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [bucketSec, setBucketSec] = useState(300)
  const [zoom, setZoom] = useState(1)
  const [isFit, setIsFit] = useState(true)
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(false)
    setRows([])
    void fetch(`/api/series?server=${serverIndex}&range=${range}&metric=system`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<{ success: boolean; bucket_sec?: number; series?: SystemSeries }>
      })
      .then((payload) => {
        if (controller.signal.aborted) return
        if (!payload.success) throw new Error('History unavailable')
        const raw = payload.series || {}
        const reportedBucket = payload.bucket_sec
        const step = reportedBucket && Number.isFinite(reportedBucket) && reportedBucket > 0 ? reportedBucket : probeRangeBucketSec(range)
        setBucketSec(step)
        setRows(metric === 'connections' ? connectionTrendRows(raw, step) : systemTrendRows(metric === 'cpu' ? { cpu_pct: raw.cpu_pct } : metric === 'mem' ? { mem_used: raw.mem_used, mem_total: raw.mem_total } : { disk_used: raw.disk_used, disk_total: raw.disk_total }))
      })
      .catch(() => { if (!controller.signal.aborted) setError(true) })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [range, serverIndex, metric])

  useEffect(() => setHidden(new Set()), [serverIndex, metric])

  const fitZoom = () => {
    const el = chartRef.current
    if (!el || !rows.length) return
    const target = el.clientWidth / (rows.length * 82)
    setZoom(Math.max(0.05, Math.min(8, target)))
    setIsFit(true)
  }
  useEffect(() => {
    if (!loading && rows.length) {
      const raf = requestAnimationFrame(fitZoom)
      return () => cancelAnimationFrame(raf)
    }
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, loading])

  const isConnections = metric === 'connections'
  const chartLines = isConnections
    ? [{ key: 'tcp', label: 'TCP', color: 'var(--connection-tcp)' }, { key: 'udp', label: 'UDP', color: 'var(--connection-udp)' }]
    : [{ key: metric, ...SYSTEM_LINES[metric], color: systemLineColor(metric) }]
  const hasPoints = rows.some(row => chartLines.some(line => row[line.key] != null))
  return (
    <>
      <div className="ranges">
        {ranges.map((item) => (
          <button type="button" className={range === item.key ? 'active' : ''} onClick={() => setRange(item.key)} key={item.key}>
            {item.label}
          </button>
        ))}
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
        <button type="button" className={`zoom-btn${isFit ? ' active' : ''}`} aria-label="适应屏幕宽度" title="适应屏幕宽度" onClick={fitZoom}>
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
      <div className={containerClass} ref={chartRef}>
        {loading && <div className="loading-overlay">加载中…</div>}
        {!loading && error && <div className="chart-empty" role="status">历史数据加载失败，请切换时间范围重试。</div>}
        {!loading && !error && !hasPoints && <div className="chart-empty">{isConnections ? '主控暂无 TCP / UDP 历史记录；请确认已开启连接数采集，并等待历史积累。' : `暂无${metric === 'cpu' ? 'CPU' : metric === 'mem' ? '内存' : '硬盘'}历史`}</div>}
        {!loading && !error && hasPoints && <HorizontalChart width={isFit ? 120 : Math.max(120, rows.length * 82 * zoom)} fixedAxis={fixedAxis}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <XAxis dataKey="ts" type="number" domain={['dataMin', 'dataMax']} tickFormatter={value => formatAxisDateTime(Number(value), true)} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={28} />
              <YAxis width={isConnections ? 56 : 40} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={!isConnections} domain={[0, metric === 'mem' || metric === 'disk' ? 100 : 'auto']} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8 }}
                formatter={(value, name) => [isConnections ? formatConnectionAverage(Number(value)) : `${Number(value).toFixed(1)}%`, name]}
                labelFormatter={(_value, payload) => formatAxisDateTime(Number((payload?.[0]?.payload as { ts?: number } | undefined)?.ts ?? 0), true)}
              />
              {chartLines.filter(line => !hidden.has(line.key)).map(line => (
                <Line key={line.key} type={isConnections ? 'linear' : 'monotone'} dataKey={line.key} name={line.label} stroke={line.color} strokeWidth={2.5} dot={rows.filter(row => row[line.key] != null).length === 1 ? { r: 3 } : false} connectNulls={false} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </HorizontalChart>}
      </div>
      <div className="legend">
        {chartLines.map(line => <button key={line.key} type="button" className={hidden.has(line.key) ? 'off' : ''} aria-pressed={!hidden.has(line.key)} onClick={() => setHidden(previous => { const next = new Set(previous); if (next.has(line.key)) next.delete(line.key); else next.add(line.key); return next })} title={hidden.has(line.key) ? '点击显示' : '点击隐藏'}>
          <i style={{ background: line.color }} />
          {line.label}
        </button>)}
      </div>
      {isConnections && !loading && !error && <p className="detail-connections-note">主控历史 · 每 {probeBucketLabel(bucketSec)}平均值 · 最多 {historyDays > 1 ? `${historyDays} 天` : '24 小时'}。缺失数据不补零；整机连接数，非代理用户数。</p>}
    </>
  )
}
