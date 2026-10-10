import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import '../probe-history.css'

/**
 * 历史趋势弹窗外壳（原生 dialog，按 --ph-* 变量随主题配色）：打开时锁住页面滚动、关闭后把焦点还给触发元素，
 * 点遮罩或按 Esc 关闭。连接数历史与 LuminaPlus 的 CPU / 内存 / 硬盘趋势共用。
 */
export function ProbeHistoryDialog({ title, subtitle, closeLabel, close, children }: {
  title: string
  subtitle?: string
  closeLabel: string
  close: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useLayoutEffect(() => {
    const dialog = ref.current!
    const focused = document.activeElement as HTMLElement | null
    dialog.showModal()
    return () => { dialog.close(); focused?.focus({ preventScroll: true }) }
  }, [])
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])
  return createPortal(<dialog ref={ref} className="probe-history-dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); close() }} onKeyDown={event => event.stopPropagation()}
    onMouseDown={event => event.stopPropagation()} onClick={event => {
      event.stopPropagation()
      const rect = event.currentTarget.getBoundingClientRect()
      if (event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) close()
    }}>
    <header><div><h2 id={titleId}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" aria-label={closeLabel} onClick={close} autoFocus><X size={18} /></button></header>
    {children}
  </dialog>, document.body)
}
