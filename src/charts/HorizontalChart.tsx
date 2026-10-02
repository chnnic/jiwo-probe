import { useRef } from 'react'

export function HorizontalChart({ children, width, fixedAxis = true }: { children: React.ReactNode; width: number; fixedAxis?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; left: number } | null>(null)
  return (
    <div className="chart-scroll-frame">
      {fixedAxis && <div className="chart-fixed-y-axis" aria-hidden="true">
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
