export type LuminaPlusColor = 'light' | 'dark' | 'paper'
export const LUMINAPLUS_COLOR_KEY = 'jiwo-luminaplus-color-mode'
export const LUMINAPLUS_COLOR_NAMES: Record<LuminaPlusColor, string> = {
  light: 'Light · 浅色', dark: 'Carbon · 炭黑', paper: 'Paper · 陶纸',
}

export function nextLuminaPlusColor(current: LuminaPlusColor): LuminaPlusColor {
  return current === 'light' ? 'dark' : current === 'dark' ? 'paper' : 'light'
}

/** Keep the new preference private to LuminaPlus; legacy users retain their previous mode. */
export function resolveLuminaPlusColor({ saved, paper, light, legacy, hour }: {
  saved?: string | null; paper?: boolean; light?: boolean; legacy?: string | null; hour: number
}): LuminaPlusColor {
  if (saved === 'light' || saved === 'dark' || saved === 'paper') return saved
  if (paper) return 'paper'
  // Explicitly following the controller ignores another theme's saved dark override.
  if (saved !== 'auto') {
    if (legacy === 'dark' || legacy === 'gold') return 'dark'
    if (legacy === 'light' || legacy === 'platinum') return 'light'
  }
  if (light !== undefined) return light ? 'light' : 'dark'
  return hour >= 6 && hour < 18 ? 'light' : 'dark'
}
