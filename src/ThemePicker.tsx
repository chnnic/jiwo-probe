import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Palette } from 'lucide-react'
import type { ThemeName } from './types'
import { THEME_OPTIONS, pickerNextIndex, pickerPosition } from './theme-picker-model'
import './theme-picker.css'

/** Shared by every Jiwo header except Ran, whose picker stays independent. */
export function ThemeSelect({ value, onChange, buttonClassName = 'theme-trigger' }: {
  value: ThemeName | null
  onChange: (name: ThemeName | null) => void
  buttonClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 8, left: 8, width: Math.min(344, innerWidth - 16), maxHeight: innerHeight - 16 })
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const id = useId()
  const selected = THEME_OPTIONS.findIndex(option => option.value === value)
  const label = THEME_OPTIONS[selected]?.label || value || '跟随主控'
  const close = (restoreFocus = false) => {
    setOpen(false)
    if (restoreFocus) trigger.current?.focus()
  }

  useLayoutEffect(() => {
    if (!open || !trigger.current || !menu.current) return
    setPosition(pickerPosition(trigger.current.getBoundingClientRect(), { width: innerWidth, height: innerHeight }, menu.current.scrollHeight + 2))
    menu.current.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')[Math.max(0, selected)]?.focus()
  }, [open, selected])

  useEffect(() => {
    if (!open) return
    const outside = (event: Event) => {
      if (event.target instanceof Node && (trigger.current?.contains(event.target) || menu.current?.contains(event.target))) return
      setOpen(false)
    }
    const scroll = (event: Event) => {
      if (event.target instanceof Node && menu.current?.contains(event.target)) return
      setOpen(false)
    }
    const resize = () => setOpen(false)
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus() }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', outside)
    document.addEventListener('keydown', escape)
    window.addEventListener('scroll', scroll, true)
    window.addEventListener('resize', resize)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('focusin', outside)
      document.removeEventListener('keydown', escape)
      window.removeEventListener('scroll', scroll, true)
      window.removeEventListener('resize', resize)
    }
  }, [open])

  return <div className="theme-select probe-theme-picker">
    <button ref={trigger} type="button" className={`${buttonClassName} probe-theme-trigger`}
      aria-label="切换主题" title={`主题: ${label}`} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => setOpen(previous => !previous)}
      onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true) } }}>
      <Palette className="probe-theme-palette" size={18} aria-hidden="true" />
      <ChevronDown className="probe-theme-chevron" size={12} aria-hidden="true" />
    </button>
    {open && createPortal(<div ref={menu} id={id} className="probe-theme-panel" style={position} role="menu" aria-label="主题选择"
      onKeyDown={event => {
        const buttons = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') || [])
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
        if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
          event.preventDefault()
          buttons[pickerNextIndex(Math.max(0, index), event.key, buttons.length)]?.focus()
        }
        if (event.key === 'Tab') close()
      }}>
      <div className="probe-theme-panel-heading" role="presentation"><span>外观主题</span><small>选择即应用</small></div>
      <div className="probe-theme-grid" role="presentation">
        {THEME_OPTIONS.map(option => <button key={option.value || 'auto'} type="button" role="menuitemradio" aria-checked={value === option.value}
          tabIndex={-1} onClick={() => { close(true); onChange(option.value) }}>
          <i className="probe-theme-swatch" style={{ backgroundColor: option.color }} aria-hidden="true" />
          <span>{option.label}</span>
          <Check size={12} className="probe-theme-check" aria-hidden="true" />
        </button>)}
      </div>
    </div>, document.body)}
  </div>
}
