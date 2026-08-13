import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Globe2,
  Gauge,
  Layers,
  Palette,
  Radio,
  Server,
  ShieldCheck,
  Sparkles,
  Target,
  X,
  XCircle,
} from 'lucide-react'
import type {
  ProbePingSeries,
  ProbeServer,
  ProbePayload,
} from './types'
import { Twemoji } from './Twemoji'
import { EXTRA_LICENSE_BADGES, HEADER_LICENSE_BADGES } from './license-badges'
import { FLAG_OPTIONS } from './country-flag'
import { displayServerName } from './server-name'
import { BlackGoldGlobe, type PremiumProbeRegion } from './BlackGoldGlobe'
import './premium-probe.css'

type ProbeData = ProbePayload

function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}

const LICENSE_CYCLE_MS = 5500
const LICENSE_REVEAL_END = 0.36
const licenseStarPalette = ['#8c5d17', '#d7a63d', '#f2d78a', '#fff1b9', '#c78e24']
const licenseClamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value
const licenseRandom = (min: number, max: number) => min + Math.random() * (max - min)
const licenseEaseOutBack = (value: number) => {
  const strength = 1.70158
  return (
    1 +
    (strength + 1) * Math.pow(value - 1, 3) +
    strength * Math.pow(value - 1, 2)
  )
}
const licenseEaseInBack = (value: number) => {
  const strength = 1.70158
  return (strength + 1) * value * value * value - strength * value * value
}

function LicenseNameplate({ label }: { label: string }) {
  const plateRef = useRef<HTMLSpanElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const starsRef = useRef<HTMLSpanElement>(null)
  const shineRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const plate = plateRef.current
    const text = textRef.current
    const stars = starsRef.current
    const shine = shineRef.current
    if (!plate || !text || !stars || !shine) return

    stars.innerHTML = ''
    const height = stars.clientHeight || 24
    const makeStar = (topFor: (size: number) => number) => {
      const star = document.createElement('i')
      star.className = 'spark'
      star.style.color =
        licenseStarPalette[Math.floor(Math.random() * licenseStarPalette.length)]
      const size = Math.round(licenseRandom(8, 13))
      star.style.width = `${size}px`
      star.style.height = `${size}px`
      star.style.top = `${Math.round(topFor(size))}px`
      star.style.left = `${Math.round(licenseRandom(0, 12))}px`
      stars.appendChild(star)
    }
    for (let index = 0; index < 5; index++) {
      makeStar((size) => licenseRandom(0, Math.max(0, height - size)))
    }
    makeStar((size) => -size * 0.6)
    makeStar((size) => height - size * 0.4)

    let width = plate.offsetWidth
    const updateWidth = () => {
      width = plate.offsetWidth
    }
    window.addEventListener('resize', updateWidth)

    let frameID = 0
    const start = performance.now()
    const frame = (now: number) => {
      const progress = ((now - start) % LICENSE_CYCLE_MS) / LICENSE_CYCLE_MS
      const reveal = licenseClamp(progress / LICENSE_REVEAL_END, 0, 1)
      let rotateX = 0
      let scale = 1
      let opacity = 1
      if (progress < 0.08) {
        const amount = progress / 0.08
        const eased = licenseEaseOutBack(amount)
        rotateX = -92 * (1 - eased)
        scale = 0.86 + 0.14 * eased
        opacity = licenseClamp(amount * 2.2, 0, 1)
      } else if (progress > 0.85) {
        const amount = (progress - 0.85) / 0.15
        const eased = licenseEaseInBack(amount)
        rotateX = 84 * eased
        scale = 1 - 0.14 * eased
        opacity = licenseClamp(1 - amount * 1.5, 0, 1)
      }
      const starOpacity =
        progress < 0.04
          ? progress / 0.04
          : progress < 0.32
            ? 1
            : progress < 0.37
              ? licenseClamp(1 - (progress - 0.32) / 0.05, 0, 1)
              : 0
      const shineProgress = licenseClamp((progress - 0.42) / 0.28, 0, 1)
      const shineActive = progress >= 0.42 && progress <= 0.7
      const shineOpacity = shineActive
        ? shineProgress < 0.1
          ? shineProgress / 0.1
          : shineProgress > 0.85
            ? licenseClamp((1 - shineProgress) / 0.15, 0, 1)
            : 1
        : 0

      plate.style.opacity = String(opacity)
      plate.style.transform = `perspective(340px) rotateX(${rotateX.toFixed(2)}deg) scale(${scale.toFixed(3)})`
      text.style.clipPath = `inset(0 ${((1 - reveal) * 100).toFixed(2)}% 0 0)`
      stars.style.transform = `translateX(${(13 + reveal * (width - 26)).toFixed(1)}px)`
      stars.style.opacity = String(starOpacity)
      shine.style.transform = `translateX(${(((-55 + shineProgress * 165) / 100) * width).toFixed(1)}px) skewX(-16deg)`
      shine.style.opacity = String(shineOpacity)
      frameID = requestAnimationFrame(frame)
    }
    frameID = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(frameID)
      window.removeEventListener('resize', updateWidth)
    }
  }, [])

  return (
    <span ref={plateRef} className='license-nameplate'>
      <span ref={textRef} className='np-text'>{label}</span>
      <span className='np-shine-clip' aria-hidden='true'>
        <span ref={shineRef} className='np-shine' />
      </span>
      <span ref={starsRef} className='np-stars' aria-hidden='true' />
    </span>
  )
}

function formatTrafficCompact(value = 0): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let size = Math.max(0, value)
  let index = 0
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index++
  }
  const digits = index === 0 || size >= 100 ? 0 : size >= 10 ? 1 : 2
  return `${size.toFixed(digits)} ${units[index]}`
}

type PremiumProbePageProps = {
  data?: ProbeData
  isLoading: boolean
  isError: boolean
  // 主题切换回调（经典界面 ThemeSelect 同款语义: name=null 表示跟随主控）
  onThemeChange?: (name: 'pixel' | 'flat' | 'anime' | 'glass' | 'lumina' | 'premium' | 'ran' | 'glassmorphism' | null) => void
}

type StatusFilter = 'all' | 'online' | 'offline'
type PremiumProbeView = 'card' | 'network' | 'resource'

const PREMIUM_THEME_OPTIONS: { value: 'pixel' | 'flat' | 'anime' | 'glass' | 'lumina' | 'premium' | 'ran' | 'glassmorphism'; label: string }[] = [
  { value: 'pixel', label: '像素' },
  { value: 'flat', label: '扁平' },
  { value: 'anime', label: '动漫' },
  { value: 'glass', label: '玻璃' },
  { value: 'lumina', label: 'Lumina' },
  { value: 'premium', label: 'Premium' },
  { value: 'ran', label: '岚 · Ran' },
  { value: 'glassmorphism', label: 'Glassmorphism' },
]

// 主题切换下拉（黑金风）。当前必然是 premium（本页就是），选择其他主题或"跟随主控"时回调上层切换。
function PremiumThemeSelect({ onThemeChange }: { onThemeChange?: PremiumProbePageProps['onThemeChange'] }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handle = (event: MouseEvent) => {
      if (wrapRef.current?.contains(event.target as Node)) return
      if (menuRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const pick = (name: 'pixel' | 'flat' | 'anime' | 'glass' | 'lumina' | 'premium' | 'ran' | 'glassmorphism' | null) => {
    setOpen(false)
    if (name === 'premium') return // 已在 Premium，无需切换
    onThemeChange?.(name)
  }

  return (
    <div className='premium-probe-theme-select' ref={wrapRef}>
      <button
        type='button'
        className='premium-probe-login premium-probe-theme-trigger'
        aria-haspopup='listbox'
        aria-expanded={open}
        aria-label='切换主题'
        title='切换主题'
        onClick={() => setOpen((v) => !v)}
      >
        <Palette />
        <ChevronDown size={13} className={open ? 'rotated' : undefined} />
      </button>
      {open && (
        <div className='premium-probe-theme-menu' ref={menuRef} role='listbox'>
          <button type='button' role='option' aria-selected={false} onClick={() => pick(null)}>
            <span>跟随主控</span>
          </button>
          {PREMIUM_THEME_OPTIONS.map((opt) => (
            <button type='button' role='option' aria-selected={opt.value === 'premium'} key={opt.value} onClick={() => pick(opt.value)}>
              <span>{opt.label}</span>
              {opt.value === 'premium' && <CheckCircle2 size={13} className='premium-probe-theme-check' />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

type TrendSample = {
  label: string
  value: number
  formatted: string
}

function StandaloneLicenseBadge({
  badge,
  className,
  animated = false,
}: {
  badge?: ProbePayload['license_badge']
  className?: string
  animated?: boolean
}) {
  // 本地支持多勋章: 数组取首个（与经典界面 Footer 合并展示不同, Premium 单铭牌位）
  const first = Array.isArray(badge) ? badge[0] : badge
  const label = [first?.name?.trim(), first?.display_name?.trim()]
    .filter(Boolean)
    .join(' · ')
  if (!label) return null
  return (
    <span className={cn('premium-probe-license-badge', className)}>
      {animated ? (
        <LicenseNameplate label={label} />
      ) : (
        <span className='premium-probe-license-name'>{label}</span>
      )}
    </span>
  )
}

const regionNames = Object.fromEntries(
  FLAG_OPTIONS.map((item) => [item.code, item.label])
)

const placeNames: Record<string, string> = {
  tokyo: '东京',
  osaka: '大阪',
  taichung: '台中',
  taipei: '台北',
  'hong kong': '香港',
  singapore: '新加坡',
  seoul: '首尔',
  'los angeles': '洛杉矶',
  'san jose': '圣何塞',
  frankfurt: '法兰克福',
  london: '伦敦',
}

function flagToCountryCode(value?: string): string {
  const points = [...(value?.trim() || '')].map(
    (character) => character.codePointAt(0) || 0
  )
  if (
    points.length === 2 &&
    points.every((point) => point >= 0x1f1e6 && point <= 0x1f1ff)
  ) {
    return points
      .map((point) => String.fromCharCode(point - 0x1f1e6 + 65))
      .join('')
  }
  const code =
    value
      ?.trim()
      .split(/[·,\s]+/)[0]
      ?.toUpperCase() || ''
  return /^[A-Z]{2}$/.test(code) ? code : ''
}

function countryFlag(code?: string): string {
  if (!code || !/^[A-Z]{2}$/i.test(code)) return ''
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map(
      (character) => 0x1f1e6 + character.charCodeAt(0) - 65
    )
  )
}

function localizedRegionLabel(server: ProbeServer, code?: string): string {
  const normalizedCode = code || serverRegionKey(server)
  const flag = countryFlag(normalizedCode)
  const country = regionNames[normalizedCode] || ''
  const rawPlace = server.region_city || server.region_name || ''
  const normalizedPlace = rawPlace.trim().replace(/[，,、·\s]+$/u, '')
  const place = placeNames[normalizedPlace.toLowerCase()] || normalizedPlace
  const detail =
    place && place !== country
      ? [country, place].filter(Boolean).join(' · ')
      : country || place
  return [flag, detail || server.region || '未知地区'].filter(Boolean).join(' ')
}

function formatBitSpeed(bytesPerSecond: number): string {
  let value = Math.max(0, bytesPerSecond) * 8
  const units = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps']
  let unit = 0
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000
    unit++
  }
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[unit]}`
}

function formatAxisDateTime(unixSeconds: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(unixSeconds * 1000))
}

function averageLatency(server: ProbeServer): number | undefined {
  const values = (server.ping || [])
    .map((series) => series.current_ms)
    .filter((value) => value >= 0)
  if (!values.length) return undefined
  return Math.round(
    values.reduce((total, value) => total + value, 0) / values.length
  )
}

function percentage(used?: number, total?: number): number {
  if (!total || total <= 0) return 0
  return Math.min(100, Math.max(0, (Number(used || 0) / total) * 100))
}

function resourcePercentage(used?: number, total?: number): number | undefined {
  if (used === undefined || !total) return undefined
  return percentage(used, total)
}

function serverRegionKey(server: ProbeServer): string {
  return (
    server.region_country ||
    flagToCountryCode(server.region) ||
    server.region?.trim() ||
    'UNKNOWN'
  ).toUpperCase()
}

function buildRegions(servers: ProbeServer[]): PremiumProbeRegion[] {
  const groups = new Map<string, ProbeServer[]>()
  for (const server of servers) {
    const key = serverRegionKey(server)
    const group = groups.get(key) || []
    group.push(server)
    groups.set(key, group)
  }
  return [...groups].map(([code, group]) => {
    const sample = group[0]
    return {
      code,
      label: localizedRegionLabel(sample, code),
      total: group.length,
      online: group.filter((server) => server.online).length,
    }
  })
}

export type HealthResult = {
  score: number
  label: '卓越' | '良好' | '注意' | '异常'
  tone: 'excellent' | 'good' | 'warning' | 'critical'
  issues: string[]
}

export function serverHealth(server: ProbeServer): HealthResult {
  if (!server.online) {
    return { score: 0, label: '异常', tone: 'critical', issues: ['服务器离线'] }
  }
  let score = 100
  const issues: string[] = []
  const mem = resourcePercentage(server.mem_used, server.mem_total)
  const disk = resourcePercentage(server.disk_used, server.disk_total)
  const resources = [
    ['CPU', server.cpu_pct],
    ['内存', mem],
    ['硬盘', disk],
  ] as const
  for (const [name, value] of resources) {
    if (value === undefined) continue
    if (value >= 90) {
      score -= 18
      issues.push(`${name}压力过高`)
    } else if (value >= 75) {
      score -= 9
      issues.push(`${name}压力偏高`)
    }
  }
  const latency = averageLatency(server)
  const losses = (server.ping || [])
    .map((item) => item.loss_pct)
    .filter((value) => value >= 0)
  const loss = losses.length
    ? losses.reduce((total, value) => total + value, 0) / losses.length
    : undefined
  if (latency !== undefined && latency >= 250) {
    score -= 18
    issues.push('网络延迟过高')
  } else if (latency !== undefined && latency >= 120) {
    score -= 8
    issues.push('网络延迟偏高')
  }
  if (loss !== undefined && loss >= 10) {
    score -= 20
    issues.push('丢包严重')
  } else if (loss !== undefined && loss >= 3) {
    score -= 9
    issues.push('存在丢包')
  }
  if (server.traffic_limit) {
    const used = server.traffic_used ?? server.traffic_used_total ?? 0
    const quota = percentage(used, server.traffic_limit)
    if (quota >= 95) {
      score -= 16
      issues.push('流量额度即将耗尽')
    } else if (quota >= 80) {
      score -= 7
      issues.push('流量额度偏高')
    }
  }
  if (server.expires_at) {
    const days = Math.ceil(
      (new Date(`${server.expires_at}T00:00:00`).getTime() - Date.now()) /
        86400000
    )
    if (days < 0) {
      score -= 20
      issues.push('服务器已到期')
    } else if (days <= 14) {
      score -= 8
      issues.push('服务器即将到期')
    }
  }
  score = Math.max(0, Math.round(score))
  if (score >= 90) return { score, label: '卓越', tone: 'excellent', issues }
  if (score >= 75) return { score, label: '良好', tone: 'good', issues }
  if (score >= 55) return { score, label: '注意', tone: 'warning', issues }
  return { score, label: '异常', tone: 'critical', issues }
}

function displayReturnRoute(route: string): string {
  return route.toUpperCase().replace(/[^A-Z0-9]/g, '') === 'CMIN'
    ? 'CMI'
    : route
}

function summarizeSevenDayTraffic(servers: ProbeServer[]) {
  const trafficDates = servers
    .flatMap((server) => server.daily_traffic || [])
    .map((item) => item.date)
    .sort()
  const latest = trafficDates[trafficDates.length - 1]
  if (!latest) return []
  const end = new Date(`${latest}T00:00:00Z`)
  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(end)
    current.setUTCDate(end.getUTCDate() - 6 + index)
    const date = current.toISOString().slice(0, 10)
    let uplink = 0
    let downlink = 0
    for (const server of servers) {
      const day = server.daily_traffic?.find((item) => item.date === date)
      uplink += day?.uplink || 0
      downlink += day?.downlink || 0
    }
    return { date, uplink, downlink, total: uplink + downlink }
  })
}

function resourcePressureRows(servers: ProbeServer[]) {
  return servers
    .map((server, index) => {
      const cpu = server.cpu_pct
      const mem = resourcePercentage(server.mem_used, server.mem_total)
      const disk = resourcePercentage(server.disk_used, server.disk_total)
      return {
        index,
        name: server.name || `#${index + 1}`,
        cpu,
        mem,
        disk,
        pressure: Math.max(cpu ?? -1, mem ?? -1, disk ?? -1),
      }
    })
    .sort((left, right) => right.pressure - left.pressure)
}

function trafficQuotaRows(servers: ProbeServer[]) {
  return servers
    .map((server, index) => ({
      index,
      name: server.name || `#${index + 1}`,
      used: server.traffic_used ?? server.traffic_used_total ?? 0,
      limit: server.traffic_limit || 0,
    }))
    .filter((item) => item.limit > 0)
    .map((item) => ({ ...item, percent: percentage(item.used, item.limit) }))
    .sort((left, right) => right.percent - left.percent)
}

function renewalTimelineRows(servers: ProbeServer[]) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return servers
    .map((server, index) => {
      if (!server.expires_at) return undefined
      const expiresAt = new Date(`${server.expires_at}T00:00:00`)
      const days = Math.ceil((expiresAt.getTime() - now.getTime()) / 86400000)
      const price =
        server.renewal_price_cny ??
        (server.renewal_currency === 'CNY' ? server.renewal_price : undefined)
      const cycleMonths = {
        month: 1,
        quarter: 3,
        half_year: 6,
        year: 12,
      }[server.renewal_cycle || 'month']
      return {
        index,
        name: server.name || `#${index + 1}`,
        expiresAt: server.expires_at,
        days,
        price,
        monthlyPrice: price === undefined ? undefined : price / cycleMonths,
      }
    })
    .filter((item): item is NonNullable<typeof item> => !!item)
    .sort((left, right) => left.expiresAt.localeCompare(right.expiresAt))
}

function RenewalTimeline({
  rows,
}: {
  rows: ReturnType<typeof renewalTimelineRows>
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef({ active: false, startX: 0, scrollLeft: 0 })
  const currentMonth = new Date().toISOString().slice(0, 7)
  const monthlyTotal = rows.reduce(
    (total, item) => total + (item.monthlyPrice || 0),
    0
  )
  const unpaidThisMonth = rows
    .filter((item) => item.expiresAt.startsWith(currentMonth))
    .reduce((total, item) => total + (item.price || 0), 0)

  return (
    <>
      <div className='premium-probe-renewal-totals'>
        <div>
          <span>月度折算总额</span>
          <strong>¥{monthlyTotal.toFixed(2)}</strong>
        </div>
        <div>
          <span>本月未续费金额</span>
          <strong>¥{unpaidThisMonth.toFixed(2)}</strong>
        </div>
        <small>按住时间轴可横向拖动</small>
      </div>
      {rows.length === 0 ? (
        <p className='premium-probe-insights-empty'>暂无可用数据</p>
      ) : (
        <div
          ref={trackRef}
          className='premium-probe-renewals'
          onPointerDown={(event) => {
            const track = trackRef.current
            if (!track) return
            dragRef.current = {
              active: true,
              startX: event.clientX,
              scrollLeft: track.scrollLeft,
            }
            track.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            const track = trackRef.current
            if (!track || !dragRef.current.active) return
            track.scrollLeft =
              dragRef.current.scrollLeft -
              (event.clientX - dragRef.current.startX)
          }}
          onPointerUp={() => {
            dragRef.current.active = false
          }}
          onPointerCancel={() => {
            dragRef.current.active = false
          }}
        >
          <div className='premium-probe-renewal-track'>
            {rows.map((item) => (
              <div
                key={item.index}
                className={
                  item.days < 0
                    ? 'is-expired'
                    : item.days <= 30
                      ? 'is-due'
                      : undefined
                }
              >
                <time>{item.expiresAt}</time>
                <i />
                <Twemoji className='premium-probe-server-name'>
                  {item.name}
                </Twemoji>
                <strong>
                  {item.days < 0
                    ? `已过期 ${Math.abs(item.days)} 天`
                    : item.days === 0
                      ? '今天到期'
                      : `${item.days} 天后`}
                </strong>
                {item.price !== undefined && (
                  <small>¥{item.price.toFixed(2)}</small>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function BillingOverview({ servers }: { servers: ProbeServer[] }) {
  const cycleMonths = {
    month: 1,
    quarter: 3,
    half_year: 6,
    year: 12,
  } as const
  const cycleLabels = {
    month: '月付',
    quarter: '季付',
    half_year: '半年付',
    year: '年付',
  } as const
  const rows = servers
    .map((server, index) => {
      const price =
        server.renewal_price_cny ??
        (server.renewal_currency === 'CNY' ? server.renewal_price : undefined)
      if (price === undefined) return undefined
      const cycle = server.renewal_cycle || 'month'
      return {
        index,
        name: server.name || `#${index + 1}`,
        cycle: cycleLabels[cycle],
        monthly: price / cycleMonths[cycle],
      }
    })
    .filter((item): item is NonNullable<typeof item> => !!item)
    .sort((left, right) => right.monthly - left.monthly)
  const monthlyTotal = rows.reduce((total, item) => total + item.monthly, 0)
  const dueIn30Days = renewalTimelineRows(servers)
    .filter((item) => item.days >= 0 && item.days <= 30)
    .reduce((total, item) => total + (item.price || 0), 0)
  const maxMonthly = Math.max(1, ...rows.map((item) => item.monthly))

  return (
    <article className='premium-probe-insight-card premium-probe-billing-card'>
      <header>
        <h3>
          <CreditCard />
          账单与成本分析
        </h3>
        <span>按人民币月均折算</span>
      </header>
      {rows.length === 0 ? (
        <p className='premium-probe-insights-empty'>暂无人民币续费价格数据</p>
      ) : (
        <div className='premium-probe-billing-layout'>
          <div className='premium-probe-billing-kpis'>
            <div>
              <span>月均基础成本</span>
              <strong>¥{monthlyTotal.toFixed(2)}</strong>
            </div>
            <div>
              <span>年化预算</span>
              <strong>¥{(monthlyTotal * 12).toFixed(2)}</strong>
            </div>
            <div>
              <span>未来 30 天应续</span>
              <strong>¥{dueIn30Days.toFixed(2)}</strong>
            </div>
            <div>
              <span>价格数据覆盖</span>
              <strong>
                {rows.length}/{servers.length} 台
              </strong>
            </div>
          </div>
          <div className='premium-probe-billing-rank'>
            <div className='is-head'>
              <span>月均成本排行</span>
              <small>折算金额</small>
            </div>
            {rows.slice(0, 6).map((item) => (
              <div key={item.index}>
                <Twemoji>{item.name}</Twemoji>
                <i>
                  <b
                    style={{ width: `${(item.monthly / maxMonthly) * 100}%` }}
                  />
                </i>
                <strong>¥{item.monthly.toFixed(2)}</strong>
                <small>{item.cycle}</small>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  )
}

function DataInsightPanels({
  servers,
  showTraffic7D,
  showResourceHeatmap,
  showTrafficQuota,
  showRenewalTimeline,
}: {
  servers: ProbeServer[]
  showTraffic7D: boolean
  showResourceHeatmap: boolean
  showTrafficQuota: boolean
  showRenewalTimeline: boolean
}) {
  const traffic = summarizeSevenDayTraffic(servers)
  const heatmap = resourcePressureRows(servers)
  const quota = trafficQuotaRows(servers)
  const renewals = renewalTimelineRows(servers)
  const maxTraffic = Math.max(1, ...traffic.map((item) => item.total))
  const primaryInsightCount =
    Number(showTraffic7D) +
    Number(showResourceHeatmap) +
    Number(showTrafficQuota)
  const heatColor = (value?: number) => {
    if (value === undefined) return 'rgba(255,255,255,.035)'
    if (value >= 85) return 'rgba(239,91,100,.72)'
    if (value >= 60) return 'rgba(224,156,58,.62)'
    return `rgba(216,180,106,${0.16 + value / 180})`
  }
  const empty = <p className='premium-probe-insights-empty'>暂无可用数据</p>

  return (
    <section
      className={cn(
        'premium-probe-insights',
        `has-${primaryInsightCount}-primary`
      )}
    >
      {showTraffic7D && (
        <article className='premium-probe-insight-card'>
          <header>
            <h3>
              <Activity />近 7 日上下行流量
            </h3>
            <span>
              <i className='is-down' />
              下行 <i className='is-up' />
              上行
            </span>
          </header>
          {traffic.length === 0 ? (
            empty
          ) : (
            <div className='premium-probe-seven-days'>
              {traffic.map((item) => (
                <div
                  key={item.date}
                  title={`${item.date} · ${formatTrafficCompact(item.total)}`}
                >
                  <div>
                    <i
                      className='is-up'
                      style={{ height: `${(item.uplink / maxTraffic) * 100}%` }}
                    />
                    <i
                      className='is-down'
                      style={{
                        height: `${(item.downlink / maxTraffic) * 100}%`,
                      }}
                    />
                  </div>
                  <span>{item.date.slice(5).replace('-', '/')}</span>
                </div>
              ))}
            </div>
          )}
        </article>
      )}

      {showResourceHeatmap && (
        <article className='premium-probe-insight-card'>
          <header>
            <h3>
              <Gauge />
              资源压力热力图
            </h3>
            <span>CPU · MEM · DISK</span>
          </header>
          {heatmap.length === 0 ? (
            empty
          ) : (
            <div className='premium-probe-heatmap'>
              <div className='is-head'>
                <span>服务器</span>
                <b>CPU</b>
                <b>内存</b>
                <b>硬盘</b>
              </div>
              {heatmap.map((item) => (
                <div key={item.index}>
                  <Twemoji className='premium-probe-server-name'>
                    {item.name}
                  </Twemoji>
                  {[item.cpu, item.mem, item.disk].map((value, index) => (
                    <b key={index} style={{ background: heatColor(value) }}>
                      {value === undefined ? '—' : `${value.toFixed(0)}%`}
                    </b>
                  ))}
                </div>
              ))}
            </div>
          )}
        </article>
      )}

      {showTrafficQuota && (
        <article className='premium-probe-insight-card'>
          <header>
            <h3>
              <Gauge />
              流量额度使用率排行
            </h3>
            <span>{quota.length} 台有限额</span>
          </header>
          {quota.length === 0 ? (
            empty
          ) : (
            <div className='premium-probe-quota-rank'>
              {quota.map((item, rank) => (
                <div key={item.index}>
                  <em>{rank + 1}</em>
                  <Twemoji className='premium-probe-server-name'>
                    {item.name}
                  </Twemoji>
                  <i>
                    <b style={{ width: `${item.percent}%` }} />
                  </i>
                  <strong>{item.percent.toFixed(0)}%</strong>
                  <small>
                    {formatTrafficCompact(item.used)} /{' '}
                    {formatTrafficCompact(item.limit)}
                  </small>
                </div>
              ))}
            </div>
          )}
        </article>
      )}

      {showRenewalTimeline && <BillingOverview servers={servers} />}

      {showRenewalTimeline && (
        <article className='premium-probe-insight-card premium-probe-renewal-card'>
          <header>
            <h3>
              <CalendarClock />
              服务器续费与到期时间轴
            </h3>
            <span>按到期日排序</span>
          </header>
          <RenewalTimeline rows={renewals} />
        </article>
      )}
    </section>
  )
}

function PremiumResourceOverview({
  servers,
  visibility,
}: {
  servers: ProbeServer[]
  visibility: {
    traffic7D: boolean
    resourceHeatmap: boolean
    trafficQuota: boolean
    renewalTimeline: boolean
  }
}) {
  const enabledCount = Object.values(visibility).filter(Boolean).length

  return (
    <section className='premium-probe-resource-view'>
      <SmartSummary servers={servers} />
      <header className='premium-probe-resource-heading'>
        <div>
          <span>
            <Gauge />
          </span>
          <div>
            <h2>资源概况</h2>
            <p>集中查看集群资源、流量额度与服务器续费状态</p>
          </div>
        </div>
        <strong>
          {servers.length} 台服务器 · {enabledCount} 个模块
        </strong>
      </header>

      {enabledCount > 0 ? (
        <DataInsightPanels
          servers={servers}
          showTraffic7D={visibility.traffic7D}
          showResourceHeatmap={visibility.resourceHeatmap}
          showTrafficQuota={visibility.trafficQuota}
          showRenewalTimeline={visibility.renewalTimeline}
        />
      ) : (
        <div className='premium-probe-resource-empty'>
          主控暂未启用资源概况模块
        </div>
      )}
    </section>
  )
}

function SmartSummary({ servers }: { servers: ProbeServer[] }) {
  const online = servers.filter((server) => server.online).length
  const attention = servers.filter(
    (server) => serverHealth(server).score < 75
  ).length
  const due = renewalTimelineRows(servers).filter(
    (item) => item.days >= 0 && item.days <= 14
  ).length
  const lossy = servers
    .map((server) => ({
      server,
      loss: Math.max(-1, ...(server.ping || []).map((item) => item.loss_pct)),
    }))
    .sort((left, right) => right.loss - left.loss)[0]
  const parts = [`${online}/${servers.length} 台服务器在线`]
  if (attention > 0) parts.push(`${attention} 台需要关注`)
  if (lossy?.loss >= 3)
    parts.push(
      `${localizedRegionLabel(lossy.server)}节点最高丢包 ${lossy.loss.toFixed(1)}%`
    )
  if (due > 0) parts.push(`${due} 台将在 14 天内到期`)
  if (parts.length === 1 && online === servers.length && servers.length > 0)
    parts.push('当前未发现明显异常')

  return (
    <section className='premium-probe-smart-summary'>
      <ShieldCheck />
      <div>
        <span>智能运行摘要</span>
        <strong>{parts.join('，')}。</strong>
      </div>
    </section>
  )
}

function SpeedSnapshot({
  label,
  value,
  samples,
}: {
  label: string
  value: string
  samples: TrendSample[]
}) {
  return (
    <div className='premium-probe-speed-snapshot'>
      <div className='premium-probe-speed-heading'>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <InteractiveTrend samples={samples} />
      <div className='premium-probe-speed-meta'>
        <small>逐次推送 · 秒级时间</small>
        <small>{samples.length} 个实时采样点</small>
      </div>
    </div>
  )
}

function chartPath(samples: number[], fixedCeiling?: number) {
  if (!samples.length)
    return { line: '', area: '', points: [], last: undefined }
  const width = 260
  const height = 54
  const baseline = height - 3
  const ceiling = fixedCeiling || Math.max(...samples, 1) * 1.08
  const points = samples.map((sample, index) => ({
    x: samples.length === 1 ? width : (index / (samples.length - 1)) * width,
    y:
      baseline -
      (Math.min(ceiling, Math.max(0, sample)) / ceiling) * (height - 10),
  }))
  const line = points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
    )
    .join(' ')
  return {
    line,
    area: `${line} L ${width} ${baseline} L ${points[0].x.toFixed(2)} ${baseline} Z`,
    points,
    last: points[points.length - 1],
  }
}

function InteractiveTrend({
  samples,
  compact = false,
  showArea = true,
}: {
  samples: TrendSample[]
  compact?: boolean
  showArea?: boolean
}) {
  const [activeIndex, setActiveIndex] = useState<number>()
  const chart = chartPath(samples.map((sample) => sample.value))
  const activeSample =
    activeIndex === undefined ? undefined : samples[activeIndex]
  const activePoint =
    activeIndex === undefined ? undefined : chart.points[activeIndex]
  const tooltipLeft = activePoint
    ? Math.max(12, Math.min(88, (activePoint.x / 260) * 100))
    : 50

  return (
    <div
      className={cn(
        'premium-probe-speed-chart premium-probe-interactive-chart',
        compact && 'is-compact'
      )}
      onPointerMove={(event) => {
        if (!samples.length) return
        const bounds = event.currentTarget.getBoundingClientRect()
        const ratio = Math.max(
          0,
          Math.min(1, (event.clientX - bounds.left) / bounds.width)
        )
        setActiveIndex(Math.round(ratio * (samples.length - 1)))
      }}
      onPointerLeave={() => setActiveIndex(undefined)}
    >
      <svg viewBox='0 0 260 54' preserveAspectRatio='none' aria-hidden='true'>
        <line x1='0' y1='51' x2='260' y2='51' />
        {samples.length > 1 && showArea && (
          <path className='is-area' d={chart.area} />
        )}
        {samples.length > 1 && <path className='is-line' d={chart.line} />}
        {chart.last && !activePoint && (
          <circle cx={chart.last.x} cy={chart.last.y} r='2.5' />
        )}
        {activePoint && (
          <>
            <line
              className='is-cursor'
              x1={activePoint.x}
              y1='3'
              x2={activePoint.x}
              y2='51'
            />
            <circle cx={activePoint.x} cy={activePoint.y} r='3' />
          </>
        )}
      </svg>
      {activeSample && (
        <div
          className='premium-probe-chart-tooltip'
          style={{ left: `${tooltipLeft}%` }}
        >
          <span>{activeSample.label}</span>
          <strong>{activeSample.formatted}</strong>
        </div>
      )}
    </div>
  )
}

function DailyTrafficTrend({ servers }: { servers: ProbeServer[] }) {
  const container = useRef<HTMLDivElement>(null)
  const [visibleDays, setVisibleDays] = useState(7)
  const allDays = useMemo(() => {
    const totals = new Map<
      string,
      { date: string; uplink: number; downlink: number; total: number }
    >()
    for (const server of servers) {
      for (const day of server.daily_traffic || []) {
        const current = totals.get(day.date) || {
          date: day.date,
          uplink: 0,
          downlink: 0,
          total: 0,
        }
        current.uplink += day.uplink || 0
        current.downlink += day.downlink || 0
        current.total += day.total || day.uplink + day.downlink
        totals.set(day.date, current)
      }
    }
    return [...totals.values()].sort((left, right) =>
      left.date.localeCompare(right.date)
    )
  }, [servers])

  useEffect(() => {
    const element = container.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      const count = Math.max(
        7,
        Math.min(18, Math.floor(entry.contentRect.width / 34))
      )
      setVisibleDays(count)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const days = allDays.slice(-visibleDays)
  const latest = days[days.length - 1]
  const samples = days.map((day, index) => ({
    label: index === days.length - 1 ? `今日 ${day.date}` : day.date,
    value: day.total,
    formatted: formatTrafficCompact(day.total),
  }))

  return (
    <div
      ref={container}
      className='premium-probe-overview-chart-card premium-probe-daily-trend'
    >
      <div className='premium-probe-overview-chart-heading'>
        <span>每日流量趋势</span>
        <strong>
          今日 {latest ? formatTrafficCompact(latest.total) : '—'}
        </strong>
      </div>
      <InteractiveTrend samples={samples} />
      <div className='premium-probe-speed-meta'>
        <small>{days[0]?.date.slice(5) || '暂无历史'}</small>
        <small>
          {latest ? `今日 ${latest.date.slice(5)} · ${days.length} 天` : ''}
        </small>
      </div>
    </div>
  )
}

function TrafficHotspots({ servers }: { servers: ProbeServer[] }) {
  const ranked = servers
    .map((server, index) => ({
      server,
      index,
      speed: (server.download_speed || 0) + (server.upload_speed || 0),
    }))
    .sort((left, right) => right.speed - left.speed)
  const total = ranked.reduce((sum, row) => sum + row.speed, 0)
  const rows = ranked.slice(0, 5)

  return (
    <div className='premium-probe-overview-chart-card premium-probe-hotspots'>
      <div className='premium-probe-overview-chart-heading'>
        <span>实时流量热点</span>
        <strong>{formatBitSpeed(total)}</strong>
      </div>
      <div className='premium-probe-hotspot-list'>
        {rows.map((row) => {
          const share = total > 0 ? (row.speed / total) * 100 : 0
          return (
            <div key={`${row.server.name || 'server'}-${row.index}`}>
              <Twemoji>{row.server.name || `#${row.index + 1}`}</Twemoji>
              <i>
                <b style={{ width: `${share}%` }} />
              </i>
              <strong>{share.toFixed(0)}%</strong>
            </div>
          )
        })}
      </div>
      <div className='premium-probe-speed-meta'>
        <small>当前上下行带宽贡献</small>
        <small>TOP {rows.length}</small>
      </div>
    </div>
  )
}

function MetricBar({
  label,
  value,
  percent,
}: {
  label: string
  value: string
  percent?: number
}) {
  return (
    <div className='premium-probe-resource'>
      <span>{label}</span>
      <strong>{value}</strong>
      <i>
        <b style={{ width: `${percent ?? 0}%` }} />
      </i>
    </div>
  )
}

function pingTargetID(series: ProbePingSeries): string {
  return series.key?.trim() || `${series.label}|${series.isp || ''}`
}

function aggregatePingBuckets(series: ProbePingSeries[]) {
  const count = Math.max(0, ...series.map((item) => item.buckets.length))
  return Array.from({ length: count }, (_, index) => {
    const latency: number[] = []
    const loss: number[] = []
    for (const item of series) {
      const offset = count - item.buckets.length
      const bucket = item.buckets[index - offset]
      if (!bucket) continue
      if (bucket.ms >= 0) latency.push(bucket.ms)
      if (bucket.loss >= 0) loss.push(bucket.loss)
    }
    return {
      ms: latency.length
        ? latency.reduce((total, value) => total + value, 0) / latency.length
        : undefined,
      loss: loss.length
        ? loss.reduce((total, value) => total + value, 0) / loss.length
        : undefined,
    }
  })
}

const probeLineColors = [
  '#f1cb70',
  '#72cf72',
  '#67b7dc',
  '#e47b83',
  '#b58ae4',
  '#e79c55',
  '#63c7b2',
  '#d7d06d',
  '#d982bd',
  '#91a7e8',
]

function MultiTargetLatencyChart({
  series,
  bucketSec,
  generatedAt,
}: {
  series: ProbePingSeries[]
  bucketSec: number
  generatedAt: number
}) {
  const [activeIndex, setActiveIndex] = useState<number>()
  const [activeY, setActiveY] = useState<number>()
  const chartTopRef = useRef(0)
  const width = 420
  const height = 84
  const baseline = height - 8
  const count = Math.max(0, ...series.map((item) => item.buckets.length))
  const values = series.flatMap((item) =>
    item.buckets.map((bucket) => bucket.ms).filter((value) => value >= 0)
  )
  const ceiling = Math.max(100, ...values) * 1.08
  const paths = series.map((item) => {
    const offset = count - item.buckets.length
    let open = false
    const commands: string[] = []
    for (let index = 0; index < count; index++) {
      const bucket = item.buckets[index - offset]
      if (!bucket || bucket.ms < 0) {
        open = false
        continue
      }
      const x = count <= 1 ? width : (index / (count - 1)) * width
      const y =
        baseline - (Math.min(ceiling, bucket.ms) / ceiling) * (height - 18)
      commands.push(`${open ? 'L' : 'M'} ${x.toFixed(2)} ${y.toFixed(2)}`)
      open = true
    }
    return commands.join(' ')
  })
  const cursorX =
    activeIndex === undefined || count <= 1
      ? undefined
      : (activeIndex / (count - 1)) * width
  const end = generatedAt - (generatedAt % bucketSec)
  const activeTimestamp =
    activeIndex === undefined
      ? undefined
      : end - (count - 1 - activeIndex) * bucketSec
  const activeValues =
    activeIndex === undefined
      ? []
      : series.flatMap((item, seriesIndex) => {
          const offset = count - item.buckets.length
          const bucket = item.buckets[activeIndex - offset]
          return bucket && bucket.ms >= 0
            ? [
                {
                  item,
                  bucket,
                  color: probeLineColors[seriesIndex % probeLineColors.length],
                },
              ]
            : []
        })
  // tooltip 跟随鼠标: 默认在鼠标下方, 下方视口空间不足(按行数估算高度)时翻转到上方
  const tooltipTop = activeY === undefined ? undefined : activeY + 14
  const estTooltipHeight = activeValues.length * 18 + 34
  const tooltipFlip =
    activeY !== undefined && window.innerHeight - (chartTopRef.current + activeY) < estTooltipHeight + 16

  return (
    <div
      className='premium-probe-multi-target-chart'
      onPointerMove={(event) => {
        if (!count) return
        const bounds = event.currentTarget.getBoundingClientRect()
        const ratio = Math.max(
          0,
          Math.min(1, (event.clientX - bounds.left) / bounds.width)
        )
        setActiveIndex(Math.round(ratio * (count - 1)))
        setActiveY(event.clientY - bounds.top)
        chartTopRef.current = bounds.top
      }}
      onPointerLeave={() => {
        setActiveIndex(undefined)
        setActiveY(undefined)
      }}
    >
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio='none'>
        <line
          className='is-baseline'
          x1='0'
          y1={baseline}
          x2={width}
          y2={baseline}
        />
        {paths.map((path, index) => (
          <path
            key={series[index].key || `${series[index].label}-${index}`}
            d={path}
            style={{ stroke: probeLineColors[index % probeLineColors.length] }}
          />
        ))}
        {cursorX !== undefined && (
          <line
            className='is-cursor'
            x1={cursorX}
            y1='3'
            x2={cursorX}
            y2={baseline}
          />
        )}
      </svg>
      {activeTimestamp !== undefined && (
        <div
          className={`premium-probe-multi-tooltip${tooltipFlip ? ' is-flip' : ''}`}
          style={{
            left: `${Math.max(12, Math.min(88, ((cursorX || 0) / width) * 100))}%`,
            ...(tooltipTop === undefined || tooltipFlip ? {} : { top: `${tooltipTop}px` }),
          }}
        >
          <time>{formatAxisDateTime(activeTimestamp)}</time>
          {activeValues.length ? (
            activeValues.map(({ item, bucket, color }) => (
              <span key={item.key || item.label}>
                <i style={{ background: color }} />
                <b>{item.label}</b>
                <strong>{bucket.ms} ms</strong>
                <small>丢包 {bucket.loss.toFixed(1)}%</small>
              </span>
            ))
          ) : (
            <small>该时间桶暂无数据</small>
          )}
        </div>
      )}
    </div>
  )
}

function PremiumNetworkView({ servers }: { servers: ProbeServer[] }) {
  const [serverIndex, setServerIndex] = useState(0)
  const [target, setTarget] = useState('__all__')
  const [visibleTargets, setVisibleTargets] = useState<string[]>([])
  const [range, setRange] = useState<'1h' | '6h' | '24h'>('1h')
  const selectedServerIndex = Math.min(
    serverIndex,
    Math.max(0, servers.length - 1)
  )
  const selectedServer = servers[selectedServerIndex]
  const targets = useMemo(() => {
    const result = new Map<
      string,
      { id: string; label: string; isp?: string }
    >()
    if (selectedServer) {
      for (const series of selectedServer.ping || []) {
        const id = pingTargetID(series)
        if (!result.has(id)) {
          result.set(id, { id, label: series.label, isp: series.isp })
        }
      }
    }
    return [...result.values()].sort((left, right) =>
      left.label.localeCompare(right.label, 'zh-CN')
    )
  }, [selectedServer])
  const selectedTarget =
    target === '__all__' ||
    target === '__custom__' ||
    targets.some((item) => item.id === target)
      ? target
      : '__all__'
  const [detail, setDetail] = useState<{
    success: boolean
    series: ProbePingSeries
    all_series?: ProbePingSeries[]
    bucket_sec: number
    generated_at: number
  }>()
  useEffect(() => {
    if (!selectedServer) {
      setDetail(undefined)
      return
    }
    const controller = new AbortController()
    const load = async () => {
      try {
        const params = new URLSearchParams({
          server: String(selectedServerIndex),
          target: '__avg__',
          all: '1',
          range,
        })
        const response = await fetch(`/api/series?${params}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        setDetail(await response.json())
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setDetail(undefined)
        }
      }
    }
    void load()
    const timer = window.setInterval(load, 30_000)
    return () => {
      controller.abort()
      window.clearInterval(timer)
    }
  }, [range, selectedServer, selectedServerIndex])
  const rows = selectedServer
    ? [selectedServer].map((server) => {
        const series = server.ping || []
        const effectiveSeries = detail?.success ? [detail.series] : series
        const currentLatency = effectiveSeries
          .map((item) => item.current_ms)
          .filter((value) => value >= 0)
        const currentLoss = effectiveSeries
          .map((item) => item.loss_pct)
          .filter((value) => value >= 0)
        return {
          server,
          index: selectedServerIndex,
          series: effectiveSeries,
          buckets: detail?.success
            ? aggregatePingBuckets([detail.series])
            : aggregatePingBuckets(series),
          latency: currentLatency.length
            ? Math.round(
                currentLatency.reduce((total, value) => total + value, 0) /
                  currentLatency.length
              )
            : undefined,
          loss: currentLoss.length
            ? currentLoss.reduce((total, value) => total + value, 0) /
              currentLoss.length
            : undefined,
        }
      })
    : []
  const chartSeries = detail?.success
    ? [
        { ...detail.series, key: '__avg__', label: '全部目标平均' },
        ...(detail.all_series || []),
      ]
    : []
  const allChartTargetKeys = chartSeries.map(
    (item) => item.key || pingTargetID(item)
  )
  const effectiveVisibleTargets =
    selectedTarget === '__all__' ? allChartTargetKeys : visibleTargets
  const visibleChartSeries = chartSeries.filter((item) =>
    effectiveVisibleTargets.includes(item.key || pingTargetID(item))
  )
  const measuredRows = rows.filter((row) => row.series.length > 0)
  const reachableRows = measuredRows.filter(
    (row) => row.latency !== undefined && row.loss !== undefined
  )
  const averageMs = reachableRows.length
    ? Math.round(
        reachableRows.reduce((total, row) => total + (row.latency || 0), 0) /
          reachableRows.length
      )
    : undefined
  const averageLoss = reachableRows.length
    ? reachableRows.reduce((total, row) => total + (row.loss || 0), 0) /
      reachableRows.length
    : undefined
  const detailBuckets = detail?.success
    ? detail.series.buckets.map((bucket, index, buckets) => {
        const end =
          detail.generated_at - (detail.generated_at % detail.bucket_sec)
        const timestamp = end - (buckets.length - 1 - index) * detail.bucket_sec
        return { ...bucket, timestamp }
      })
    : []

  return (
    <section className='premium-probe-network-view'>
      <div className='premium-probe-network-view-heading'>
        <div>
          <h2>
            <Activity /> 网络状况
          </h2>
          <span>按服务器与其独立探测目标查看真实时间序列</span>
        </div>
        <div className='premium-probe-network-selectors'>
          <label>
            <Server />
            <span>服务器</span>
            <select
              value={selectedServerIndex}
              onChange={(event) => {
                setServerIndex(Number(event.target.value))
                setTarget('__all__')
                setVisibleTargets([])
              }}
            >
              {servers.map((server, index) => (
                <option value={index} key={index}>
                  {server.name || `#${index + 1}`}
                </option>
              ))}
            </select>
          </label>
          <label>
            <Target />
            <span>探测目标</span>
            <select
              value={selectedTarget}
              onChange={(event) => {
                const value = event.target.value
                setTarget(value)
                setVisibleTargets(
                  value === '__all__'
                    ? []
                    : [value]
                )
              }}
            >
              <option value='__avg__'>仅显示全部目标平均</option>
              <option value='__all__'>显示所有探测目标</option>
              {selectedTarget === '__custom__' && (
                <option value='__custom__'>自定义目标组合</option>
              )}
              {targets.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.label}
                  {item.isp ? ` · ${item.isp}` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className='premium-probe-network-kpis'>
        {[
          {
            label: '平均延迟',
            value: averageMs === undefined ? '—' : `${averageMs} ms`,
            hint: '所选服务器与目标',
          },
          {
            label: '平均丢包',
            value:
              averageLoss === undefined ? '—' : `${averageLoss.toFixed(2)}%`,
            hint: '所选服务器与目标',
          },
          {
            label: '时间范围',
            value:
              range === '1h' ? '1 小时' : range === '6h' ? '6 小时' : '24 小时',
            hint: detail?.bucket_sec
              ? `${detail.bucket_sec / 60} 分钟一个数据桶`
              : '等待详细数据',
          },
          {
            label: '探测目标',
            value: String(targets.length),
            hint: '当前服务器配置',
          },
        ].map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.hint}</small>
          </article>
        ))}
      </div>

      <article className='premium-probe-network-matrix'>
        <header>
          <div>
            <Radio />
            <h3>服务器探测详情</h3>
          </div>
          <div className='premium-probe-network-ranges'>
            {(['1h', '6h', '24h'] as const).map((item) => (
              <button
                type='button'
                key={item}
                className={range === item ? 'is-active' : undefined}
                onClick={() => setRange(item)}
              >
                {item === '1h'
                  ? '1 小时'
                  : item === '6h'
                    ? '6 小时'
                    : '24 小时'}
              </button>
            ))}
          </div>
        </header>
        <div className='premium-probe-target-toolbar'>
          <div>
            {chartSeries.map((item, index) => {
              const key = item.key || pingTargetID(item)
              const active = effectiveVisibleTargets.includes(key)
              return (
                <button
                  type='button'
                  key={key}
                  className={active ? 'is-active' : undefined}
                  onClick={() => {
                    setTarget('__custom__')
                    setVisibleTargets((current) => {
                      const base =
                        selectedTarget === '__all__'
                          ? allChartTargetKeys
                          : current
                      return base.includes(key)
                        ? base.filter((item) => item !== key)
                        : [...base, key]
                    })
                  }}
                  title={active ? '点击隐藏该目标' : '点击显示该目标'}
                >
                  <i
                    style={{
                      background:
                        probeLineColors[index % probeLineColors.length],
                    }}
                  />
                  {item.label}
                  {item.isp ? ` · ${item.isp}` : ''}
                </button>
              )
            })}
          </div>
          <span>
            <button
              type='button'
              onClick={() => {
                setTarget('__all__')
                setVisibleTargets(
                  chartSeries.map((item) => item.key || pingTargetID(item))
                )
              }}
            >
              全部显示
            </button>
            <button
              type='button'
              onClick={() => {
                setTarget('__custom__')
                setVisibleTargets(
                  chartSeries
                    .filter(
                      (item) =>
                        item.key !== '__avg__' &&
                        /电信|联通|移动/.test(item.label)
                    )
                    .map((item) => item.key || pingTargetID(item))
                )
              }}
            >
              内地
            </button>
            <button
              type='button'
              onClick={() => {
                setTarget('__custom__')
                setVisibleTargets(
                  chartSeries
                    .filter(
                      (item) =>
                        item.key !== '__avg__' &&
                        !/电信|联通|移动/.test(item.label)
                    )
                    .map((item) => item.key || pingTargetID(item))
                )
              }}
            >
              海外
            </button>
            <button
              type='button'
              onClick={() => {
                setTarget('__avg__')
                setVisibleTargets(['__avg__'])
              }}
            >
              仅平均
            </button>
          </span>
        </div>
        <div className='premium-probe-network-table-head'>
          <span>服务器</span>
          <span>当前延迟</span>
          <span>丢包率</span>
          <span>真实延迟趋势 / 丢包时间轴</span>
        </div>
        <div className='premium-probe-network-rows'>
          {rows.length === 0 && (
            <div className='premium-probe-network-empty'>
              暂无可展示的服务器
            </div>
          )}
          {rows.map((row) => {
            const quality =
              row.latency === undefined || row.loss === undefined
                ? 'missing'
                : row.loss >= 10 || row.latency >= 250
                  ? 'poor'
                  : row.loss >= 3 || row.latency >= 120
                    ? 'medium'
                    : 'good'
            const flag =
              countryFlag(serverRegionKey(row.server)) ||
              row.server.region ||
              ''
            return (
              <div className='premium-probe-network-row' key={`${row.index}`}>
                <div className='premium-probe-network-server'>
                  <i data-level={quality} />
                  <span>
                    <strong>
                      <Twemoji>
                        {displayServerName(
                          row.server.name,
                          `#${row.index + 1}`,
                          flag
                        )}
                      </Twemoji>
                    </strong>
                    <small>
                      <Twemoji>{localizedRegionLabel(row.server)}</Twemoji>
                    </small>
                  </span>
                </div>
                <strong data-level={quality}>
                  {row.latency === undefined ? '—' : `${row.latency} ms`}
                </strong>
                <strong data-level={quality}>
                  {row.loss === undefined ? '—' : `${row.loss.toFixed(1)}%`}
                </strong>
                <div className='premium-probe-network-chart'>
                  {visibleChartSeries.length && detail?.success ? (
                    <MultiTargetLatencyChart
                      series={visibleChartSeries}
                      bucketSec={detail.bucket_sec}
                      generatedAt={detail.generated_at}
                    />
                  ) : (
                    <span>点击上方目标以显示延迟折线</span>
                  )}
                  <div className='premium-probe-network-loss'>
                    {row.buckets.map((bucket, index) => (
                      <i
                        key={index}
                        title={
                          bucket.loss === undefined
                            ? '无数据'
                            : `丢包 ${bucket.loss.toFixed(1)}%${bucket.ms === undefined ? '' : ` · ${bucket.ms.toFixed(0)} ms`}`
                        }
                        style={{
                          height: `${Math.min(100, bucket.loss || 0)}%`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div className='premium-probe-network-history'>
          {detailBuckets.length === 0 ? (
            <p>暂无详细时间序列</p>
          ) : (
            detailBuckets.map((bucket) => (
              <div key={bucket.timestamp}>
                <time>{formatAxisDateTime(bucket.timestamp)}</time>
                <strong>{bucket.ms < 0 ? '不可达' : `${bucket.ms} ms`}</strong>
                <span>
                  {bucket.loss < 0
                    ? '无数据'
                    : `丢包 ${bucket.loss.toFixed(1)}%`}
                </span>
              </div>
            ))
          )}
        </div>
      </article>
    </section>
  )
}

function PremiumServerCard({
  server,
  index,
  onOpen,
  showHealthScore,
}: {
  server: ProbeServer
  index: number
  onOpen: () => void
  showHealthScore: boolean
}) {
  const mem = resourcePercentage(server.mem_used, server.mem_total)
  const disk = resourcePercentage(server.disk_used, server.disk_total)
  const trafficUsed =
    server.traffic_used_total ??
    server.traffic_used ??
    server.traffic_used_up ??
    0
  const trafficValue = server.traffic_limit
    ? `${formatTrafficCompact(trafficUsed)} / ${formatTrafficCompact(server.traffic_limit)}`
    : formatTrafficCompact(trafficUsed)
  const latency = averageLatency(server)
  const losses = (server.ping || [])
    .map((item) => item.loss_pct)
    .filter((value) => value >= 0)
  const loss = losses.length
    ? losses.reduce((total, value) => total + value, 0) / losses.length
    : undefined
  const code = serverRegionKey(server)
  const flag = countryFlag(code) || server.region || ''
  const health = serverHealth(server)
  const dailyTraffic = (server.daily_traffic || []).slice(-14)
  const maxDailyTraffic = Math.max(
    1,
    ...dailyTraffic.map((day) => day.total || day.uplink + day.downlink)
  )
  const latencyBuckets = aggregatePingBuckets(server.ping || [])
  const latencySamples = latencyBuckets
    .map((bucket, bucketIndex): TrendSample | undefined => {
      if (bucket.ms === undefined) return undefined
      const minutesAgo = (latencyBuckets.length - 1 - bucketIndex) * 5
      return {
        label: minutesAgo === 0 ? '当前时间桶' : `${minutesAgo} 分钟前`,
        value: bucket.ms,
        formatted: `${bucket.ms.toFixed(0)} ms`,
      }
    })
    .filter((sample): sample is TrendSample => sample !== undefined)

  return (
    <article
      className='premium-probe-server-card'
      role='button'
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpen()
      }}
    >
      <header>
        <h3>
          <Twemoji>
            {displayServerName(server.name, `#${index + 1}`, flag)}
          </Twemoji>
        </h3>
        {showHealthScore && (
          <span
            className='premium-probe-health-score'
            data-tone={health.tone}
            title={health.issues.join('、') || '运行状态正常'}
          >
            {health.score} · {health.label}
          </span>
        )}
        <span className='premium-probe-server-status'>
          <i
            className={cn(
              'premium-probe-live-dot',
              !server.online && 'is-offline'
            )}
          />
          {server.online ? '在线' : '离线'}
          <ChevronRight />
        </span>
      </header>
      <div className='premium-probe-resource-grid'>
        <MetricBar
          label='CPU'
          value={
            server.cpu_pct === undefined ? '—' : `${server.cpu_pct.toFixed(0)}%`
          }
          percent={server.cpu_pct}
        />
        <MetricBar
          label='内存'
          value={mem === undefined ? '—' : `${mem.toFixed(0)}%`}
          percent={mem}
        />
        <MetricBar
          label='硬盘'
          value={disk === undefined ? '—' : `${disk.toFixed(0)}%`}
          percent={disk}
        />
      </div>
      <div className='premium-probe-server-footer'>
        <div className='premium-probe-card-traffic'>
          <span>周期流量</span>
          <strong>{trafficValue}</strong>
          <i aria-label='每日流量柱状图'>
            {dailyTraffic.map((day) => {
              const total = day.total || day.uplink + day.downlink
              return (
                <b
                  key={day.date}
                  title={`${day.date} · ${formatTrafficCompact(total)}`}
                  style={{
                    height: `${Math.max(8, (total / maxDailyTraffic) * 100)}%`,
                  }}
                />
              )
            })}
          </i>
          <small>近 {dailyTraffic.length} 日</small>
        </div>
        <div className='premium-probe-card-latency'>
          <span>当前延迟</span>
          <strong>{latency === undefined ? '—' : `${latency} ms`}</strong>
          <InteractiveTrend samples={latencySamples} compact showArea={false} />
          <small>
            {loss === undefined ? '暂无丢包数据' : `丢包 ${loss.toFixed(2)}%`}
          </small>
        </div>
      </div>
    </article>
  )
}

function ServerDetailDrawer({
  server,
  index,
  onClose,
  showHealthScore,
}: {
  server: ProbeServer
  index: number
  onClose: () => void
  showHealthScore: boolean
}) {
  const health = serverHealth(server)
  const mem = resourcePercentage(server.mem_used, server.mem_total)
  const disk = resourcePercentage(server.disk_used, server.disk_total)
  const latency = averageLatency(server)
  const traffic = summarizeSevenDayTraffic([server])
  const maxTraffic = Math.max(1, ...traffic.map((item) => item.total))
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

  return (
    <div className='premium-probe-drawer-layer' onMouseDown={onClose}>
      <aside
        className='premium-probe-drawer'
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <Twemoji>{localizedRegionLabel(server)}</Twemoji>
            <h2>
              <Twemoji>{server.name || `#${index + 1}`}</Twemoji>
            </h2>
          </div>
          <button type='button' onClick={onClose} aria-label='关闭详情'>
            <X />
          </button>
        </header>
        {showHealthScore && (
          <section className='premium-probe-drawer-health'>
            <strong data-tone={health.tone}>{health.score}</strong>
            <div>
              <span>综合健康度 · {health.label}</span>
              <p>{health.issues.join('，') || '各项公开指标运行正常'}</p>
            </div>
          </section>
        )}
        <div className='premium-probe-drawer-metrics'>
          {[
            ['CPU', server.cpu_pct],
            ['内存', mem],
            ['硬盘', disk],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <span>{label}</span>
              <strong>
                {typeof value === 'number' ? `${value.toFixed(0)}%` : '—'}
              </strong>
            </div>
          ))}
          <div>
            <span>平均延迟</span>
            <strong>{latency === undefined ? '—' : `${latency} ms`}</strong>
          </div>
        </div>
        <section className='premium-probe-drawer-section'>
          <h3>近 7 日流量</h3>
          <div className='premium-probe-drawer-traffic'>
            {traffic.map((item) => (
              <div key={item.date}>
                <span>{item.date.slice(5)}</span>
                <i>
                  <b
                    style={{ width: `${(item.downlink / maxTraffic) * 100}%` }}
                  />
                  <b
                    style={{ width: `${(item.uplink / maxTraffic) * 100}%` }}
                  />
                </i>
                <strong>{formatTrafficCompact(item.total)}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className='premium-probe-drawer-section'>
          <h3>探测地址</h3>
          <div className='premium-probe-drawer-pings'>
            {(server.ping || []).length === 0 ? (
              <p>暂无 Ping 探测数据</p>
            ) : (
              (server.ping || []).map((item) => (
                <div key={pingTargetID(item)}>
                  <span>
                    {item.label}
                    {item.isp ? ` · ${item.isp}` : ''}
                  </span>
                  <strong>
                    {item.current_ms < 0 ? '不可达' : `${item.current_ms} ms`}
                  </strong>
                  <small>丢包 {item.loss_pct.toFixed(1)}%</small>
                </div>
              ))
            )}
          </div>
        </section>
        <section className='premium-probe-drawer-section'>
          <h3>三网回程</h3>
          <div className='premium-probe-drawer-routes'>
            {(server.return_routes || []).length === 0 ? (
              <p>暂无回程数据</p>
            ) : (
              (server.return_routes || []).map((item, routeIndex) => (
                <span key={`${item.carrier}-${routeIndex}`}>
                  <b>{displayReturnRoute(item.route_type)}</b>
                  <small>
                    {
                      { telecom: '电信', unicom: '联通', mobile: '移动' }[
                        item.carrier
                      ]
                    }
                  </small>
                </span>
              ))
            )}
          </div>
        </section>
        <section className='premium-probe-drawer-section premium-probe-drawer-info'>
          <h3>系统与续费</h3>
          <div>
            <span>系统</span>
            <strong>
              {[server.os, server.arch, server.kernel]
                .filter(Boolean)
                .join(' · ') || '—'}
            </strong>
          </div>
          <div>
            <span>处理器</span>
            <strong>
              {server.cpu_model || '—'}
              {server.cpu_cores ? ` · ${server.cpu_cores} 核` : ''}
            </strong>
          </div>
          <div>
            <span>到期时间</span>
            <strong>{server.expires_at || '—'}</strong>
          </div>
          <div>
            <span>续费价格</span>
            <strong>
              {server.renewal_price_cny === undefined
                ? '—'
                : `¥${server.renewal_price_cny.toFixed(2)}`}
            </strong>
          </div>
        </section>
      </aside>
    </div>
  )
}

export function PremiumProbePage({
  data,
  isLoading,
  isError,
  onThemeChange,
}: PremiumProbePageProps) {
  const servers = useMemo(() => data?.servers || [], [data?.servers])
  const regions = useMemo(() => buildRegions(servers), [servers])
  const totalDownload = servers.reduce(
    (total, server) => total + (server.download_speed || 0),
    0
  )
  const totalUpload = servers.reduce(
    (total, server) => total + (server.upload_speed || 0),
    0
  )
  const [status, setStatus] = useState<StatusFilter>('all')
  const [region, setRegion] = useState('all')
  const [selectedServer, setSelectedServer] = useState<number>()
  const [view, setView] = useState<PremiumProbeView>(() => {
    if (typeof window === 'undefined') return 'card'
    const saved = localStorage.getItem('premium-probe-view')
    return saved === 'network' || saved === 'resource' ? saved : 'card'
  })
  // 水印层开关（默认开，localStorage 记忆）
  const [showWatermark, setShowWatermark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('premium-probe-watermark') !== '0'
  })
  // 底部许可证动画开关（默认开，localStorage 记忆）
  const [licenseAnim, setLicenseAnim] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('premium-probe-license-anim') !== '0'
  })
  // 页首许可证循环播放索引（本地 11 枚轮播; GitHub 版空数组时回退主控 badge）
  const [headerBadgeIdx, setHeaderBadgeIdx] = useState(0)
  useEffect(() => {
    if (HEADER_LICENSE_BADGES.length === 0) return
    const timer = window.setInterval(() => {
      setHeaderBadgeIdx((index) => (index + 1) % HEADER_LICENSE_BADGES.length)
    }, LICENSE_CYCLE_MS)
    return () => window.clearInterval(timer)
  }, [])
  const sampledPayload = useRef<ProbeData | undefined>(undefined)
  const [liveSpeedHistory, setLiveSpeedHistory] = useState<{
    download: TrendSample[]
    upload: TrendSample[]
  }>({ download: [], upload: [] })

  useEffect(() => {
    if (!data || sampledPayload.current === data) return
    let cancelled = false
    const label = new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date())

    queueMicrotask(() => {
      if (cancelled || sampledPayload.current === data) return
      sampledPayload.current = data
      setLiveSpeedHistory((history) => ({
        download: [
          ...history.download.slice(-59),
          {
            label,
            value: totalDownload,
            formatted: formatBitSpeed(totalDownload),
          },
        ],
        upload: [
          ...history.upload.slice(-59),
          {
            label,
            value: totalUpload,
            formatted: formatBitSpeed(totalUpload),
          },
        ],
      }))
    })

    return () => {
      cancelled = true
    }
  }, [data, totalDownload, totalUpload])

  if (!data && (isLoading || isError)) {
    return (
      <div className='premium-probe-loading'>
        {isError ? '探针暂时无法访问' : '正在加载服务器状态…'}
      </div>
    )
  }

  const online = servers.filter((server) => server.online).length
  const offline = servers.length - online
  const showGlobe = data?.show_globe === true && regions.length > 0
  const showDailyTrend = data?.show_daily_trend !== false
  const showTrafficHotspots = data?.show_traffic_hotspots !== false
  const overviewModuleCount =
    2 + Number(showDailyTrend) + Number(showTrafficHotspots)
  const insightVisibility = {
    traffic7D: data?.show_traffic_7d !== false,
    resourceHeatmap: data?.show_resource_heatmap !== false,
    trafficQuota: data?.show_traffic_quota !== false,
    renewalTimeline: data?.show_renewal_timeline !== false,
  }
  const visibleServers = servers.filter((server) => {
    const statusMatches =
      status === 'all' ||
      (status === 'online' && server.online) ||
      (status === 'offline' && !server.online)
    return (
      statusMatches && (region === 'all' || serverRegionKey(server) === region)
    )
  })

  const changeView = (next: PremiumProbeView) => {
    setView(next)
    localStorage.setItem('premium-probe-view', next)
  }
  const toggleWatermark = () => {
    setShowWatermark((prev) => {
      const next = !prev
      localStorage.setItem('premium-probe-watermark', next ? '1' : '0')
      return next
    })
  }
  const toggleLicenseAnim = () => {
    setLicenseAnim((prev) => {
      const next = !prev
      localStorage.setItem('premium-probe-license-anim', next ? '1' : '0')
      return next
    })
  }
  const pageTitle = data?.title?.trim() || '服务器状态'
  const logo = data?.logo?.trim() || ''

  return (
    <div className='premium-probe-page'>
      {showWatermark && <div className='premium-probe-watermarks' aria-hidden='true' />}
      <header className='premium-probe-topbar'>
        <div>
          {logo && (
            <img
              src={logo}
              alt=''
              onError={(event) => {
                event.currentTarget.style.display = 'none'
              }}
            />
          )}
          <h1>{pageTitle}</h1>
          <span className='premium-probe-pro'>PRO</span>
          {HEADER_LICENSE_BADGES.length > 0 ? (
            <span className='premium-probe-license'>
              <LicenseNameplate
                key={headerBadgeIdx}
                label={[
                  HEADER_LICENSE_BADGES[headerBadgeIdx].name?.trim(),
                  HEADER_LICENSE_BADGES[headerBadgeIdx].display_name?.trim(),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
            </span>
          ) : (
            <StandaloneLicenseBadge
              badge={data?.license_badge}
              className='premium-probe-license'
              animated
            />
          )}
        </div>
        <nav>
          <span className='premium-probe-live'>实时更新</span>
          <div className='premium-probe-view-toggle'>
            <button
              type='button'
              className={view === 'card' ? 'is-active' : undefined}
              onClick={() => changeView('card')}
            >
              <Globe2 /> 地图视图
            </button>
            <button
              type='button'
              className={view === 'network' ? 'is-active' : undefined}
              onClick={() => changeView('network')}
            >
              <Activity /> 网络状况
            </button>
            <button
              type='button'
              className={view === 'resource' ? 'is-active' : undefined}
              onClick={() => changeView('resource')}
            >
              <Gauge /> 资源概况
            </button>
          </div>
          <button
            type='button'
            className={`premium-probe-login premium-probe-watermark-toggle${showWatermark ? ' is-on' : ''}`}
            aria-label={showWatermark ? '隐藏水印层' : '显示水印层'}
            aria-pressed={showWatermark}
            title={showWatermark ? '隐藏水印层（纯黑背景）' : '显示水印层'}
            onClick={toggleWatermark}
          >
            <Layers />
          </button>
          <PremiumThemeSelect onThemeChange={onThemeChange} />
        </nav>
      </header>

      <main>
        {view === 'network' ? (
          <PremiumNetworkView servers={servers} />
        ) : view === 'resource' ? (
          <PremiumResourceOverview
            servers={servers}
            visibility={insightVisibility}
          />
        ) : (
          <>
            <section
              className={cn(
                'premium-probe-hero',
                !showGlobe && 'without-globe',
                overviewModuleCount === 2 && 'is-compact-overview'
              )}
            >
              <article className='premium-probe-panel premium-probe-overview'>
                <h2>
                  <Server /> 全球节点概览
                </h2>
                <div className='premium-probe-kpis'>
                  {[
                    {
                      key: 'all' as const,
                      value: servers.length,
                      label: '台服务器',
                      icon: Server,
                    },
                    {
                      key: 'online' as const,
                      value: online,
                      label: '在线',
                      icon: CheckCircle2,
                    },
                    {
                      key: 'offline' as const,
                      value: offline,
                      label: '离线',
                      icon: XCircle,
                    },
                  ].map((item) => (
                    <button
                      type='button'
                      key={item.key}
                      onClick={() => setStatus(item.key)}
                    >
                      <strong>{item.value}</strong>
                      <span>
                        <item.icon /> {item.label}
                      </span>
                    </button>
                  ))}
                  <button type='button' onClick={() => setRegion('all')}>
                    <strong>{regions.length}</strong>
                    <span>
                      <Globe2 /> 个地区
                    </span>
                  </button>
                </div>

                <div
                  className={cn(
                    'premium-probe-network-grid',
                    `has-${overviewModuleCount}-modules`
                  )}
                >
                  <SpeedSnapshot
                    label='总下行网速'
                    value={formatBitSpeed(totalDownload)}
                    samples={liveSpeedHistory.download}
                  />
                  <SpeedSnapshot
                    label='总上行网速'
                    value={formatBitSpeed(totalUpload)}
                    samples={liveSpeedHistory.upload}
                  />
                  {showDailyTrend && <DailyTrafficTrend servers={servers} />}
                  {showTrafficHotspots && <TrafficHotspots servers={servers} />}
                </div>
              </article>

              {showGlobe && (
                <article className='premium-probe-panel premium-probe-map'>
                  <div className='premium-probe-panel-heading'>
                    <h2>
                      <Globe2 /> 地区分布
                    </h2>
                    <span>{regions.length} 个地区</span>
                  </div>
                  <div className='premium-probe-map-content'>
                    <BlackGoldGlobe regions={regions} />
                    <aside>
                      <h3>地区状态</h3>
                      {regions.slice(0, 7).map((item) => (
                        <button
                          type='button'
                          key={item.code}
                          onClick={() => setRegion(item.code)}
                        >
                          <Twemoji>{item.label}</Twemoji>
                          <i
                            className={item.online === 0 ? 'is-offline' : ''}
                          />
                          <strong>{item.total}</strong>
                        </button>
                      ))}
                    </aside>
                  </div>
                </article>
              )}
            </section>

            <section className='premium-probe-servers'>
              <div className='premium-probe-section-heading'>
                <h2>
                  <Server /> 服务器摘要
                </h2>
                <span>实时资源与网络状态</span>
              </div>
              <div className='premium-probe-filters'>
                {[
                  ['all', `全部 ${servers.length}`],
                  ['online', `在线 ${online}`],
                  ['offline', `离线 ${offline}`],
                ].map(([key, label]) => (
                  <button
                    type='button'
                    key={key}
                    className={status === key ? 'is-active' : undefined}
                    onClick={() => setStatus(key as StatusFilter)}
                  >
                    {label}
                  </button>
                ))}
                <label>
                  <Globe2 />
                  <select
                    value={region}
                    onChange={(event) => setRegion(event.target.value)}
                  >
                    <option value='all'>全部地区</option>
                    {regions.map((item) => (
                      <option value={item.code} key={item.code}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {visibleServers.length === 0 ? (
                <div className='premium-probe-empty'>
                  暂无符合筛选条件的服务器
                </div>
              ) : (
                <div className='premium-probe-card-grid'>
                  {visibleServers.map((server, index) => (
                    <PremiumServerCard
                      server={server}
                      index={index}
                      key={`${server.name || 'server'}-${index}`}
                      onOpen={() => setSelectedServer(index)}
                      showHealthScore={data?.show_health_score === true}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {selectedServer !== undefined && servers[selectedServer] && (
        <ServerDetailDrawer
          server={servers[selectedServer]}
          index={selectedServer}
          onClose={() => setSelectedServer(undefined)}
          showHealthScore={data?.show_health_score === true}
        />
      )}

      <footer className='premium-probe-footer'>
        <div className='premium-probe-footer-badges'>
          {(() => {
            // 与经典界面 Footer 同款去重: 本地 EXTRA 为主, 主控同名勋章覆盖, 其余主控勋章追加
            const live = data?.license_badge ? (Array.isArray(data.license_badge) ? data.license_badge : [data.license_badge]) : []
            const keyOf = (badge: { name?: string; display_name?: string }) => badge.name || badge.display_name || ''
            const merged = EXTRA_LICENSE_BADGES.map((badge) => live.find((item) => keyOf(item) === keyOf(badge)) || badge)
            const extras = live.filter((badge) => !EXTRA_LICENSE_BADGES.some((item) => keyOf(item) === keyOf(badge)))
            const list = [...merged, ...extras].filter((badge, index, all) => all.findIndex((item) => keyOf(item) === keyOf(badge)) === index)
            return list.map((badge, index) => <StandaloneLicenseBadge key={index} badge={badge} animated={licenseAnim} />)
          })()}
        </div>
        <button
          type='button'
          className={`premium-probe-login premium-probe-license-anim-toggle${licenseAnim ? ' is-on' : ''}`}
          aria-label={licenseAnim ? '关闭底部许可证动画' : '开启底部许可证动画'}
          aria-pressed={licenseAnim}
          title={licenseAnim ? '关闭底部许可证动画' : '开启底部许可证动画'}
          onClick={toggleLicenseAnim}
        >
          <Sparkles />
        </button>
      </footer>
    </div>
  )
}
