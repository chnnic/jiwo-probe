import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import type { ProbePayload } from '../types'
import { ProbeLicenseFooter } from '../components/ProbeLicenseFooter'
import { EXTRA_LICENSE_BADGES } from '../license-badges'

const storageKey = 'jiwo-luminaplus-license-anim'

export function LuminaPlusLicenseFooter({ badges }: { badges: ProbePayload['license_badge'] }) {
  const [animated, setAnimated] = useState(() => {
    try { return localStorage.getItem(storageKey) !== '0' } catch { return true }
  })
  const toggle = () => {
    const next = !animated
    setAnimated(next)
    try { localStorage.setItem(storageKey, next ? '1' : '0') } catch { /* Session toggle still works if storage is unavailable. */ }
  }
  if ((!badges || (Array.isArray(badges) && badges.length === 0)) && EXTRA_LICENSE_BADGES.length === 0) return null
  return <footer className="lp-license-footer" aria-label="许可证">
    <ProbeLicenseFooter badges={badges} animated={animated} />
    <button className="lp-license-toggle" type="button" role="switch" aria-checked={animated} aria-label="底部许可证动画" title={animated ? '关闭底部许可证动画' : '开启底部许可证动画'} onClick={toggle}>
      <Sparkles size={15} aria-hidden="true" /><span>动画</span><i aria-hidden="true" />
    </button>
  </footer>
}
