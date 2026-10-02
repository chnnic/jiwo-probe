import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoveHorizontal, ZoomIn, ZoomOut } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ProbeServer } from '../types'
import { dailyTrafficRows, hasTrafficPeriod, trafficFormulaLabel, trafficRuleLabel, type TrafficRange } from '../traffic-display'
import { bytes } from '../server-format'
import { HorizontalChart } from './HorizontalChart'

const TRAFFIC_LINES = [
  { key: 'total', label: '总流量', stroke: '#3b82f6' },
  { key: 'uplink', label: '上行流量', stroke: '#f97316' },
  { key: 'downlink', label: '下行流量', stroke: '#22c55e' },
] as const


export function TrafficChart({ daily, containerClass = 'detail-chart', showRange = true }: { daily: ProbeServer['daily_traffic']; containerClass?: string; showRange?: boolean }) {
  const rows = daily || []
  const chartRef = useRef<HTMLDivElement>(null)
  const [trafficRange, setTrafficRange] = useState<'all' | '7d' | '30d'>('7d')
  const [zoom, setZoom] = useState(1)
  const [isFit, setIsFit] = useState(true)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const shown = useMemo(() => {
    if (!rows.length) return []
    if (!showRange) return rows // 外部已按周期/最近7日过滤(弹窗/drawer 场景)
    if (trafficRange === 'all') return rows
    const days = trafficRange === '7d' ? 7 : 30
    return rows.slice(-days)
  }, [rows, trafficRange, showRange])
  const fitZoom = () => {
    const el = chartRef.current
    if (!el || !shown.length) return
    const target = el.clientWidth / (shown.length * 82)
    setZoom(Math.max(0.05, Math.min(8, target)))
    setIsFit(true)
  }
  useEffect(() => {
    if (shown.length) {
      const raf = requestAnimationFrame(fitZoom)
      return () => cancelAnimationFrame(raf)
    }
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trafficRange, shown.length])
  const toggleLine = (key: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  if (!rows.length) {
    return <div className="chart-empty">暂无日流量数据</div>
  }
  return (
    <>
      <div className="ranges">
        {showRange && (
          <>
            <button type="button" className={trafficRange === 'all' ? 'active' : ''} onClick={() => setTrafficRange('all')}>
              全部
            </button>
            <button type="button" className={trafficRange === '7d' ? 'active' : ''} onClick={() => setTrafficRange('7d')}>
              7日
            </button>
            <button type="button" className={trafficRange === '30d' ? 'active' : ''} onClick={() => setTrafficRange('30d')}>
              30日
            </button>
          </>
        )}
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
      <div className={containerClass} ref={chartRef}>
        <HorizontalChart width={Math.max(120, shown.length * 82 * zoom)}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={shown} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={28} />
              <YAxis width={52} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value) => bytes(Number(value), false)} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8 }}
                labelFormatter={(value) => String(value)}
                formatter={(value, _name, item) => [bytes(Number(value)), (item as { dataKey?: string } | undefined)?.dataKey === 'total' ? '总流量' : (item as { dataKey?: string } | undefined)?.dataKey === 'uplink' ? '上行' : '下行']}
              />
              {TRAFFIC_LINES.filter((line) => !hidden.has(line.key)).map((line) => (
                <Line key={line.key} type="monotone" dataKey={line.key} name={line.label} stroke={line.stroke} strokeWidth={2} dot={false} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </HorizontalChart>
      </div>
      <div className="traffic-line-toggle">
        {TRAFFIC_LINES.map((line) => (
          <button
            type="button"
            key={line.key}
            className={hidden.has(line.key) ? 'off' : 'active'}
            style={{ '--line-color': line.stroke } as React.CSSProperties}
            onClick={() => toggleLine(line.key)}
          >
            <span className="dot" />
            {line.label}
          </button>
        ))}
      </div>
    </>
  )
}


export function TrafficDialog({ server, close }: { server: ProbeServer; close: () => void }) {
  const hasPeriod = hasTrafficPeriod(server)
  const [range, setRange] = useState<TrafficRange>(() => (hasPeriod ? 'period' : 'recent7'))
  const rows = dailyTrafficRows(server, range)
  const total = rows.reduce((sum, row) => sum + (row.total || row.uplink + row.downlink), 0)
  const formula = trafficFormulaLabel(server)
  return createPortal(
    <div className='modal-backdrop' role='presentation' onMouseDown={close}>
      <section className='modal' onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>{server.name} · 原始上下行日流量趋势</h2>
          <button type='button' aria-label='关闭' onClick={close}>
            ×
          </button>
        </header>
        <div className='traffic-dialog-toolbar'>
          <div className='traffic-range' role='group' aria-label='趋势范围'>
            {hasPeriod && (
              <button
                type='button'
                className={range === 'period' ? 'active' : ''}
                onClick={() => setRange('period')}
              >
                当前周期
              </button>
            )}
            <button
              type='button'
              className={range === 'recent7' ? 'active' : ''}
              onClick={() => setRange('recent7')}
            >
              最近 7 日
            </button>
          </div>
          <strong>
            {range === 'period' ? '当前周期' : '最近 7 日'}原始合计：{bytes(total, false)}
          </strong>
          <small>
            趋势展示原始上、下行，不应用计费方向或对账调整；卡片按{trafficRuleLabel(server)}计费
            {formula ? `（${formula}）` : ''}。
          </small>
        </div>
        {rows.length === 0 ? (
          <div className='empty traffic-empty'>暂无每日流量趋势数据</div>
        ) : (
          <TrafficChart daily={rows} containerClass='chart' showRange={false} />
        )}
      </section>
    </div>,
    document.body,
  )
}
