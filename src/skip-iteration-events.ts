// 不让任何人监听 animationiteration。
// React 会在根容器和每个 portal 容器上监听它支持的全部事件，animationiteration 也在内，尽管页面里没有一处用到。
// 只要文档里有这个监听，浏览器就得在每个 CSS 无限动画每一轮结束时回主线程派发一次事件，为此连出好几帧：
// 在线状态点这类呼吸动画本来完全由合成线程播放，一屏几十个、每轮不到两秒，主线程因此一直闲不下来。
// 用 Web Animations 接口起的动画不发这个事件，不受影响。

const SKIPPED = new Set(['animationiteration', 'webkitAnimationIteration'])

type ListenerTarget = { addEventListener: (type: string, ...rest: never[]) => void }

/** 包一层 addEventListener，丢掉对 animationiteration 的注册；其他事件原样放行。要在 React 挂载之前调用。 */
export function skipAnimationIterationEvents(target: ListenerTarget | undefined = typeof EventTarget === 'undefined' ? undefined : EventTarget.prototype as unknown as ListenerTarget): void {
  if (!target) return
  const add = target.addEventListener
  target.addEventListener = function (this: unknown, type: string, ...rest: never[]) {
    if (SKIPPED.has(type)) return
    return add.call(this, type, ...rest)
  }
}
