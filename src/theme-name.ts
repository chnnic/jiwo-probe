/** 内置主题与 Ran 变体统一忽略大小写；未知自定义 CSS 类名保持原样。 */
const BUILTIN_THEMES = new Set([
  'pixel', 'flat', 'anime', 'glass', 'lumina', 'luminaplus', 'premium',
  'ran', 'glassmorphism', 'emerald', 'lite', 'mini',
  'luminagold', 'luminaplatinum', 'premiumplatinum', 'premiumlight',
  'ran-night', 'ran-mist', 'ran-ember', 'ran-sakura', 'ran-lavender',
  'ran-tomcat', 'ran-teal', 'ran-midnight', 'ran-mint', 'ran-butter', 'ran-ji',
])

// LuminaPlus 的配色组合名（主控直接写这个名字即可指定配色）。luminaplus-paper 沿用旧行为固定浅色；
// Mint 不带明暗后缀时按北京时间自动切换浅 / 深；-light / -dark 后缀固定明暗。
const LUMINAPLUS_PALETTES: Record<string, { canonical: string; light?: boolean; paper?: boolean; mint?: boolean }> = {
  luminapluspaper: { canonical: 'luminaplus-paper', light: true, paper: true },
  luminapluspaperlight: { canonical: 'luminaplus-paper-light', light: true, paper: true },
  luminapluspaperdark: { canonical: 'luminaplus-paper-dark', light: false, paper: true },
  luminaplusmint: { canonical: 'luminaplus-mint', mint: true },
  luminaplusmintlight: { canonical: 'luminaplus-mint-light', light: true, mint: true },
  luminaplusmintdark: { canonical: 'luminaplus-mint-dark', light: false, mint: true },
}

export function parseThemeName(raw: string): { theme: string; gold: boolean; platinum: boolean; light?: boolean; paper?: boolean; mint?: boolean } {
  const lower = raw.toLowerCase().replace(/[\s_-]/g, '')
  if (lower === 'luminaplus') return { theme: 'luminaplus', gold: false, platinum: false }
  if (lower === 'luminapluslight') return { theme: 'luminaplus', gold: false, platinum: false, light: true }
  if (lower === 'luminaplusdark') return { theme: 'luminaplus', gold: false, platinum: false, light: false }
  const palette = LUMINAPLUS_PALETTES[lower]
  if (palette) {
    const { canonical: _canonical, ...flags } = palette
    return { theme: 'luminaplus', gold: false, platinum: false, ...flags }
  }
  if (lower === 'luminagold') return { theme: 'lumina', gold: true, platinum: false }
  if (lower === 'luminaplatinum') return { theme: 'lumina', gold: false, platinum: true }
  if (lower === 'premiumplatinum' || lower === 'premiumlight') return { theme: 'premium', gold: false, platinum: true }
  if (lower === 'glassmorphismlight') return { theme: 'glassmorphism', gold: false, platinum: false, light: true }
  if (lower === 'glassmorphismdark') return { theme: 'glassmorphism', gold: false, platinum: false, light: false }
  if (lower === 'lite' || lower === 'mini') return { theme: 'lite', gold: false, platinum: false }
  if (lower === 'litelight' || lower === 'minilight') return { theme: 'lite', gold: false, platinum: false, light: true }
  if (lower === 'litedark' || lower === 'minidark') return { theme: 'lite', gold: false, platinum: false, light: false }
  const name = raw.trim().toLowerCase()
  return { theme: isBuiltinTheme(name) ? name : raw, gold: false, platinum: false }
}

export function isBuiltinTheme(value?: string): boolean {
  return typeof value === 'string' && (value.toLowerCase().replace(/[\s_-]/g, '') in LUMINAPLUS_PALETTES || BUILTIN_THEMES.has(value.trim().toLowerCase()))
}

export function canonicalThemeOverride(value: string | null): string | null {
  if (value === null) return null
  const name = value.trim().toLowerCase()
  const palette = LUMINAPLUS_PALETTES[name.replace(/[\s_-]/g, '')]
  if (palette) return palette.canonical
  return name === 'mini' ? 'lite' : isBuiltinTheme(name) ? name : value
}
