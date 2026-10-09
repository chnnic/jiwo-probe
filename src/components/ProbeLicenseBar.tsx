import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import type { ProbePayload } from '../types'
import { ProbeLicenseFooter } from './ProbeLicenseFooter'
import { EXTRA_LICENSE_BADGES } from '../license-badges'

/**
 * 放在页面末尾的许可证栏（不悬浮遮挡内容），右侧带动画开关；开关状态按主题分别记在本浏览器。
 * LuminaPlus 与 Lumina 共用，样式由各主题的类名决定。
 */
export function ProbeLicenseBar({ badges, storageKey, className, toggleClassName }: {
  badges: ProbePayload['license_badge']
  storageKey: string
  className: string
  toggleClassName: string
}) {
  const [animated, setAnimated] = useState(() => {
    try { return localStorage.getItem(storageKey) !== '0' } catch { return true }
  })
  const toggle = () => {
    const next = !animated
    setAnimated(next)
    try { localStorage.setItem(storageKey, next ? '1' : '0') } catch { /* 存储不可用时本次会话仍可切换 */ }
  }
  if ((!badges || (Array.isArray(badges) && badges.length === 0)) && EXTRA_LICENSE_BADGES.length === 0) return null
  return <footer className={className} aria-label="许可证">
    <ProbeLicenseFooter badges={badges} animated={animated} />
    <button className={toggleClassName} type="button" role="switch" aria-checked={animated} aria-label="底部许可证动画" title={animated ? '关闭底部许可证动画' : '开启底部许可证动画'} onClick={toggle}>
      <Sparkles size={15} aria-hidden="true" /><span>动画</span><i aria-hidden="true" />
    </button>
  </footer>
}
