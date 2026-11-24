// 交给合成线程播放的关键帧动画里，一段「保持不动」的时间怎么写，各浏览器内核的合成器脾气不同。

/**
 * 保持方式：
 * - step：保持段开头的关键帧带阶梯缓动（step-end），停到下一个关键帧。Chrome、Firefox 的合成器能精确保持，
 *   这段时间里没有东西要重画。
 * - linear：保持段两头放两个数值相同的关键帧，中间线性插值。Safari 的合成器不认阶梯缓动，遇到会退回主线程逐帧算，
 *   所以给它用这种；Chrome 用这种的话，两个相同数值之间插值有浮点误差，每帧都被当成变了，合成器会按屏幕刷新率重画。
 */
export type StepHold = 'step' | 'linear'

/** 按浏览器内核挑保持方式：Safari 以及 iOS 上的所有浏览器（都是 WebKit）用 linear，其余用 step。 */
export function stepHoldFor(userAgent: string): StepHold {
  return /AppleWebKit\//.test(userAgent) && !/(Chrome|Chromium)\//.test(userAgent) ? 'linear' : 'step'
}
