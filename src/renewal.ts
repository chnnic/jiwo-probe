import type { ProbeServer } from './types'

export const CYCLE_LABELS = {
  month: '月', quarter: '季', half_year: '半年', year: '年',
  two_year: '两年', three_year: '三年', permanent: '永久',
} as const

// A buyout has no recurring monthly cost; its purchase price is still displayed.
export const CYCLE_MONTHS = { month: 1, quarter: 3, half_year: 6, year: 12, two_year: 24, three_year: 36, permanent: Infinity } as const
export const CYCLE_DAYS = { month: 30, quarter: 90, half_year: 180, year: 365, two_year: 730, three_year: 1095, permanent: Infinity } as const
export const isPermanent = (server: Pick<ProbeServer, 'renewal_cycle'>): boolean => server.renewal_cycle === 'permanent'

/** Permanent servers never expire, including when an old expiry date remains. */
export function expiryTimestamp(server: Pick<ProbeServer, 'renewal_cycle' | 'expires_at'>): number | undefined {
  if (isPermanent(server) || !server.expires_at) return undefined
  const time = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(server.expires_at) ? `${server.expires_at}T23:59:59` : server.expires_at)
  return Number.isFinite(time) ? time : undefined
}
