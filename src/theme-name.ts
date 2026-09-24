/** 内置主题与 Ran 变体统一忽略大小写；未知自定义 CSS 类名保持原样。 */
const BUILTIN_THEMES = new Set([
  'pixel', 'flat', 'anime', 'glass', 'lumina', 'luminaplus', 'premium',
  'ran', 'glassmorphism', 'emerald', 'lite', 'mini',
  'luminagold', 'luminaplatinum', 'premiumplatinum', 'premiumlight',
  'ran-night', 'ran-mist', 'ran-ember', 'ran-sakura', 'ran-lavender',
  'ran-tomcat', 'ran-teal', 'ran-midnight', 'ran-mint', 'ran-butter', 'ran-ji',
])

export function parseThemeName(raw: string): { theme: string; gold: boolean; platinum: boolean; light?: boolean } {
  const lower = raw.toLowerCase().replace(/[\s_-]/g, '')
  if (lower === 'luminaplus') return { theme: 'luminaplus', gold: false, platinum: false }
  if (lower === 'luminapluslight') return { theme: 'luminaplus', gold: false, platinum: false, light: true }
  if (lower === 'luminaplusdark') return { theme: 'luminaplus', gold: false, platinum: false, light: false }
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
  return typeof value === 'string' && BUILTIN_THEMES.has(value.trim().toLowerCase())
}

export function canonicalThemeOverride(value: string | null): string | null {
  if (value === null) return null
  const name = value.trim().toLowerCase()
  return name === 'mini' ? 'lite' : isBuiltinTheme(name) ? name : value
}
