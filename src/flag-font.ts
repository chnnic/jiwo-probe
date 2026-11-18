// Windows 自带的 emoji 字体没有国旗，Chrome / Edge 会把 🇭🇰 显示成「HK」两个字母。
// 做法与主控 v0.6.2 相同：加一个只含国旗的 Twemoji 字体，放在各字体栈最前面，
// unicode-range 只接管国旗码位，页面上没有国旗时浏览器不会下载它（78 KB）。
// 只在需要的浏览器上注册：macOS / iOS / Android 自带国旗，Windows 上的 Firefox 自带 Twemoji Mozilla。

export const FLAG_FONT_NAME = 'Twemoji Country Flags'

/** 区域指示符（国旗）、黑旗与英格兰 / 苏格兰 / 威尔士用到的标签字符 */
const FLAG_RANGE = 'U+1F1E6-1F1FF, U+1F3F4, U+E0062-E0063, U+E0065, U+E0067, U+E006C, U+E006E, U+E0073-E0074, U+E0077, U+E007F'

export function needsFlagFont(userAgent: string): boolean {
  return /Windows/i.test(userAgent) && !/Firefox|FxiOS/i.test(userAgent)
}

export function flagFontCss(): string {
  return `@font-face{font-family:"${FLAG_FONT_NAME}";src:url("/fonts/TwemojiCountryFlags.woff2") format("woff2");unicode-range:${FLAG_RANGE};font-display:swap}`
}

export function installFlagFont(): void {
  if (typeof document === 'undefined' || typeof navigator === 'undefined') return
  if (!needsFlagFont(navigator.userAgent) || document.getElementById('probe-flag-font')) return
  const style = document.createElement('style')
  style.id = 'probe-flag-font'
  style.textContent = flagFontCss()
  document.head.appendChild(style)
}
