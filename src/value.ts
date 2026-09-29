import type { ProbeServer } from './types'

export const CYCLE_DAYS = {
  month: 30,
  quarter: 90,
  half_year: 180,
  year: 365,
} as const

const CYCLE_MONTHS = { month: 1, quarter: 3, half_year: 6, year: 12 } as const
const BYTES_PER_TB = 1024 ** 4

export interface MonthlyTrafficCost {
  monthlyPrice: number
  quotaTB: number
  perTB: number
  currency: string
  isCny: boolean
}

/** 套餐单价估算：将配置的流量额度视为每月额度，不使用实际已用流量。 */
export function computeMonthlyTrafficCost(server: ProbeServer): MonthlyTrafficCost | null {
  const validPrice = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
  const price = validPrice(server.renewal_price_cny) ? server.renewal_price_cny : server.renewal_price
  const quota = server.traffic_limit
  const months = CYCLE_MONTHS[server.renewal_cycle ?? 'month']
  if (!validPrice(price) || typeof quota !== 'number' || !Number.isFinite(quota) || quota <= 0 || !months) return null
  const currency = validPrice(server.renewal_price_cny) ? 'CNY' : server.renewal_currency?.trim().toUpperCase() || 'CNY'
  const monthlyPrice = price / months
  const quotaTB = quota / BYTES_PER_TB
  const perTB = monthlyPrice / quotaTB
  if (!Number.isFinite(perTB)) return null
  return { monthlyPrice, quotaTB, perTB, currency, isCny: currency === 'CNY' }
}

export interface RemainingValue {
  days: number
  cycleDays: number
  daily: number
  value: number
  currency: string
  isCny: boolean
}

export function computeRemainingValue(server: ProbeServer): RemainingValue | null {
  if (!server.expires_at || server.renewal_price === undefined) return null
  const expires = new Date(`${server.expires_at}T23:59:59`).getTime()
  const days = Math.ceil((expires - Date.now()) / 86400000)
  if (days <= 0) return null // 已过期，无剩余价值
  const cycleDays = CYCLE_DAYS[server.renewal_cycle || 'month']
  const isCny = server.renewal_price_cny !== undefined
  const price = isCny ? server.renewal_price_cny! : server.renewal_price
  const daily = price / cycleDays
  return {
    days,
    cycleDays,
    daily,
    value: daily * days,
    currency: isCny ? 'CNY' : server.renewal_currency || 'CNY',
    isCny,
  }
}

export function formatMoney(value: number, currency: string, isCny: boolean, precise = false): string {
  if (isCny) return precise ? `¥${value.toFixed(2)}` : `¥${value.toFixed(0)}`
  return `${currency} ${value.toFixed(2)}`
}
