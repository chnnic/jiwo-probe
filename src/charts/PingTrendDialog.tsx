import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoveHorizontal, ZoomIn, ZoomOut } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ProbePingSeries } from '../types'
import { pingTargetOptions, isPingAverage } from '../ping-groups'
import { useProbeRange } from '../use-probe-range'
import { probeRangeBucketSec } from '../probe-ranges'
import { formatAxisDateTime, lossScale, formatLossTick } from '../server-format'
import { HorizontalChart } from './HorizontalChart'

const colors = ['#8b5cf6', '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#ec4899']


export function TrendDialog({ serverIndex, initial, targetKey, cardTarget, title, mode, close }: { serverIndex: number; initial: ProbePingSeries[]; targetKey: string; cardTarget?: string; title: string; mode: 'latency' | 'loss'; close: () => void }) {
  const { range, setRange, options: ranges } = useProbeRange()
  const [group, setGroup] = useState<'all' | 'cn' | 'idc'>(cardTarget === '__avg_cn__' ? 'cn' : cardTarget === '__avg_intl__' ? 'idc' : 'all')
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
    if (cardTarget) {
      // 卡片指定的范围平均由真实线路重新计算，切换时间范围后也不退回全部平均。
      const scope = group === 'cn' ? 'cn' : group === 'idc' ? 'intl' : 'all'
      const averageKey = scope === 'cn' ? '__avg_cn__' : scope === 'intl' ? '__avg_intl__' : '__avg__'
      return pingTargetOptions(series).filter(option => option.series && (option.key === averageKey || (!isPingAverage(option.key) && (scope === 'all' || option.scope === scope))))
        .map((option, index) => ({ item: option.series!, index }))
    }
    const list = series.map((item, index) => ({ item, index }))
    if (group === 'all') return list
    const cn = group === 'cn'
    return list.filter(({ item }) => item.key !== '__avg__' && isCnLabel(item.label) === cn)
  }, [series, group, cardTarget])
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
    setSeries([])
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
        if (controller.signal.aborted) return
        if (payload.success) {
          setSeries([...(payload.series ? [{ ...payload.series, key: '__avg__', label: '平均' }] : []), ...(payload.all_series || [])])
          setTimeMeta({
            generatedAt: payload.generated_at ?? Math.floor(Date.now() / 1000),
            bucketSec: payload.bucket_sec ?? probeRangeBucketSec(range),
          })
        }
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) console.error(error)
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
          const bucket = item.buckets[cardTarget ? item.buckets.length - (displaySeries[0]?.item.buckets.length || 0) + index : index]
          const value = mode === 'loss' ? bucket?.loss : bucket?.ms
          row[item.key || item.label] = value !== undefined && value >= 0 ? value : null
        }
        return row
      }),
    [displaySeries, mode, timeMeta, range, cardTarget],
  )
  const dynamicLossScale = useMemo(() => lossScale(rows), [rows])
  const fitZoom = () => {
    const el = chartRef.current
    if (!el || !rows.length) return
    const target = el.clientWidth / (rows.length * 82)
    setZoom(Math.max(0.05, Math.min(8, target)))
    setIsFit(true)
  }
  // 每个时间范围默认适应屏幕宽度；用户手动 +/- 后不再自动覆盖（与详情页 PingTrendChart 一致）
  useEffect(() => {
    if (!loading && displaySeries.length) {
      const raf = requestAnimationFrame(fitZoom)
      return () => cancelAnimationFrame(raf)
    }
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, loading])

  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={close}>
      <section className="modal" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
        <header>
          <h2>
            {title} · {mode === 'loss' ? '丢包率趋势' : '延迟趋势'}
          </h2>
          <button aria-label="关闭" onClick={close}>
            ×
          </button>
        </header>
        <div className="ranges">
          {ranges.map((item) => (
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
        <div className="chart" ref={chartRef}>
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
                  formatter={(value, _name, item) => [`${Number(value).toFixed(mode === 'loss' ? 1 : 0)}${mode === 'loss' ? '%' : 'ms'}`, (cardTarget ? groupSeries.map(entry => entry.item) : series).find((line) => (line.key || line.label) === item.dataKey)?.label || String(item.dataKey)]}
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
                  <i
                    style={{
                      background: key === '__avg__' ? 'var(--foreground, #2f2350)' : colors[index % colors.length],
                    }}
                  />
                  {item.label}
                </button>
              )
            })}
          </div>
        )}
      </section>
    </div>,
    document.body,
  )
}
