// 地球上的持续动画（轨道虚线、连线流动、连线光点、亮点光晕）的时间换算。Premium 地球由 use-motion-ticker 每一步
// 调用一次、画到画布上（见 globe-canvas-motion）；经典地球的弧线光点和亮点光晕按同样的步长预先算成关键帧，
// 交给合成线程播放（见 globe-overlay-motion）。
// 原先是 CSS 无限动画改 stroke-dashoffset 加 SVG animateMotion：两者都交不到合成线程，浏览器按屏幕刷新率
// 每帧重绘整张地球（连同 mask 与 drop-shadow）。主控内置探针在 v0.6.4-beta.1 改成每 50ms 推一步，这里同样处理。

/** 每一步的间隔：20fps，肉眼看不出与逐帧的区别，重绘次数降到 60Hz 屏的三分之一、120Hz 屏的六分之一 */
export const MOTION_STEP_MS = 50

/** 循环动画在 elapsedMs 时走到的进度（0～1） */
export function motionProgress(elapsedMs: number, durationMs: number): number {
  if (!(durationMs > 0) || !Number.isFinite(elapsedMs)) return 0
  const progress = (elapsedMs % durationMs) / durationMs
  return progress < 0 ? progress + 1 : progress
}

/** 虚线流动：一个周期内 stroke-dashoffset 从 0 走到 -distance；reverse 时从 -distance 走回 0（与原 CSS 动画一致） */
export function dashOffset(elapsedMs: number, durationMs: number, distance: number, reverse = false): number {
  const progress = motionProgress(elapsedMs, durationMs)
  return -distance * (reverse ? 1 - progress : progress)
}

// CSS 的 ease-out，即 cubic-bezier(0, 0, 0.58, 1)：按 x 反解参数再求 y
function easeOut(x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  let low = 0
  let high = 1
  for (let index = 0; index < 20; index++) {
    const mid = (low + high) / 2
    const at = 3 * (1 - mid) * mid * mid * 0.58 + mid * mid * mid
    if (at < x) low = mid
    else high = mid
  }
  const t = (low + high) / 2
  return 3 * (1 - t) * t * t + t * t * t
}

/** 地区亮点的光晕脉冲：前 80% 的时间从 0.8 不透明、0.5 倍大小缓出到全透明、1.7 倍，后 20% 保持不可见（与原 CSS 动画一致） */
export function pulseAt(elapsedMs: number, durationMs: number): { opacity: number; scale: number } {
  const eased = easeOut(Math.min(1, motionProgress(elapsedMs, durationMs) / 0.8))
  return { opacity: 0.8 * (1 - eased), scale: 0.5 + 1.2 * eased }
}

/** 是否该推进动画：不在视口、页面在后台、系统开了「减少动态效果」时停掉 */
export function shouldRunMotion(state: { inView: boolean; pageHidden: boolean; reducedMotion: boolean }): boolean {
  return state.inView && !state.pageHidden && !state.reducedMotion
}
