export type LuminaPlusColor = 'light' | 'dark' | 'paper' | 'mint' | 'mint-dark'
export const LUMINAPLUS_COLOR_KEY = 'jiwo-luminaplus-color-mode'
export const LUMINAPLUS_COLOR_NAMES: Record<LuminaPlusColor, string> = {
  light: 'Light · 浅色', dark: 'Carbon · 炭黑', paper: 'Paper · 陶纸', mint: 'Mint · 薄荷', 'mint-dark': 'Mint Night · 薄荷夜',
}
const ORDER: LuminaPlusColor[] = ['light', 'dark', 'paper', 'mint', 'mint-dark']

export function nextLuminaPlusColor(current: LuminaPlusColor): LuminaPlusColor {
  return ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]
}

/** Keep the new preference private to LuminaPlus; legacy users retain their previous mode. */
export function resolveLuminaPlusColor({ saved, paper, mint, light, legacy, hour }: {
  saved?: string | null; paper?: boolean; mint?: boolean; light?: boolean; legacy?: string | null; hour: number
}): LuminaPlusColor {
  if ((ORDER as string[]).includes(saved ?? '')) return saved as LuminaPlusColor
  if (paper) return 'paper'
  // 主控写 luminaplus-mint：带明暗后缀固定，否则按北京时间 06:00–18:00 浅色
  if (mint) return (light ?? (hour >= 6 && hour < 18)) ? 'mint' : 'mint-dark'
  // Explicitly following the controller ignores another theme's saved dark override.
  if (saved !== 'auto') {
    if (legacy === 'dark' || legacy === 'gold') return 'dark'
    if (legacy === 'light' || legacy === 'platinum') return 'light'
  }
  if (light !== undefined) return light ? 'light' : 'dark'
  return hour >= 6 && hour < 18 ? 'light' : 'dark'
}
