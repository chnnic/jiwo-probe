/** 主控主题名解析；旧 mini 标识仅作为 Lite 的兼容别名。 */
export function parseThemeName(raw: string): { theme: string; gold: boolean; platinum: boolean; light?: boolean } {
  const lower = raw.toLowerCase().replace(/[\s_-]/g, '')
  if (lower === 'luminagold') return { theme: 'lumina', gold: true, platinum: false }
  if (lower === 'luminaplatinum') return { theme: 'lumina', gold: false, platinum: true }
  if (lower === 'premiumplatinum' || lower === 'premiumlight') return { theme: 'premium', gold: false, platinum: true }
  if (lower === 'glassmorphismlight') return { theme: 'glassmorphism', gold: false, platinum: false, light: true }
  if (lower === 'glassmorphismdark') return { theme: 'glassmorphism', gold: false, platinum: false, light: false }
  if (lower === 'lite' || lower === 'mini') return { theme: 'lite', gold: false, platinum: false }
  if (lower === 'litelight' || lower === 'minilight') return { theme: 'lite', gold: false, platinum: false, light: true }
  if (lower === 'litedark' || lower === 'minidark') return { theme: 'lite', gold: false, platinum: false, light: false }
  return { theme: isBuiltinTheme(raw.toLowerCase()) ? raw.toLowerCase() : raw, gold: false, platinum: false }
}

export function isBuiltinTheme(value?: string): boolean {
  return value === 'pixel' || value === 'flat' || value === 'anime' || value === 'glass' || value === 'lumina' || value === 'premium' || value === 'luminagold' || value === 'luminaplatinum' || value === 'premiumplatinum' || value === 'premiumlight' || value === 'ran' || value === 'glassmorphism' || value === 'emerald' || value === 'lite' || value === 'mini'
}

export function canonicalThemeOverride(value: string | null): string | null {
  return value?.toLowerCase() === 'mini' ? 'lite' : value
}
