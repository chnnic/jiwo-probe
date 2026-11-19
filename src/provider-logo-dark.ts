// 判断一个服务商 logo 是不是「深色 logo」（黑字、深灰、深蓝之类），移植自上游 434e33d。
// 深色配色下这类 logo 透明显示会看不见，要反色。判断方法与门槛和主控前端 use-dark-logo 一致：
// 不透明像素里「暗像素」（相对亮度 < 0.08，和深色背景对比度不到约 2:1）占 30% 以上。

const SIZE = 32
const ALPHA_MIN = 77
const DARK_LUMINANCE = 0.08
const DARK_SHARE = 0.3

// sRGB 分量转线性值（算相对亮度用）
function channel(value: number): number {
  const c = value / 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** data 是 RGBA 像素，每 4 个一组。 */
export function isDarkLogoPixels(data: ArrayLike<number>): boolean {
  let opaque = 0
  let dark = 0
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < ALPHA_MIN) continue
    opaque++
    if (0.2126 * channel(data[i]) + 0.7152 * channel(data[i + 1]) + 0.0722 * channel(data[i + 2]) < DARK_LUMINANCE) dark++
  }
  return opaque > 0 && dark / opaque >= DARK_SHARE
}

// 判断结果按图片地址缓存：同一个 logo 在列表里会出现很多次，每个只量一次。
const cache = new Map<string, boolean>()
let canvas: HTMLCanvasElement | undefined

/** 量一张已经加载完的图。读不了像素就按原样显示（返回 false）。 */
export function measureDarkLogo(src: string, img: HTMLImageElement): boolean {
  const known = cache.get(src)
  if (known !== undefined) return known
  let dark = false
  try {
    canvas ??= Object.assign(document.createElement('canvas'), { width: SIZE, height: SIZE })
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (ctx) {
      ctx.clearRect(0, 0, SIZE, SIZE)
      ctx.drawImage(img, 0, 0, SIZE, SIZE)
      dark = isDarkLogoPixels(ctx.getImageData(0, 0, SIZE, SIZE).data)
    }
  } catch {
    dark = false
  }
  cache.set(src, dark)
  return dark
}

export const knownDarkLogo = (src: string): boolean => cache.get(src) === true
