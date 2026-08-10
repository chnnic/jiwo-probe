/**
 * UI-scale 工具 — 配合 Komari `theme_settings.ui_scale`。
 *
 * 用 CSS zoom 整体缩放,字体 + 间距 + 卡片尺寸全部跟着放大。
 * 与 font_scale 独立,两者可叠加。
 *
 * 档位:
 *   normal  → 1.0 (默认,不设置 zoom)
 *   larger  → 1.1
 *   large   → 1.25
 *   xlarge  → 1.5
 */

export type UiScale = 'normal' | 'larger' | 'large' | 'xlarge'

export const UI_SCALE_VALUES: Record<UiScale, number> = {
  normal: 1,
  larger: 1.1,
  large: 1.25,
  xlarge: 1.5,
}

export function parseUiScale(v: unknown): UiScale {
  if (v === 'larger' || v === 'large' || v === 'xlarge') return v
  return 'normal'
}

export function applyUiScale(scale: UiScale): void {
  if (typeof document === 'undefined') return
  const value = UI_SCALE_VALUES[scale] ?? 1
  if (value === 1) {
    document.body.style.zoom = ''
  } else {
    document.body.style.zoom = String(value)
  }
}
