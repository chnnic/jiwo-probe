// 许可证铭牌动画：翻入 → 文字自左向右显现（星尘跟着走）→ 扫光 → 翻出，循环播放。
// 以前每枚铭牌各自用 requestAnimationFrame 每帧改样式，整页因此一直按 60 帧出主线程帧，
// 铭牌不在屏幕里也一样。现在换成 Web Animations 关键帧，只动 transform 和 opacity，
// 交给合成线程播放；铭牌离开视口时停掉。
// 一个周期拆成几段一次性动画，各部件只在自己该动的那段时间才挂着动画：整周期无限循环的话，
// 扫光、星尘在不显示的阶段也被当成「正在动」，每帧都要参与合成，GPU 反而更忙。

export const LICENSE_CYCLE_MS = 5596 // 主控 license-nameplate 实测周期
export const LICENSE_REVEAL_END = 0.36

const FLIP_IN_END = 0.08
const FLIP_OUT_START = 0.85
const FLIP_STEPS = 16

const clamp = (value: number, min: number, max: number) => (value < min ? min : value > max ? max : value)
const easeOutBack = (value: number) => {
  const strength = 1.70158
  return 1 + (strength + 1) * Math.pow(value - 1, 3) + strength * Math.pow(value - 1, 2)
}
const easeInBack = (value: number) => {
  const strength = 1.70158
  return (strength + 1) * value * value * value - strength * value * value
}

export type NameplateFrame = {
  rotateX: number
  scale: number
  opacity: number
  /** 文字已显现的比例，0～1 */
  reveal: number
  starOpacity: number
  /** 扫光走过的比例，0～1 */
  shineProgress: number
  shineOpacity: number
}

/** 一个周期里 progress（0～1）时刻的各项数值。 */
export function nameplateFrame(progress: number): NameplateFrame {
  const reveal = clamp(progress / LICENSE_REVEAL_END, 0, 1)
  let rotateX = 0
  let scale = 1
  let opacity = 1
  if (progress < FLIP_IN_END) {
    const amount = progress / FLIP_IN_END
    const eased = easeOutBack(amount)
    rotateX = -92 * (1 - eased)
    scale = 0.86 + 0.14 * eased
    opacity = clamp(amount * 2.2, 0, 1)
  } else if (progress > FLIP_OUT_START) {
    const amount = (progress - FLIP_OUT_START) / (1 - FLIP_OUT_START)
    const eased = easeInBack(amount)
    rotateX = 84 * eased
    scale = 1 - 0.14 * eased
    opacity = clamp(1 - amount * 1.5, 0, 1)
  }
  const starOpacity = progress < 0.04 ? progress / 0.04 : progress < 0.32 ? 1 : progress < 0.37 ? clamp(1 - (progress - 0.32) / 0.05, 0, 1) : 0
  const shineProgress = clamp((progress - 0.42) / 0.28, 0, 1)
  const shineActive = progress >= 0.42 && progress <= 0.7
  const shineOpacity = shineActive ? (shineProgress < 0.1 ? shineProgress / 0.1 : shineProgress > 0.85 ? clamp((1 - shineProgress) / 0.15, 0, 1) : 1) : 0
  return { rotateX, scale, opacity, reveal, starOpacity, shineProgress, shineOpacity }
}

export type NameplateKeyframe = { offset: number; transform: string; opacity?: number }

/** 周期里的一段：从 start 到 end（占周期的比例），frames 的 offset 是段内的 0～1 */
export type NameplatePhase = { start: number; end: number; frames: NameplateKeyframe[] }

export type NameplatePhases = {
  /** 铭牌翻入 */
  plateIn: NameplatePhase
  /** 铭牌翻出 */
  plateOut: NameplatePhase
  /** 文字外层：向左平移，靠 overflow 裁掉还没显现的右半边 */
  text: NameplatePhase
  /** 文字内层：反向平移抵消外层，文字本身停在原位 */
  inner: NameplatePhase
  stars: NameplatePhase
  shine: NameplatePhase
}

function phase(offsets: number[], build: (frame: NameplateFrame) => Omit<NameplateKeyframe, 'offset'>): NameplatePhase {
  const start = offsets[0]
  const end = offsets[offsets.length - 1]
  return { start, end, frames: offsets.map((offset) => ({ offset: (offset - start) / (end - start), ...build(nameplateFrame(offset)) })) }
}

const steps = (from: number, to: number, extra: number[] = []) => {
  const offsets = new Set<number>([from, to, ...extra])
  for (let step = 1; step < FLIP_STEPS; step++) offsets.add(from + (step / FLIP_STEPS) * (to - from))
  return [...offsets].sort((a, b) => a - b)
}
// 翻入、翻出带回弹缓动，密集取样；额外加上透明度的拐点（翻入 amount = 1/2.2 到 1，翻出 amount = 2/3 到 0）
const FLIP_IN_OFFSETS = steps(0, FLIP_IN_END, [FLIP_IN_END / 2.2])
const FLIP_OUT_OFFSETS = steps(FLIP_OUT_START, 1, [FLIP_OUT_START + ((1 - FLIP_OUT_START) * 2) / 3])
// 其余几段都是分段线性的，关键帧只需落在拐点上
const REVEAL_OFFSETS = [0, LICENSE_REVEAL_END]
const STAR_OFFSETS = [0, 0.04, 0.32, LICENSE_REVEAL_END, 0.37]
const SHINE_OFFSETS = [0.42, 0.448, 0.658, 0.7]

/** 按铭牌宽度（px）生成各段的关键帧；相邻关键帧之间线性插值。 */
export function nameplatePhases(width: number): NameplatePhases {
  const plate = (frame: NameplateFrame) => ({ opacity: frame.opacity, transform: `perspective(340px) rotateX(${frame.rotateX.toFixed(2)}deg) scale(${frame.scale.toFixed(3)})` })
  return {
    plateIn: phase(FLIP_IN_OFFSETS, plate),
    plateOut: phase(FLIP_OUT_OFFSETS, plate),
    text: phase(REVEAL_OFFSETS, (frame) => ({ transform: `translateX(${((frame.reveal - 1) * 100).toFixed(2)}%)` })),
    inner: phase(REVEAL_OFFSETS, (frame) => ({ transform: `translateX(${((1 - frame.reveal) * 100).toFixed(2)}%)` })),
    stars: phase(STAR_OFFSETS, (frame) => ({ opacity: frame.starOpacity, transform: `translateX(${(13 + frame.reveal * (width - 26)).toFixed(1)}px)` })),
    shine: phase(SHINE_OFFSETS, (frame) => ({ opacity: frame.shineOpacity, transform: `translateX(${(((-55 + frame.shineProgress * 165) / 100) * width).toFixed(1)}px) skewX(-16deg)` })),
  }
}

export type NameplateParts = {
  plate: HTMLElement
  text: HTMLElement
  inner: HTMLElement
  stars: HTMLElement
  shine: HTMLElement
}

const random = (min: number, max: number) => min + Math.random() * (max - min)

function fillStars(stars: HTMLElement, palette: readonly string[]) {
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
}

/** 给一枚铭牌挂上循环动画，返回停止函数。 */
export function startNameplateMotion(parts: NameplateParts, palette: readonly string[]): () => void {
  const { plate, text, inner, stars, shine } = parts
  fillStars(stars, palette)
  if (typeof plate.animate !== 'function') {
    // 不支持 Web Animations 的浏览器直接显示静态铭牌
    plate.setAttribute('data-motion', '')
    return () => plate.removeAttribute('data-motion')
  }

  let animations: Animation[] = []
  let timers: number[] = []
  const play = (element: HTMLElement, part: NameplatePhase, hold = false) => {
    const animation = element.animate(part.frames, { duration: (part.end - part.start) * LICENSE_CYCLE_MS, fill: hold ? 'forwards' : 'none' })
    animations.push(animation)
    return animation
  }
  const at = (fraction: number, run: () => void) => { timers.push(window.setTimeout(run, fraction * LICENSE_CYCLE_MS)) }
  // 翻出结束后停在不可见的末态（fill: forwards），等下一个周期的翻入顶替：两段之间不会闪出完整铭牌
  let flipOut: Animation | undefined
  const cycle = () => {
    timers = []
    animations = flipOut ? [flipOut] : []
    // 星尘、扫光的位移按 px 算，每个周期按当时的宽度重新生成
    const phases = nameplatePhases(plate.offsetWidth)
    // 翻入播完后不留变形：铭牌在静止阶段是一个普通图层，不用每帧单独合成。
    // 静止时的不透明由样式表里的 [data-motion] 给出（不改行内样式，那是 React 管的）
    plate.setAttribute('data-motion', '')
    play(plate, phases.plateIn)
    flipOut?.cancel()
    flipOut = undefined
    play(text, phases.text)
    play(inner, phases.inner)
    play(stars, phases.stars)
    at(phases.shine.start, () => play(shine, phases.shine))
    at(phases.plateOut.start, () => { flipOut = play(plate, phases.plateOut, true) })
    at(1, cycle)
  }
  const stop = () => {
    for (const timer of timers) window.clearTimeout(timer)
    for (const animation of animations) animation.cancel()
    timers = []
    animations = []
    flipOut = undefined
    plate.removeAttribute('data-motion')
  }

  if (typeof IntersectionObserver !== 'function') {
    cycle()
    return stop
  }
  // 只在视口内播放，回到视口时从头开始一个周期。观察不做变形的父元素：铭牌自己翻转到 90° 时高度为零
  let running = false
  const visibility = new IntersectionObserver((entries) => {
    const inView = entries[entries.length - 1].isIntersecting
    if (inView === running) return
    running = inView
    if (inView) cycle()
    else stop()
  }, { rootMargin: '80px' })
  visibility.observe(plate.parentElement ?? plate)
  return () => {
    visibility.disconnect()
    stop()
  }
}
