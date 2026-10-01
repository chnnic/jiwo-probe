// Match the controller's 1–7 day retention and aggregation buckets.
export type ProbeRange = '1h' | '6h' | '24h' | '2d' | '3d' | '4d' | '5d' | '6d' | '7d'
export type ProbeRangeOption = { key: ProbeRange; label: string }

export function probeHistoryDays(value?: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(7, Math.max(1, Math.floor(value))) : 1
}

export function probeRangeOptions(historyDays?: number): ProbeRangeOption[] {
  const options: ProbeRangeOption[] = [
    { key: '1h', label: '1 小时' }, { key: '6h', label: '6 小时' }, { key: '24h', label: '24 小时' },
  ]
  const days = probeHistoryDays(historyDays)
  const picks = [3, 7].filter(day => day <= days)
  if (days >= 2 && !picks.includes(days)) picks.push(days)
  for (const day of picks.sort((a, b) => a - b)) options.push({ key: `${day}d` as ProbeRange, label: `${day} 天` })
  return options
}

export function effectiveProbeRange(range: ProbeRange, options: ProbeRangeOption[]): ProbeRange {
  return options.some(option => option.key === range) ? range : '1h'
}

export function probeRangeBucketSec(range: ProbeRange): number {
  if (range === '1h') return 300
  if (range === '6h') return 600
  if (range === '24h') return 1800
  return Number.parseInt(range, 10) <= 3 ? 3600 : 7200
}

export function probeBucketLabel(seconds: number): string {
  return seconds >= 3600 ? `${seconds / 3600} 小时` : `${seconds / 60} 分钟`
}
