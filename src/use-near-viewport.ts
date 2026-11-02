import { useLayoutEffect, useRef, useState } from 'react'

// 提前这么多像素开始渲染，正常滚动时看不到占位卡。
const NEAR_VIEWPORT_MARGIN_PX = 1000

const watchers = new Map<Element, () => void>()
let observer: IntersectionObserver | undefined

function watch(element: Element, onNear: () => void): () => void {
  observer ??= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) watchers.get(entry.target)?.()
    }
  }, { rootMargin: `${NEAR_VIEWPORT_MARGIN_PX}px 0px` })
  watchers.set(element, onNear)
  observer.observe(element)
  return () => {
    watchers.delete(element)
    observer?.unobserve(element)
  }
}

/** 元素第一次接近视口后变为 true 并保持：内容一旦渲染就不再卸载，滚动回去不用重建。 */
export function useNearViewport<T extends Element>() {
  const ref = useRef<T>(null)
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined')
  // 首屏在绘制前同步判断（IntersectionObserver 的回调要到下一帧），首屏卡片不会闪一下占位。
  useLayoutEffect(() => {
    const element = ref.current
    if (near || !element) return
    const rect = element.getBoundingClientRect()
    if (rect.top < window.innerHeight + NEAR_VIEWPORT_MARGIN_PX && rect.bottom > -NEAR_VIEWPORT_MARGIN_PX) {
      setNear(true)
      return
    }
    return watch(element, () => setNear(true))
  }, [near])
  return [ref, near] as const
}
