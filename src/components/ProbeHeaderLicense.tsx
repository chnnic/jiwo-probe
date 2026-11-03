import { useEffect, useState } from 'react'
import type { ProbePayload } from '../types'
import { HEADER_LICENSE_BADGES } from '../license-badges'
import { LICENSE_CYCLE_MS, ProbeLicenseNameplate, prefersReducedMotion } from './ProbeLicenseFooter'

/** 标题旁的许可证铭牌：本地列表逐个轮播；公开版列表为空时显示主控返回的第一枚（和 Premium 页首一致）。 */
export function ProbeHeaderLicense({ badges }: { badges: ProbePayload['license_badge'] }) {
  const [index, setIndex] = useState(0)
  const motion = !prefersReducedMotion()
  useEffect(() => {
    if (!motion || HEADER_LICENSE_BADGES.length < 2) return
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % HEADER_LICENSE_BADGES.length)
    }, LICENSE_CYCLE_MS)
    return () => window.clearInterval(timer)
  }, [motion])
  const badge = HEADER_LICENSE_BADGES[index] ?? (Array.isArray(badges) ? badges[0] : badges)
  if (!badge) return null
  return <span className="probe-header-license" aria-label="许可证">
    <ProbeLicenseNameplate key={index} name={badge.name} displayName={badge.display_name} animated={motion} />
  </span>
}
