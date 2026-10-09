// LuminaPlus 的配色（经典 / Paper / Mint）与明暗（浅 / 深）是两个独立的选择，各有一个按钮。
export type LuminaPlusPalette = 'classic' | 'paper' | 'mint'
export type LuminaPlusMode = 'light' | 'dark'
export type LuminaPlusAppearance = { palette: LuminaPlusPalette; mode: LuminaPlusMode }

export const LUMINAPLUS_PALETTE_KEY = 'jiwo-luminaplus-palette'
export const LUMINAPLUS_MODE_KEY = 'jiwo-luminaplus-mode'
/** 旧版把配色和明暗合成一个值存在这里（light / dark / paper / mint / mint-dark），'auto' 表示跟随主控。 */
export const LUMINAPLUS_COLOR_KEY = 'jiwo-luminaplus-color-mode'

export const LUMINAPLUS_PALETTE_NAMES: Record<LuminaPlusPalette, string> = {
  classic: 'Classic · 经典', paper: 'Paper · 陶纸', mint: 'Mint · 薄荷',
}
export const LUMINAPLUS_MODE_NAMES: Record<LuminaPlusMode, string> = { light: '浅色', dark: '深色' }

const PALETTES: LuminaPlusPalette[] = ['classic', 'paper', 'mint']

export function nextLuminaPlusPalette(current: LuminaPlusPalette): LuminaPlusPalette {
  return PALETTES[(PALETTES.indexOf(current) + 1) % PALETTES.length]
}

const isPalette = (value: unknown): value is LuminaPlusPalette => PALETTES.includes(value as LuminaPlusPalette)
const isMode = (value: unknown): value is LuminaPlusMode => value === 'light' || value === 'dark'

/** 旧版合并值拆成配色与明暗；无法识别时两项都为空。 */
export function splitLegacyLuminaPlusColor(value?: string | null): Partial<LuminaPlusAppearance> {
  switch (value) {
    case 'light': return { palette: 'classic', mode: 'light' }
    case 'dark': return { palette: 'classic', mode: 'dark' }
    case 'paper': return { palette: 'paper', mode: 'light' }
    case 'mint': return { palette: 'mint', mode: 'light' }
    case 'mint-dark': return { palette: 'mint', mode: 'dark' }
    default: return {}
  }
}

/**
 * 访客手动选的配色、明暗各自优先；没选的那一项跟随主控。
 * 主控：组合名决定配色（paper / mint），明暗看后缀，没有后缀按北京时间 06:00–18:00 浅色。
 * 旧版全局深色设置（其他主题留下的 darkOverride）只在访客没有明确「跟随主控」、主控也没指定配色时参考。
 */
export function resolveLuminaPlusAppearance({ savedPalette, savedMode, legacyColor, paper, mint, light, legacy, hour }: {
  savedPalette?: string | null; savedMode?: string | null; legacyColor?: string | null
  paper?: boolean; mint?: boolean; light?: boolean; legacy?: string | null; hour: number
}): LuminaPlusAppearance {
  const old = splitLegacyLuminaPlusColor(legacyColor)
  const palette: LuminaPlusPalette = isPalette(savedPalette) ? savedPalette
    : old.palette ?? (paper ? 'paper' : mint ? 'mint' : 'classic')
  if (isMode(savedMode)) return { palette, mode: savedMode }
  if (old.mode) return { palette, mode: old.mode }
  if (light !== undefined) return { palette, mode: light ? 'light' : 'dark' }
  // 主控指定了 Paper / Mint 时，其他主题留下的旧深色设置不再左右明暗
  if (legacyColor !== 'auto' && !paper && !mint) {
    if (legacy === 'dark' || legacy === 'gold') return { palette, mode: 'dark' }
    if (legacy === 'light' || legacy === 'platinum') return { palette, mode: 'light' }
  }
  return { palette, mode: hour >= 6 && hour < 18 ? 'light' : 'dark' }
}
