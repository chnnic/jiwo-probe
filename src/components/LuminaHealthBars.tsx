import type { ProbeBucket } from '../types'

export const LUMINA_QUOTA_SEGMENTS = 18


export function luminaHeatColor(kind: 'latency' | 'loss', value: number): string {
  // 黑金配色: 延迟/丢包柱状条金色分档(低值暗金 → 高值亮金, 保留亮度层次)
  if (document.documentElement.classList.contains('gold')) {
    if (value < 0) return 'var(--progress-bg)'
    if (kind === 'latency') {
      if (value < 100) return '#c9a255'
      if (value < 200) return '#d8b46a'
      return '#f2d28b'
    }
    if (value < 1) return '#c9a255'
    if (value < 5) return '#d8b46a'
    return '#f2d28b'
  }
  // 白金配色: 直接用黑金延迟柱色(2026-08-15 用户要求, 主基调提亮)
  if (document.documentElement.classList.contains('platinum')) {
    if (value < 0) return 'var(--progress-bg)'
    if (kind === 'latency') {
      if (value < 100) return '#c9a255'
      if (value < 200) return '#d8b46a'
      return '#f2d28b'
    }
    if (value < 1) return '#c9a255'
    if (value < 5) return '#d8b46a'
    return '#f2d28b'
  }
  // 与延迟/丢包数值同色系(status tokens, 阈值仿原版 latency/loss bounds)
  if (kind === 'latency') {
    if (value < 100) return 'var(--lumina-health-good, var(--status-success))'
    if (value < 150) return 'var(--lumina-health-fair, #a3e635)'
    if (value < 200) return 'var(--lumina-health-warning, var(--status-warning))'
    if (value < 300) return 'var(--lumina-health-poor, #fb923c)'
    return 'var(--lumina-health-bad, var(--status-error))'
  }
  if (value < 1) return 'var(--lumina-health-good, var(--status-success))'
  if (value < 3) return 'var(--lumina-health-fair, #a3e635)'
  if (value < 5) return 'var(--lumina-health-warning, var(--status-warning))'
  if (value < 10) return 'var(--lumina-health-poor, #fb923c)'
  return 'var(--lumina-health-bad, var(--status-error))'
}


export function LuminaHealthBars({ buckets, kind }: { buckets: ProbeBucket[]; kind: 'latency' | 'loss' }) {
  const bars = buckets.slice(-LUMINA_QUOTA_SEGMENTS)
  const values = bars.map((b) => (kind === 'latency' ? b.ms : b.loss)).filter((v) => v >= 0)
  const max = Math.max(1, ...values)
  return (
    <span className="lumina-health-bars" data-kind={kind} aria-hidden>
      {bars.map((bucket, index) => {
        const raw = kind === 'latency' ? bucket.ms : bucket.loss
        const height = raw >= 0 ? (raw / max) * 100 : 8
        return (
          <span
            key={index}
            title={raw >= 0 ? (kind === 'latency' ? `延迟 ${Math.round(raw)} ms` : `丢包 ${raw.toFixed(1)}%`) : '无数据'}
            style={
              {
                '--bar-h': `${height}%`,
                '--bar-c': raw >= 0 ? luminaHeatColor(kind, raw) : 'var(--progress-bg)',
              } as React.CSSProperties
            }
          />
        )
      })}
    </span>
  )
}
