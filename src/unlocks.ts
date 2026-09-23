import type { ProbeUnlock } from './types'

export type UnlockCategory = 'streaming' | 'ai' | 'other'
export const unlockCategories: { key: UnlockCategory; label: string }[] = [
  { key: 'streaming', label: '流媒体' },
  { key: 'ai', label: 'AI' },
  { key: 'other', label: '其他' },
]

// 与主控的服务 key 对齐；地区/CDN/货币查询只展示信息，不计入解锁数量。
type Service = { label: string; category: UnlockCategory; info?: boolean }
const services: Record<string, Service> = {
  netflix: { label: 'Netflix', category: 'streaming' },
  disneyplus: { label: 'Disney+', category: 'streaming' },
  youtube_premium: { label: 'YouTube Premium', category: 'streaming' },
  prime_video: { label: 'Prime Video', category: 'streaming' },
  tvb_anywhere: { label: 'TVB Anywhere+', category: 'streaming' },
  iqiyi: { label: 'iQIYI 国际版', category: 'streaming', info: true },
  dazn: { label: 'DAZN', category: 'streaming' },
  youtube_cdn: { label: 'YouTube CDN', category: 'streaming', info: true },
  netflix_cdn: { label: 'Netflix CDN', category: 'streaming', info: true },
  spotify: { label: 'Spotify 注册', category: 'streaming' },
  openai: { label: 'ChatGPT', category: 'ai' },
  gemini: { label: 'Gemini', category: 'ai' },
  claude: { label: 'Claude', category: 'ai' },
  bing: { label: 'Bing', category: 'other', info: true },
  apple: { label: 'Apple 地区', category: 'other', info: true },
  wikipedia: { label: 'Wikipedia 可编辑', category: 'other' },
  google_play: { label: 'Google Play', category: 'other', info: true },
  google_search: { label: 'Google 搜索无验证码', category: 'other' },
  steam: { label: 'Steam 货币', category: 'other', info: true },
  reddit: { label: 'Reddit', category: 'other' },
  onetrust: { label: 'OneTrust 地区', category: 'other', info: true },
  sdggge: { label: 'SD Gundam G Generation Eternal', category: 'other' },
}
const order = Object.keys(services)
export function unlockService(key: string): Service {
  return Object.hasOwn(services, key) ? services[key] : { label: key, category: 'other' }
}

/** 容忍旧主控缺字段、异常条目以及将来新增的服务；同服务重复时采用最后一项。 */
export function normalizeUnlocks(value: unknown): ProbeUnlock[] {
  if (!Array.isArray(value)) return []
  const unique = new Map<string, ProbeUnlock>()
  for (const item of value) {
    if (!item || typeof item.service !== 'string' || !item.service.trim() || typeof item.status !== 'string') continue
    const service = item.service.trim()
    unique.set(service, {
      service,
      status: item.status,
      region: typeof item.region === 'string' ? item.region.trim() : undefined,
      tested_at: typeof item.tested_at === 'string' ? item.tested_at : undefined,
    })
  }
  const rank = (key: string) => order.includes(key) ? order.indexOf(key) : order.length
  return [...unique.values()].sort((a, b) => rank(a.service) - rank(b.service))
}

export function unlockStatus(item: ProbeUnlock): { label: string; tone: string } {
  if (unlockService(item.service).info) return item.status === 'yes'
    ? { label: '信息', tone: 'info' }
    : { label: '查询失败', tone: 'muted' }
  switch (item.status) {
    case 'yes': return { label: '已解锁', tone: 'ok' }
    case 'originals_only': return { label: '仅自制剧', tone: 'partial' }
    case 'no': return { label: '未解锁', tone: 'bad' }
    case 'banned': return { label: 'IP 被封禁', tone: 'bad' }
    default: return { label: '检测失败', tone: 'muted' }
  }
}

export function unlockSummary(items: ProbeUnlock[]) {
  const checked = items.filter(item => !unlockService(item.service).info)
  return {
    total: checked.length,
    unlocked: checked.filter(item => item.status === 'yes').length,
    partial: checked.filter(item => item.status === 'originals_only').length,
    info: items.length - checked.length,
  }
}

/** 折叠标题沿用完整面板的统计口径，信息查询不算作已解锁服务。 */
export function unlockCategorySummaries(value: unknown) {
  const items = normalizeUnlocks(value)
  return unlockCategories.map(category => ({
    ...category,
    ...unlockSummary(items.filter(item => unlockService(item.service).category === category.key)),
  }))
}

export function connectionCount(value: unknown): string {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value.toLocaleString('en-US') : '—'
}
