// Emerald 背景里三个缓慢漂移的光斑。
// 原先是 36rem 的纯色圆加 filter: blur(80px)：光斑一直在动，合成器每一帧都要把三张两千像素见方的图重新模糊一遍，
// 页面滚到哪都占着 GPU（Emerald 静置时 GPU 开销的八成）。
// 现在把模糊后的样子直接画出来：一张很小的画布上画一个径向渐变，由样式拉大到 66rem。光斑本来就是糊的，
// 小图放大看不出差别，合成器漂移时只是挪一张 64KB 的贴图；显存也比原先那三张整屏大的图层省。

/** 画布边长（像素）。显示时放大到 66rem，光斑最陡的地方每个画布像素也只变化 2% 不到 */
export const ORB_GLOW_SIZE = 128

/**
 * 「半径 18rem 的圆经标准差 5rem 的高斯模糊」后沿半径的亮度：[离圆心的距离 / 画布半径, 不透明度]。
 * 画布半径对应 33rem（圆的半径加三倍标准差），相邻两点之间线性过渡，和算出来的曲线相差不到 0.3%。
 */
export const ORB_GLOW_STOPS: ReadonlyArray<readonly [number, number]> = [
  [0, 0.998], [0.135, 0.993], [0.205, 0.978], [0.26, 0.954], [0.305, 0.919], [0.345, 0.874],
  [0.385, 0.814], [0.425, 0.737], [0.47, 0.635], [0.585, 0.346], [0.63, 0.246], [0.67, 0.171],
  [0.705, 0.12], [0.745, 0.075], [0.79, 0.042], [0.845, 0.018], [0.92, 0.005], [1, 0],
]

/** 样式里的颜色写成 `168 85 247` 这样的三个数（--orb），拼成各个色标的 rgba()；写法不对时用黑色 */
export function orbGlowColorStops(rgb: string): Array<{ offset: number; color: string }> {
  const channels = rgb.trim().split(/[\s,]+/).map(Number)
  const [red, green, blue] = channels.length === 3 && channels.every((value) => Number.isFinite(value) && value >= 0 && value <= 255) ? channels : [0, 0, 0]
  return ORB_GLOW_STOPS.map(([offset, alpha]) => ({ offset, color: `rgba(${red}, ${green}, ${blue}, ${alpha})` }))
}

/** 把光斑画到画布上，颜色读画布自己的 --orb。只需要画一次 */
export function paintOrbGlow(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const half = canvas.width / 2
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half)
  for (const stop of orbGlowColorStops(getComputedStyle(canvas).getPropertyValue('--orb'))) gradient.addColorStop(stop.offset, stop.color)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)
}
