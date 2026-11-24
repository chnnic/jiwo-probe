import { useEffect, useRef, useState, type RefObject } from 'react'
import { MOTION_STEP_MS, shouldRunMotion } from './globe-motion'

// 全页共用一个 50ms 定时器：各处动画在同一个任务里一起推进，浏览器每 50ms 只出一帧。
// 各自起定时器的话相位错开，十几个动画会把出帧次数重新顶回屏幕刷新率。
const steppers = new Set<(deltaMs: number) => void>()
let clock: number | undefined
let lastTick = 0

function tick() {
  const now = performance.now()
  // 定时器被浏览器挂起后恢复（例如标签页冻结）时不一次跳一大段
  const delta = Math.min(now - lastTick, MOTION_STEP_MS * 4)
  lastTick = now
  for (const step of steppers) step(delta)
}

function addStepper(step: (deltaMs: number) => void): () => void {
  steppers.add(step)
  if (clock === undefined) {
    lastTick = performance.now()
    clock = window.setInterval(tick, MOTION_STEP_MS)
  }
  return () => {
    steppers.delete(step)
    if (steppers.size === 0 && clock !== undefined) {
      window.clearInterval(clock)
      clock = undefined
    }
  }
}

/**
 * 盯着目标元素该不该动：在视口内、页面在前台、系统没开「减少动态效果」时为 true，变化时回调（挂上时先回调一次）。
 * 返回取消函数。
 */
function watchMotion(target: Element, onChange: (run: boolean) => void): () => void {
  // SVG 内部的元素没有自己的布局框，是否在视口内按它所在的那张 SVG 判断
  const element = target instanceof SVGElement ? target.ownerSVGElement ?? target : target
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  // 不支持 IntersectionObserver 的环境当作一直在视口内
  let inView = typeof IntersectionObserver === 'undefined'
  let running: boolean | undefined
  const sync = () => {
    const run = shouldRunMotion({ inView, pageHidden: document.hidden, reducedMotion: !!reduced?.matches })
    if (run === running) return
    running = run
    onChange(run)
  }
  const observer = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver((entries) => {
    inView = entries[entries.length - 1]?.isIntersecting ?? false
    sync()
  })
  observer?.observe(element)
  document.addEventListener('visibilitychange', sync)
  reduced?.addEventListener?.('change', sync)
  sync()
  return () => {
    observer?.disconnect()
    document.removeEventListener('visibilitychange', sync)
    reduced?.removeEventListener?.('change', sync)
  }
}

/**
 * 每 50ms 调一次 paint(已走过的毫秒数)，只在目标元素在视口内、页面在前台、系统没开「减少动态效果」时走。
 * 停着的时候时间不往前走，恢复后从停下的位置接着动，不会跳。paused() 返回 true 的那一步跳过（例如正在拖动）。
 */
export function useMotionTicker(target: RefObject<Element | null>, paint: (elapsedMs: number) => void, paused?: () => boolean) {
  const paintRef = useRef(paint)
  const pausedRef = useRef(paused)
  useEffect(() => {
    paintRef.current = paint
    pausedRef.current = paused
  })
  useEffect(() => {
    const current = target.current
    if (!current) return
    let elapsed = 0
    let stop: (() => void) | undefined
    const step = (delta: number) => {
      if (pausedRef.current?.()) return
      elapsed += delta
      paintRef.current(elapsed)
    }
    const unwatch = watchMotion(current, (run) => {
      if (run && !stop) {
        paintRef.current(elapsed)
        stop = addStepper(step)
      } else if (!run && stop) {
        stop()
        stop = undefined
      }
    })
    return () => {
      unwatch()
      stop?.()
    }
  }, [target])
}

/**
 * 目标元素上的动画现在该不该播：条件同 useMotionTicker。给交由合成线程播放的动画用（Web Animations / CSS），
 * 不该播时由调用方取消动画，屏幕外不占合成器。
 */
export function useMotionRunning(target: RefObject<Element | null>): boolean {
  const [running, setRunning] = useState(false)
  useEffect(() => {
    const current = target.current
    if (!current) return
    const unwatch = watchMotion(current, setRunning)
    return () => {
      unwatch()
      setRunning(false)
    }
  }, [target])
  return running
}
