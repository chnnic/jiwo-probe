import type { ReactNode } from 'react'
import { useNearViewport } from './use-near-viewport'
import './lazy-card.css'

/**
 * 卡片列表的按需渲染：一张卡几百个元素，几十台服务器就是几万个。屏幕外的卡片先只放占位
 * （保留名称，页面内搜索还能命中），滚动到附近才渲染完整内容，之后不再卸载。
 * 这样首屏和每 3 秒一次的刷新都只计算看得到的卡片。
 */
export function LazyCard({ className, name, estimatedHeight, children }: {
  /** 占位用的卡片类名，沿用真实卡片的外观 */
  className: string
  name: string
  /** 取这种卡片的常见高度，渲染出真实内容时页面基本不跳动 */
  estimatedHeight: number
  children: ReactNode
}) {
  const [ref, near] = useNearViewport<HTMLElement>()
  if (near) return <>{children}</>
  return <article ref={ref} className={`${className} lazy-card-pending`} style={{ minHeight: estimatedHeight }} aria-label={name}><span className="lazy-card-name">{name}</span></article>
}
