import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ForwardChainData } from '../types'

const latency = (value: number) => Number.isFinite(value) && value > 0 ? `${Math.round(value)} ms` : '—'
const time = (value: number) => new Date(value * 1000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })

/** 转发链的端到端延迟与丢包曲线。单独成模块：转发链面板折叠时不用下载 recharts。 */
export function ForwardTrendChart({ trend }: { trend: NonNullable<ForwardChainData['trend']> }) {
  return (
    <ResponsiveContainer width="100%" height="100%"><LineChart data={trend.map((point) => ({
      ...point,
      e2e_ms: Number.isFinite(point.e2e_ms) && point.e2e_ms >= 0 ? point.e2e_ms : null,
      loss: Number.isFinite(point.loss) && point.loss >= 0 ? point.loss : null,
    }))} margin={{ top: 10, left: 0, right: 0, bottom: 0 }}>
      <XAxis dataKey="ts" type="number" domain={['dataMin', 'dataMax']} tickFormatter={time} tick={{ fontSize: 11 }} minTickGap={30} axisLine={false} tickLine={false} />
      <YAxis yAxisId="ms" width={55} tick={{ fontSize: 11 }} tickFormatter={(value) => `${value} ms`} allowDecimals={false} tickCount={5} domain={[0, (max: number) => Math.max(4, Math.ceil(max * 1.15 / 4) * 4)]} axisLine={false} tickLine={false} />
      <YAxis yAxisId="loss" orientation="right" width={44} tickCount={3} allowDecimals={false} tick={{ fontSize: 11 }} tickFormatter={(value) => `${value}%`} domain={[0, (max: number) => Math.min(100, Math.max(10, Math.ceil(max / 10) * 10))]} axisLine={false} tickLine={false} />
      <Tooltip formatter={(value, name) => name === 'loss' ? [`${Number(value).toFixed(1)}%`, '丢包'] : [latency(Number(value)), '端到端延迟']} labelFormatter={(value) => time(Number(value))} />
      <Line yAxisId="ms" dataKey="e2e_ms" name="e2e_ms" type="linear" stroke="var(--ph-accent)" strokeWidth={2} dot={trend.length === 1} connectNulls={false} isAnimationActive={false} />
      <Line yAxisId="loss" dataKey="loss" name="loss" type="stepAfter" stroke="var(--fw-down)" strokeWidth={1.5} strokeDasharray="4 3" dot={trend.length === 1} connectNulls={false} isAnimationActive={false} />
    </LineChart></ResponsiveContainer>
  )
}
