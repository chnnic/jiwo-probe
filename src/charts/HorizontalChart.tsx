import { useLayoutEffect, useRef, useState } from 'react'

export function HorizontalChart({ children, width, fixedAxis = true }: { children: React.ReactNode; width: number; fixedAxis?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; left: number } | null>(null)
  // 固定纵轴要和滚动区里的图一样高：横向滚动条（Windows / 常显滚动条时）占掉的那截不算，
  // 否则两边纵轴比例对不上，刻度错开几像素叠成重影（移植上游 4cf4ae7，#973）
  const [gutter, setGutter] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setGutter(Math.max(0, el.offsetHeight - el.clientHeight))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return (
    <div className="chart-scroll-frame">
      {fixedAxis && <div className="chart-fixed-y-axis" aria-hidden="true" style={{ bottom: gutter }}>
        <div className="chart-scroll-inner" style={{ width, minWidth: '100%' }}>
          {children}
        </div>
      </div>}
      <div
        ref={ref}
        className="chart-scroll"
        style={{ touchAction: 'pan-x pan-y' }}
        onPointerDown={(e) => {
          if (e.pointerType !== 'mouse' || !ref.current) return
          drag.current = { x: e.clientX, left: ref.current.scrollLeft }
          ref.current.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (drag.current && ref.current)
            ref.current.scrollLeft = drag.current.left - (e.clientX - drag.current.x)
        }}
        onPointerUp={(e) => {
          drag.current = null
          ref.current?.releasePointerCapture(e.pointerId)
        }}
        onPointerCancel={() => {
          drag.current = null
        }}
      >
        <div className="chart-scroll-inner" style={{ width, minWidth: '100%' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
