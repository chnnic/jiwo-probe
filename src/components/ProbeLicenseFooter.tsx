import { useEffect, useRef } from 'react'
import type { ProbePayload } from '../types'
import { EXTRA_LICENSE_BADGES } from '../license-badges'

function ProbeLicenseNameplate({ name, displayName, animated = true }: { name?: string; displayName?: string; animated?: boolean }) {
  const label = [name?.trim(), displayName?.trim()].filter(Boolean).join(' · ')
  const plateRef = useRef<HTMLSpanElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const starsRef = useRef<HTMLSpanElement>(null)
  const shineRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!animated) return
    const plate = plateRef.current
    const text = textRef.current
    const stars = starsRef.current
    const shine = shineRef.current
    if (!plate || !text || !stars || !shine) return

    const palette = document.documentElement.classList.contains('platinum')
      ? ['#8c5d17', '#d7a63d', '#f2d78a', '#fff1b9', '#c78e24']
      : ['#f2d28b', '#d8b46a', '#e0b96e', '#f5c542', '#f3ecdc']
    const random = (min: number, max: number) => min + Math.random() * (max - min)
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
    const easeOutBack = (value: number) => {
      const c1 = 1.70158
      const c3 = c1 + 1
      return 1 + c3 * Math.pow(value - 1, 3) + c1 * Math.pow(value - 1, 2)
    }
    const easeInBack = (value: number) => {
      const c1 = 1.70158
      return (c1 + 1) * value * value * value - c1 * value * value
    }

    stars.innerHTML = ''
    const height = stars.clientHeight || 24
    const makeStar = (topFor: (size: number) => number) => {
      const star = document.createElement('i')
      star.className = 'spark'
      star.style.color = palette[Math.floor(Math.random() * palette.length)]
      const size = Math.round(random(8, 13))
      star.style.width = `${size}px`
      star.style.height = `${size}px`
      star.style.top = `${Math.round(topFor(size))}px`
      star.style.left = `${Math.round(random(0, 12))}px`
      stars.appendChild(star)
    }
    for (let index = 0; index < 5; index++) makeStar((size) => random(0, Math.max(0, height - size)))
    makeStar((size) => -size * 0.6)
    makeStar((size) => height - size * 0.4)

    let width = plate.offsetWidth
    const updateWidth = () => { width = plate.offsetWidth }
    window.addEventListener('resize', updateWidth)
    let frameID = 0
    const start = performance.now()
    const frame = (now: number) => {
      const progress = ((now - start) % 5596) / 5596
      const reveal = clamp(progress / 0.36, 0, 1)
      let rotateX = 0
      let scale = 1
      let opacity = 1
      if (progress < 0.08) {
        const amount = progress / 0.08
        const eased = easeOutBack(amount)
        rotateX = -92 * (1 - eased)
        scale = 0.86 + 0.14 * eased
        opacity = clamp(amount * 2.2, 0, 1)
      } else if (progress > 0.85) {
        const amount = (progress - 0.85) / 0.15
        const eased = easeInBack(amount)
        rotateX = 84 * eased
        scale = 1 - 0.14 * eased
        opacity = clamp(1 - amount * 1.5, 0, 1)
      }
      const starOpacity = progress < 0.04 ? progress / 0.04 : progress < 0.32 ? 1 : progress < 0.37 ? clamp(1 - (progress - 0.32) / 0.05, 0, 1) : 0
      const shineProgress = clamp((progress - 0.42) / 0.28, 0, 1)
      const shineActive = progress >= 0.42 && progress <= 0.7
      const shineOpacity = shineActive ? (shineProgress < 0.1 ? shineProgress / 0.1 : shineProgress > 0.85 ? clamp((1 - shineProgress) / 0.15, 0, 1) : 1) : 0

      plate.style.opacity = String(opacity)
      plate.style.transform = `perspective(340px) rotateX(${rotateX.toFixed(2)}deg) scale(${scale.toFixed(3)})`
      text.style.clipPath = `inset(0 ${((1 - reveal) * 100).toFixed(2)}% 0 0)`
      stars.style.transform = `translateX(${(13 + reveal * (width - 26)).toFixed(1)}px)`
      stars.style.opacity = String(starOpacity)
      shine.style.transform = `translateX(${(((-55 + shineProgress * 165) / 100) * width).toFixed(1)}px) skewX(-16deg)`
      shine.style.opacity = String(shineOpacity)
      frameID = requestAnimationFrame(frame)
    }
    frameID = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(frameID)
      window.removeEventListener('resize', updateWidth)
    }
  }, [animated])

  if (!label) return null
  return (
    <span ref={plateRef} className="probe-license-nameplate" data-animated={animated} style={animated ? undefined : { opacity: 1, transform: 'none', willChange: 'auto' }}>
      <strong ref={textRef} className="probe-license-text" style={animated ? undefined : { clipPath: 'none', willChange: 'auto' }}>{label}</strong>
      {animated && <span className="probe-license-shine-clip" aria-hidden="true">
        <span ref={shineRef} className="probe-license-shine" />
      </span>}
      {animated && <span ref={starsRef} className="probe-license-stars" aria-hidden="true" />}
    </span>
  )
}


// 共用原有名牌与动画，独立主题不再遗漏许可证页尾。
export function ProbeLicenseFooter({ badges, animated = true }: { badges: ProbePayload['license_badge']; animated?: boolean }) {
  if (!badges && EXTRA_LICENSE_BADGES.length === 0) return null
  const live = badges ? (Array.isArray(badges) ? badges : [badges]) : []
  const keyOf = (badge: { name?: string; display_name?: string }) => badge.name || badge.display_name || ''
  const merged = EXTRA_LICENSE_BADGES.map((badge) => live.find((item) => keyOf(item) === keyOf(badge)) || badge)
  const extras = live.filter((badge) => !EXTRA_LICENSE_BADGES.some((item) => keyOf(item) === keyOf(badge)))
  return <div className="probe-license-footer">
    {[...merged, ...extras]
      .filter((badge, index, all) => all.findIndex((item) => keyOf(item) === keyOf(badge)) === index)
      .map((badge, index) => <ProbeLicenseNameplate key={index} name={badge.name} displayName={badge.display_name} animated={animated} />)}
  </div>
}
