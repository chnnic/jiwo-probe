import type { ProbeBucket, ProbePingSeries, ProbeServer } from './types.ts'
import { expiryTimestamp } from './renewal.ts'

export function formatAxisDateTime(unixSeconds: number, showMinutes = true): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    ...(showMinutes ? { minute: '2-digit' } : {}),
    hour12: false,
  }).format(new Date(unixSeconds * 1000))
}


export function bytes(value = 0, decimal = true): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let n = Math.max(0, value)
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  if (i === 4) {
    return `${Math.abs(n - Math.round(n)) < 1e-9 ? n.toFixed(0) : n.toFixed(2)} ${units[i]}`
  }
  // 整数不标 .0 (如 1000 GB 而非 1000.0 GB, 含 toFixed 后恰为 X.0 的值)
  let out = n.toFixed(decimal && i >= 2 ? 1 : 0)
  if (out.endsWith('.0')) out = out.slice(0, -2)
  return `${out} ${units[i]}`
}

export function expiring(server: ProbeServer): boolean {
  const expiry = expiryTimestamp(server)
  if (expiry === undefined) return false
  const days = (expiry - Date.now()) / 86400000
  return days >= 0 && days <= 30
}

export function expired(server: ProbeServer): boolean {
  const expiry = expiryTimestamp(server)
  return expiry !== undefined && expiry < Date.now()
}

export function remainingDays(value?: string): string {
  if (!value) return ''
  const days = Math.ceil((new Date(`${value}T23:59:59`).getTime() - Date.now()) / 86400000)
  if (days < 0) return `已过期 ${Math.abs(days)} 天`
  if (days === 0) return '今天到期'
  return `剩余 ${days} 天`
}

export function regionFlag(region?: string): string {
  const points = [...(region?.trim() || '')].map((char) => char.codePointAt(0) || 0)
  if (points.length === 2 && points.every((point) => point >= 0x1f1e6 && point <= 0x1f1ff)) return region!.trim()
  const country = region
    ?.trim()
    .split(/[·,\s]+/)[0]
    ?.toUpperCase()
  if (!country || !/^[A-Z]{2}$/.test(country)) return ''
  return String.fromCodePoint(...[...country].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65))
}

export function hasLeadingFlag(value: string): boolean {
  return /^\p{Regional_Indicator}{2}/u.test(value.trim())
}

export function regionLabel(server: ProbeServer): string {
  const city = server.region_city?.trim()
  const area = server.region_name?.trim()
  const country = server.region_country?.trim()
  if (!city && !area) return ''
  return [city, area].filter(Boolean).join(' · ')
}

export function regionCountryLabel(server: ProbeServer): string {
  return server.region_country?.trim() || ''
}

export function pct(used = 0, total = 0): number {
  return total > 0 ? Math.min(100, (used * 100) / total) : 0
}


export function averagePing(series: ProbePingSeries[]): ProbePingSeries {
  const count = series[0]?.buckets.length || 0
  const buckets: ProbeBucket[] = Array.from({ length: count }, (_, index) => {
    const values = series.map((item) => item.buckets[index]).filter(Boolean)
    const ms = values.filter((v) => v.ms >= 0).map((v) => v.ms)
    const loss = values.filter((v) => v.loss >= 0).map((v) => v.loss)
    return {
      ms: ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : -1,
      loss: loss.length ? loss.reduce((a, b) => a + b, 0) / loss.length : -1,
    }
  })
  const current = series.filter((item) => item.current_ms >= 0).map((item) => item.current_ms)
  return {
    key: '__avg__',
    label: '平均',
    current_ms: current.length ? current.reduce((a, b) => a + b, 0) / current.length : -1,
    loss_pct: series.length ? series.reduce((sum, item) => sum + item.loss_pct, 0) / series.length : 0,
    buckets,
  }
}


export function lossScale(rows: Array<Record<string, string | number | null>>) {
  const peak = Math.max(
    0,
    ...rows.flatMap((row) =>
      Object.entries(row)
        .filter(([key]) => key !== 'time')
        .map(([, value]) => (typeof value === 'number' ? value : 0)),
    ),
  )
  const scales = [
    { max: 0.1, step: 0.025 },
    { max: 0.2, step: 0.05 },
    { max: 0.5, step: 0.1 },
    { max: 1, step: 0.25 },
    { max: 2, step: 0.5 },
    { max: 5, step: 1 },
    { max: 10, step: 2 },
    { max: 20, step: 5 },
    { max: 50, step: 10 },
    { max: 100, step: 25 },
  ]
  const selected = scales.find((item) => peak <= item.max) ?? scales[scales.length - 1]
  return {
    max: selected.max,
    ticks: Array.from(
      { length: Math.round(selected.max / selected.step) + 1 },
      (_, index) => Number((index * selected.step).toFixed(3)),
    ),
  }
}


export function formatLossTick(value: number): string {
  const digits = value < 0.1 ? 3 : value < 1 ? 2 : value < 10 ? 1 : 0
  return `${value.toFixed(digits).replace(/\.?0+$/, '')}%`
}
