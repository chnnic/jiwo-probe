/** Cloudflare 只控制首页小折线；主控仍须下发 conn_history。 */
export const DEFAULT_SHOW_CONNECTION_CHART = true

export function parseShowConnectionChart(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (value === 0 || value === 1) return value === 1
  if (typeof value !== 'string') return DEFAULT_SHOW_CONNECTION_CHART
  const normalized = value.trim().toLowerCase()
  if (['false', '0', 'off', 'no', '关闭'].includes(normalized)) return false
  if (['true', '1', 'on', 'yes', '开启'].includes(normalized)) return true
  return DEFAULT_SHOW_CONNECTION_CHART
}
