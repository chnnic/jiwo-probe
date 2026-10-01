import { countryCodeToFlag, FLAG_OPTIONS } from './country-flag.ts'
import type { PremiumProbeRegion } from './BlackGoldGlobe'

const names = new Map(FLAG_OPTIONS.map(({ code, label }) => [code, label]))

export function globeCountryCode(region: string): string {
  const raw = region.trim()
  const points = [...raw].map(char => char.codePointAt(0) || 0)
  if (points.length === 2 && points.every(point => point >= 0x1f1e6 && point <= 0x1f1ff)) {
    return points.map(point => String.fromCharCode(point - 0x1f1e6 + 65)).join('')
  }
  const code = raw.split(/[·,\s]+/)[0]?.toUpperCase() || ''
  return /^[A-Z]{2}$/.test(code) ? code : ''
}

export function buildGlobeRegions(regions: string[]): PremiumProbeRegion[] {
  const counts = new Map<string, number>()
  for (const region of regions) {
    const code = globeCountryCode(region)
    if (code) counts.set(code, (counts.get(code) || 0) + 1)
  }
  return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([code, total]) => ({
    code,
    label: `${countryCodeToFlag(code)} ${names.get(code) || code}`,
    total,
    // String-only callers provide region counts, not online status.
    online: 0,
  }))
}
