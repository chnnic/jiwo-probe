import type { ProbeServer } from './types'

export const CYCLE_LABELS = {
  month: '月', quarter: '季', half_year: '半年', year: '年',
  two_year: '两年', three_year: '三年', permanent: '永久',
} as const

// A buyout has no recurring monthly cost; its purchase price is still displayed.
export const CYCLE_MONTHS = { month: 1, quarter: 3, half_year: 6, year: 12, two_year: 24, three_year: 36, permanent: Infinity } as const
export const CYCLE_DAYS = { month: 30, quarter: 90, half_year: 180, year: 365, two_year: 730, three_year: 1095, permanent: Infinity } as const
/**
 * 汇总用的人民币续费价：优先主控换算的 renewal_price_cny；没有换算时（例如主控重启后汇率还没取到）
 * 只有原币种本来就是人民币才用原价，外币返回 undefined，免得把美元、欧元直接当人民币相加。
 */
export function renewalPriceCny(server: Pick<ProbeServer, 'renewal_price' | 'renewal_price_cny' | 'renewal_currency'>): number | undefined {
  const valid = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
  if (valid(server.renewal_price_cny)) return server.renewal_price_cny
  return valid(server.renewal_price) && (server.renewal_currency?.trim().toUpperCase() || 'CNY') === 'CNY' ? server.renewal_price : undefined
}

export const isPermanent = (server: Pick<ProbeServer, 'renewal_cycle'>): boolean => server.renewal_cycle === 'permanent'

/** Permanent servers never expire, including when an old expiry date remains. */
export function expiryTimestamp(server: Pick<ProbeServer, 'renewal_cycle' | 'expires_at'>): number | undefined {
  if (isPermanent(server) || !server.expires_at) return undefined
  const time = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(server.expires_at) ? `${server.expires_at}T23:59:59` : server.expires_at)
  return Number.isFinite(time) ? time : undefined
}

/** 最近到期的几台（含已过期，天数为负），按剩余天数从少到多；天数和卡片一样向上取整 */
export function upcomingExpiries(servers: Array<Pick<ProbeServer, 'name' | 'renewal_cycle' | 'expires_at'>>, now = Date.now(), limit = 3): Array<{ name: string; days: number }> {
  return servers
    .flatMap((server) => {
      const at = expiryTimestamp(server)
      return at === undefined ? [] : [{ name: server.name || '', at }]
    })
    .sort((a, b) => a.at - b.at)
    .slice(0, limit)
    .map(({ name, at }) => ({ name, days: Math.ceil((at - now) / 86400000) }))
}
