// 滚出屏幕的 CSS 无限动画先停着，回到屏幕里再接着播。
// 在线状态点的呼吸、面板顶边的流光这类动画由合成线程播放，本身不占主线程；但只要它们的宿主元素在屏幕外还在动，
// 浏览器每出一个主线程帧（滚动、数据刷新、任何重绘）都要把整页重新分层一遍：Premium、Glassmorphism、Emerald
// 滚到列表中段时，一个什么都没改的帧要 4～6ms，把屏幕外的动画停掉后降到 1～2ms，「重新分层」那一项归零。
// 屏幕外的元素一多（卡片渲染出来就不会再卸载），合成线程也得一直替这些看不见的图层算动画。
// 只管样式表里写的无限循环动画（CSSAnimation）；一次性的动画（入场、过渡）和脚本用 Web Animations 起的动画不碰，
// 后者各自有只在屏幕内播放的逻辑（回程勋章、许可证铭牌、地球）。

/** 用到的那部分 Animation 接口（测试时用假对象） */
export type LoopingAnimation = {
  playState: string
  startTime: number | null | CSSNumericValue
  pause: () => void
  play: () => void
}

/**
 * 停下一个正在播的动画，记下它的开始时间。已经被别人停掉的（样式里写了 paused、还没开始）不碰，也不记。
 * held 里有记录的动画才归 resumeAnimation 管。
 */
export function holdAnimation<T extends LoopingAnimation>(animation: T, held: WeakMap<T, number | null>): void {
  if (held.has(animation) || animation.playState !== 'running') return
  held.set(animation, typeof animation.startTime === 'number' ? animation.startTime : null)
  animation.pause()
}

/**
 * 接着播 holdAnimation 停下的动画：把开始时间改回停之前的值，相当于它一直没停过。
 * 同屏的呼吸点原本是同一时刻开始、一起闪的，各自停了不同的时间以后照样对得上节拍。
 * 停着的期间被别人恢复过的不再动它。
 */
export function resumeAnimation<T extends LoopingAnimation>(animation: T, held: WeakMap<T, number | null>): void {
  if (!held.has(animation)) return
  const startTime = held.get(animation)
  held.delete(animation)
  if (animation.playState !== 'paused') return
  if (typeof startTime !== 'number') {
    animation.play()
    return
  }
  try {
    animation.startTime = startTime
  } catch {
    // 个别浏览器不让改 CSS 动画的开始时间：退一步直接接着播，只是节拍对不上
    animation.play()
  }
}

/** 挂在元素自己或它的伪元素上的 CSS 无限动画 */
function loopingAnimations(element: Element): Animation[] {
  return element.getAnimations({ subtree: true }).filter((animation) =>
    'animationName' in animation && animation.effect instanceof KeyframeEffect && animation.effect.target === element
    && animation.effect.getComputedTiming().iterations === Infinity)
}


/**
 * 开始盯着页面里的 CSS 无限动画：宿主元素离开屏幕就停，回来就接着播。在 React 挂载之前调用一次。
 * 不支持 IntersectionObserver 或 Web Animations 的浏览器什么都不做，动画照常一直播。
 */
export function pauseOffscreenAnimations(): void {
  if (typeof document === 'undefined' || typeof IntersectionObserver === 'undefined' || typeof Element === 'undefined'
    || typeof Element.prototype.getAnimations !== 'function' || typeof KeyframeEffect === 'undefined') return
  const held = new WeakMap<Animation, number | null>()
  // 盯着的元素 → 现在是不是在屏幕外
  const offscreen = new WeakMap<Element, boolean>()
  const apply = (element: Element) => {
    const hold = offscreen.get(element) === true
    for (const animation of loopingAnimations(element)) {
      if (hold) holdAnimation(animation, held)
      else resumeAnimation(animation, held)
    }
  }
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const element = entry.target
      if (!element.isConnected) {
        observer.unobserve(element)
        offscreen.delete(element)
        continue
      }
      offscreen.set(element, !entry.isIntersecting)
      apply(element)
    }
  })
  // 动画一开始就会冒泡上来一次（伪元素上的动画报在宿主元素上），之后不再有事件：不用轮询，也不用扫整页
  document.addEventListener('animationstart', (event) => {
    const element = event.target
    if (!(element instanceof Element)) return
    if (offscreen.has(element)) {
      // 已经盯着的元素又起了新动画（换了 class）：它要是在屏幕外，新动画也停着
      if (offscreen.get(element)) apply(element)
      return
    }
    if (loopingAnimations(element).length === 0) return
    offscreen.set(element, false)
    observer.observe(element)
  }, true)
}
