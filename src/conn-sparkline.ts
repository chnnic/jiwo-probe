import type { ProbeConnHistory } from './types.ts'

const sample = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0

// 同步主控/上游的 5 分钟桶口径；两条曲线必须共用时间和从零起的纵轴。
export function normalizeConnHistory(history?: ProbeConnHistory): ProbeConnHistory | undefined {
  if (!history) return undefined
  const tcp = Array.isArray(history.tcp) ? history.tcp : []
  const udp = Array.isArray(history.udp) ? history.udp : []
  const length = Math.max(tcp.length, udp.length)
  const clean = (values: (number | null)[]) => Array.from({ length }, (_, i) => sample(values[i]) ? values[i] : null)
  return { tcp: clean(tcp), udp: clean(udp) }
}

export function connSparklineMax(history: ProbeConnHistory): number {
  return Math.max(0, ...history.tcp.filter(sample), ...history.udp.filter(sample))
}

export function connSparklinePath(values: (number | null)[], max: number, width = 120, height = 40, pad = 3): string {
  const round = (n: number) => Math.round(n * 100) / 100
  const x = (i: number) => values.length <= 1 ? width / 2 : i / (values.length - 1) * width
  const y = (v: number) => pad + (height - pad * 2) * (1 - v / (max > 0 ? max : 1))
  return values.reduce<string>((path, value, i) => {
    if (!sample(value)) return path
    const continuation = sample(values[i - 1])
    const isolated = !continuation && !sample(values[i + 1])
    return path + `${continuation ? 'L' : 'M'}${round(x(i))} ${round(y(value))}${isolated ? 'h0.01' : ''}`
  }, '')
}

export function connHoverIndex(fraction: number, length: number): number {
  return Math.max(0, Math.min(length - 1, Math.round(fraction * (length - 1))))
}

export function connBucketLabel(index: number, length: number): string {
  const ago = (length - 1 - index) * 5
  return ago <= 0 ? '最近 5 分钟' : `约 ${ago} 分钟前`
}
