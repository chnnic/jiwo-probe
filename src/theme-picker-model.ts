import type { ThemeName } from './types'

export const THEME_OPTIONS: { value: ThemeName | null; label: string; color: string }[] = [
  { value: null, label: '跟随主控', color: '#92999f' },
  { value: 'pixel', label: '像素', color: '#cca34e' },
  { value: 'flat', label: '扁平', color: '#518cbf' },
  { value: 'anime', label: '动漫', color: '#ce86b0' },
  { value: 'glass', label: '玻璃', color: '#7fa8bb' },
  { value: 'lumina', label: 'Lumina', color: '#a991cd' },
  { value: 'luminaplus', label: 'LuminaPlus', color: '#be7c61' },
  { value: 'premium', label: 'Premium', color: '#c6a254' },
  { value: 'ran', label: '岚 · Ran', color: '#7d90b6' },
  { value: 'glassmorphism', label: 'Glassmorphism', color: '#62ad9a' },
  { value: 'emerald', label: 'Emerald', color: '#46ad83' },
  { value: 'lite', label: 'Lite', color: '#9489cc' },
]

export function pickerPosition(rect: { top: number; bottom: number; right: number }, viewport: { width: number; height: number }, height = 328) {
  const width = Math.min(344, Math.max(0, viewport.width - 16))
  const maxHeight = Math.max(0, viewport.height - 16)
  const measuredHeight = Math.min(height, maxHeight)
  const below = rect.bottom + 8
  const above = rect.top - measuredHeight - 8
  return {
    width, maxHeight,
    left: Math.max(8, Math.min(rect.right - width, viewport.width - width - 8)),
    top: Math.max(8, Math.min(below + measuredHeight <= viewport.height - 8 ? below : above >= 8 ? above : below, viewport.height - measuredHeight - 8)),
  }
}

export function pickerNextIndex(index: number, key: string, count: number) {
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  const delta = ({ ArrowDown: 2, ArrowUp: -2, ArrowRight: 1, ArrowLeft: -1 } as Record<string, number>)[key]
  return delta === undefined ? index : (index + delta + count) % count
}
