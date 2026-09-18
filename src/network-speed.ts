/** API / history values always remain bytes per second; convert only for display. */
export type NetworkSpeedUnit = 'bits' | 'bytes'

// CF 首次部署的默认值；升级时保留后台已有设置。
export const DEFAULT_NETWORK_SPEED_UNIT: NetworkSpeedUnit = 'bits'

export function parseNetworkSpeedUnit(value: unknown): NetworkSpeedUnit {
  return typeof value === 'string' && value.trim().toLowerCase() === 'bytes'
    ? 'bytes'
    : DEFAULT_NETWORK_SPEED_UNIT
}

export function formatNetworkSpeed(bytesPerSecond: number | undefined = 0, unit: NetworkSpeedUnit = DEFAULT_NETWORK_SPEED_UNIT): string {
  const base = unit === 'bits' ? 1000 : 1024
  const units = unit === 'bits'
    ? ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps', 'Pbps']
    : ['B/s', 'KB/s', 'MB/s', 'GB/s', 'TB/s', 'PB/s']
  let value = Number.isFinite(bytesPerSecond) ? Math.max(0, bytesPerSecond) : 0
  // Divide before multiplying at extreme values to avoid overflowing Number.
  let index = 0
  while (value >= base && index < units.length - 1) {
    value /= base
    index++
  }
  if (unit === 'bits') value *= 8
  while (value >= base && index < units.length - 1) {
    value /= base
    index++
  }
  const digits = index === 0 || value >= 100 ? 0 : value >= 10 ? 1 : 2
  // Avoid displaying 1000 Kbps / 1024 KB/s immediately below the next unit.
  if (Number(value.toFixed(digits)) >= base && index < units.length - 1) {
    value /= base
    index++
  }
  const precision = index === 0 || value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${Number(value.toFixed(precision))} ${units[index]}`
}
