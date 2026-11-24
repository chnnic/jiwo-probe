// 黑金地球（Premium、Glassmorphism、Emerald 共用）上一直在动的三样：轨道虚线、地区之间的连线流动、连线上的光点。
// 这三样原先是地球那张 SVG 里的元素，每 50ms 改一次 stroke-dashoffset / transform。虚线流动交不到合成线程，
// 每改一次整页就要走一遍样式、布局、绘制、分层，地球在屏幕内时主线程每秒出二十帧，页面越复杂每帧越贵。
// 现在画到垫在 SVG 下面的一张画布上：步长、时长、方向都不变，但画布重画不经过页面的样式和绘制流程，每一步便宜得多。
// 画布在地球下面：轨道本来就排在地球之前绘制（下半圈会被地球的投影压暗）；连线和光点只出现在地球外圈以外，
// 那里地球什么都不画，叠放顺序换了画面也不变。地区标签仍在 SVG 里，照旧盖在连线上面。
// 颜色、线宽、虚线样式不写在这里：SVG 里留一组不显示的同名元素当「样式探针」，各主题原有的样式规则照常命中它们，
// 画之前读它们的计算样式（readGlobeMotionStyle）。
import { dashOffset, motionProgress } from './globe-motion.ts'

const TAU = Math.PI * 2

/** 一段圆弧：圆心、半径（SVG 单位），起始角和顺时针扫过的角度（弧度，y 轴向下） */
export type GlobeArc = { cx: number; cy: number; radius: number; start: number; sweep: number }

/**
 * SVG 路径 `M from A radius radius 0 0 1 to` 画的那段圆弧：不超过半圈、顺时针。
 * 两点之间的顺时针夹角超过半圈时，SVG 取的是另一侧那个圆上的短弧（圆心在弦的另一边），这里同样处理；
 * 弦比直径还长时按 SVG 的规则把半径放大到弦长的一半。两点重合时 SVG 不画，返回 undefined。
 */
export function clockwiseArc(from: { x: number; y: number }, to: { x: number; y: number }, radius: number): GlobeArc | undefined {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const chord = Math.hypot(dx, dy)
  if (!(chord > 1e-9) || !(radius > 0)) return undefined
  const r = Math.max(radius, chord / 2)
  const offset = Math.sqrt(Math.max(0, r * r - (chord / 2) ** 2))
  // 顺时针的短弧，圆心在前进方向的右手边（y 轴向下）
  const cx = (from.x + to.x) / 2 - (dy / chord) * offset
  const cy = (from.y + to.y) / 2 + (dx / chord) * offset
  const start = Math.atan2(from.y - cy, from.x - cx)
  let sweep = Math.atan2(to.y - cy, to.x - cx) - start
  if (sweep < 0) sweep += TAU
  return { cx, cy, radius: r, start, sweep }
}

/** 一条轨道：椭圆的两个半轴（SVG 单位）、绕地球中心转过的角度（度）、虚线流动一圈的毫秒数、是否反向 */
export type GlobeOrbit = { rx: number; ry: number; rotate: number; duration: number; reverse: boolean }

/** 三条轨道，第二条反向（尺寸、角度、周期与原先 SVG 里的三个椭圆一致） */
export const GLOBE_ORBITS: readonly GlobeOrbit[] = [
  { rx: 174, ry: 124, rotate: 0, duration: 14000, reverse: false },
  { rx: 182, ry: 90, rotate: -25, duration: 18000, reverse: true },
  { rx: 166, ry: 112, rotate: 34, duration: 22000, reverse: false },
]

// 一个周期里虚线走过的距离（CSS px），都是各自虚线周期的整数倍，循环处不跳
const ORBIT_FLOW = 120
const LINK_FLOW = 40
/** 连线光点的半径（SVG 单位） */
const DOT_RADIUS = 2.6

/** 光点的辉光：CSS 的 drop-shadow(0 0 blur color)，blur 是 SVG 单位。滤镜里的这个长度就是高斯模糊的标准差 */
export type GlobeGlow = { color: string; blur: number }

export type GlobeMotionStyle = {
  /** 轨道：线宽和虚线是 CSS px（原样式带 non-scaling-stroke，不随地球缩放），opacity 每条轨道一个 */
  orbit: { stroke: string; width: number; dash: number[]; opacity: number[] }
  /** 连线：线宽和虚线同样是 CSS px */
  link: { stroke: string; width: number; dash: number[] }
  /** 光点：描边宽度是 SVG 单位 */
  dot: { fill: string; stroke: string; strokeWidth: number; glow?: GlobeGlow }
}

/**
 * 计算样式里的颜色转成画布认的写法。color-mix() 算出来的颜色，浏览器给的是 `color(srgb r g b / a)`，
 * 旧一些的浏览器画布不认这个写法（赋值会被悄悄忽略、画成黑色），这里换成 rgba()；其余写法原样返回。
 */
export function canvasColor(value: string): string {
  const match = /^color\(srgb\s+([\d.e+-]+)\s+([\d.e+-]+)\s+([\d.e+-]+)(?:\s*\/\s*([\d.e+-]+%?))?\s*\)$/i.exec(value.trim())
  if (!match) return value
  const channel = (text: string) => Math.round(Math.min(1, Math.max(0, Number(text))) * 255)
  const alpha = match[4] === undefined ? 1 : match[4].endsWith('%') ? Number(match[4].slice(0, -1)) / 100 : Number(match[4])
  return `rgba(${channel(match[1])}, ${channel(match[2])}, ${channel(match[3])}, ${Number.isFinite(alpha) ? alpha : 1})`
}

/** 计算样式里的 stroke-dasharray（如 `7px, 8px`）转成数字；none 或解析不出时返回空数组（实线） */
export function parseDashArray(value: string): number[] {
  const parts = value.split(/[\s,]+/).filter(Boolean).map((part) => Number.parseFloat(part))
  return parts.length > 0 && parts.every((part) => Number.isFinite(part) && part >= 0) && parts.some((part) => part > 0) ? parts : []
}

/**
 * 从计算样式的 filter 里取出辉光：只认 `drop-shadow(<颜色> 0px 0px <模糊>)` 这种不偏移的投影（颜色写在前后都行）。
 * 没有 drop-shadow（filter: none）或写法认不出时返回 undefined，不画辉光。
 */
export function parseGlow(filter: string): GlobeGlow | undefined {
  const at = filter.indexOf('drop-shadow(')
  if (at < 0) return undefined
  // 颜色自己也带括号（rgb(...)），按括号配对找到 drop-shadow 的结尾
  let depth = 0
  let end = -1
  for (let index = at + 'drop-shadow'.length; index < filter.length; index++) {
    if (filter[index] === '(') depth++
    else if (filter[index] === ')' && --depth === 0) { end = index; break }
  }
  if (end < 0) return undefined
  const body = filter.slice(at + 'drop-shadow('.length, end)
  // 按最外层的空格切开
  const tokens: string[] = []
  let current = ''
  depth = 0
  for (const char of body) {
    if (char === '(') depth++
    else if (char === ')') depth--
    if (/\s/.test(char) && depth === 0) { if (current) tokens.push(current); current = '' } else current += char
  }
  if (current) tokens.push(current)
  const lengths: number[] = []
  const color: string[] = []
  for (const token of tokens) {
    if (/^-?[\d.]+(px)?$/.test(token)) lengths.push(Number.parseFloat(token))
    else color.push(token)
  }
  const blur = lengths[2] ?? 0
  if (color.length === 0 || !(blur > 0) || lengths[0] !== 0 || lengths[1] !== 0) return undefined
  return { color: canvasColor(color.join(' ')), blur }
}

/** 探针里的元素：三条轨道、一条连线、一个光点 */
export type GlobeStyleProbe = { orbits: readonly Element[]; link: Element; dot: Element }

/** 读探针元素的计算样式。元素不显示（display: none）也读得到。 */
export function readGlobeMotionStyle(probe: GlobeStyleProbe): GlobeMotionStyle {
  const px = (value: string, fallback: number) => { const parsed = Number.parseFloat(value); return Number.isFinite(parsed) ? parsed : fallback }
  const orbits = probe.orbits.map((element) => getComputedStyle(element))
  const link = getComputedStyle(probe.link)
  const dot = getComputedStyle(probe.dot)
  return {
    orbit: {
      stroke: canvasColor(orbits[0]?.stroke ?? ''),
      width: px(orbits[0]?.strokeWidth ?? '', 1),
      dash: parseDashArray(orbits[0]?.strokeDasharray ?? ''),
      opacity: orbits.map((style) => px(style.opacity, 1)),
    },
    link: { stroke: canvasColor(link.stroke), width: px(link.strokeWidth, 1), dash: parseDashArray(link.strokeDasharray) },
    dot: { fill: canvasColor(dot.fill), stroke: canvasColor(dot.stroke), strokeWidth: px(dot.strokeWidth, 1), glow: parseGlow(dot.filter) },
  }
}

/**
 * 画布摆在哪、多大。left / top / cssWidth / cssHeight 是 CSS px（相对舞台的内边距盒），width / height 是画布自己的像素数；
 * svg 是地球那张 SVG 的框在画布里的位置和尺寸（画布像素，带小数）。
 */
export type GlobeCanvasPlacement = {
  left: number
  top: number
  cssWidth: number
  cssHeight: number
  width: number
  height: number
  svg: { x: number; y: number; width: number; height: number }
}

/**
 * 画布盖住地球那张 SVG，四条边对齐到设备像素：画布的一个像素正好是屏幕上的一个像素。
 * SVG 的位置常常带小数（居中、百分比宽度），画布照着摆到半个像素上，合成时整张被插值一遍，虚线就糊了。
 * 所以画布的边取整，SVG 的框相对画布差出来的那点小数记在 svg 里，画的时候补上，线条仍然和 SVG 里的标签对齐。
 *
 * svg / stage 是两者的屏幕矩形，layout 是舞台排版时的尺寸（offsetWidth / offsetHeight）和左、上边框宽度
 * （绝对定位从内边距盒算起），ratio 是设备像素比。
 * 舞台的祖先正在做缩放动画时（Emerald 的地球有入场动画），屏幕矩形是缩放后的：拿它和排版尺寸一比就知道缩放了多少，
 * 换算回排版时的坐标再摆画布——画布自己也在同一个祖先里，会跟着一起缩放。这时没法对齐设备像素，等动画结束后重新量。
 * SVG 或舞台还没有尺寸时返回 undefined。
 */
export function globeCanvasPlacement(
  svg: { left: number; top: number; width: number; height: number },
  stage: { left: number; top: number; width: number; height: number },
  layout: { width: number; height: number; borderLeft: number; borderTop: number },
  ratio: number,
): GlobeCanvasPlacement | undefined {
  if (!(ratio > 0) || !(svg.width > 0) || !(svg.height > 0) || !(stage.width > 0) || !(stage.height > 0) || !(layout.width > 0) || !(layout.height > 0)) return undefined
  const scaleX = stage.width / layout.width
  const scaleY = stage.height / layout.height
  const scaled = Math.abs(scaleX - 1) > 1e-3 || Math.abs(scaleY - 1) > 1e-3
  // 舞台边框盒左上角在屏幕上的位置；缩放中不知道动画结束后会落在哪，先当作 0（不对齐）
  const baseX = scaled ? 0 : stage.left
  const baseY = scaled ? 0 : stage.top
  // SVG 的框，排版坐标（CSS px）
  const x = baseX + (svg.left - stage.left) / scaleX
  const y = baseY + (svg.top - stage.top) / scaleY
  const svgWidth = svg.width / scaleX
  const svgHeight = svg.height / scaleY
  const left = Math.floor(x * ratio + 1e-6)
  const top = Math.floor(y * ratio + 1e-6)
  const width = Math.max(1, Math.ceil((x + svgWidth) * ratio - 1e-6) - left)
  const height = Math.max(1, Math.ceil((y + svgHeight) * ratio - 1e-6) - top)
  return {
    left: left / ratio - baseX - layout.borderLeft,
    top: top / ratio - baseY - layout.borderTop,
    cssWidth: width / ratio,
    cssHeight: height / ratio,
    width,
    height,
    svg: { x: x * ratio - left, y: y * ratio - top, width: svgWidth * ratio, height: svgHeight * ratio },
  }
}

export type GlobeMotionView = Pick<GlobeMotionScene, 'width' | 'height' | 'pixelRatio' | 'unit' | 'originX' | 'originY' | 'view'>

/** viewBox 在画布里怎么摆：和 SVG 一样，在 SVG 的框里等比缩放并居中（SVG 被限高时两侧留空） */
export function globeMotionView(placement: GlobeCanvasPlacement, view: { width: number; height: number }): GlobeMotionView {
  const unit = Math.min(placement.svg.width / view.width, placement.svg.height / view.height)
  return {
    width: placement.width,
    height: placement.height,
    pixelRatio: placement.width / placement.cssWidth,
    unit,
    originX: placement.svg.x + (placement.svg.width - view.width * unit) / 2,
    originY: placement.svg.y + (placement.svg.height - view.height * unit) / 2,
    view,
  }
}

export type GlobeMotionScene = {
  /** 画布的像素尺寸 */
  width: number
  height: number
  /** 每个 CSS px 占多少画布像素（设备像素比） */
  pixelRatio: number
  /** 每个 SVG 单位占多少画布像素 */
  unit: number
  /** viewBox 左上角在画布里的位置（画布像素）和 viewBox 的尺寸（SVG 单位） */
  originX: number
  originY: number
  view: { width: number; height: number }
  /** 地球中心（SVG 单位）；以它为圆心、半径 hole 以内不画（原先由 mask 挖掉，免得轨道和连线压在地球上） */
  center: { x: number; y: number }
  hole: number
  orbits: readonly GlobeOrbit[]
  /** 相邻地区标签之间的连线，光点沿着它走 */
  links: readonly GlobeArc[]
  /** 拖动地球、系统开了「减少动态效果」时不画光点 */
  showDots: boolean
}

/** 画布 2D 上下文里用到的那部分接口（测试时用假的上下文记录调用） */
export type GlobeCanvasContext = Pick<
  CanvasRenderingContext2D,
  | 'setTransform' | 'clearRect' | 'save' | 'restore' | 'beginPath' | 'rect' | 'arc' | 'ellipse' | 'clip' | 'stroke' | 'fill' | 'setLineDash'
  | 'lineWidth' | 'lineDashOffset' | 'strokeStyle' | 'fillStyle' | 'globalAlpha' | 'shadowColor' | 'shadowBlur'
>

/** 把轨道、连线、光点画到 elapsedMs 这一刻（时长、方向与原先逐步改 SVG 属性时一致）。 */
export function drawGlobeMotion(ctx: GlobeCanvasContext, scene: GlobeMotionScene, style: GlobeMotionStyle, elapsedMs: number) {
  const { unit, pixelRatio } = scene
  const x = (value: number) => scene.originX + value * unit
  const y = (value: number) => scene.originY + value * unit
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, scene.width, scene.height)
  ctx.save()
  // 只画在 viewBox 以内、地球外圈以外
  ctx.beginPath()
  ctx.rect(scene.originX, scene.originY, scene.view.width * unit, scene.view.height * unit)
  ctx.arc(x(scene.center.x), y(scene.center.y), scene.hole * unit, 0, TAU)
  ctx.clip('evenodd')

  ctx.strokeStyle = style.orbit.stroke
  ctx.lineWidth = style.orbit.width * pixelRatio
  ctx.setLineDash(style.orbit.dash.map((length) => length * pixelRatio))
  scene.orbits.forEach((orbit, index) => {
    ctx.beginPath()
    // 和 SVG 的椭圆一样从长轴右端出发、顺时针走，虚线的起点才对得上
    ctx.ellipse(x(scene.center.x), y(scene.center.y), orbit.rx * unit, orbit.ry * unit, (orbit.rotate * Math.PI) / 180, 0, TAU)
    ctx.lineDashOffset = dashOffset(elapsedMs, orbit.duration, ORBIT_FLOW, orbit.reverse) * pixelRatio
    ctx.globalAlpha = style.orbit.opacity[index] ?? 1
    ctx.stroke()
  })
  ctx.globalAlpha = 1

  ctx.strokeStyle = style.link.stroke
  ctx.lineWidth = style.link.width * pixelRatio
  ctx.setLineDash(style.link.dash.map((length) => length * pixelRatio))
  scene.links.forEach((link, index) => {
    // 原样式：第偶数条（下标为奇数）反向、周期 3.2s，其余 2.4s
    const even = index % 2 === 1
    ctx.beginPath()
    ctx.arc(x(link.cx), y(link.cy), link.radius * unit, link.start, link.start + link.sweep)
    ctx.lineDashOffset = dashOffset(elapsedMs, even ? 3200 : 2400, LINK_FLOW, even) * pixelRatio
    ctx.stroke()
  })

  if (scene.showDots) {
    const { glow } = style.dot
    ctx.setLineDash([])
    ctx.lineDashOffset = 0
    ctx.lineWidth = style.dot.strokeWidth * unit
    scene.links.forEach((link, index) => {
      const angle = link.start + link.sweep * motionProgress(elapsedMs, 3200 + index * 450)
      const dotX = x(link.cx + Math.cos(angle) * link.radius)
      const dotY = y(link.cy + Math.sin(angle) * link.radius)
      if (glow) {
        // 辉光是整个光点（连描边）的投影：先带阴影画一个同样大的实心圆，再不带阴影把光点本身盖上去
        ctx.shadowColor = glow.color
        // 画布的 shadowBlur 是标准差的两倍
        ctx.shadowBlur = glow.blur * unit * 2
        ctx.fillStyle = style.dot.stroke
        ctx.beginPath()
        ctx.arc(dotX, dotY, (DOT_RADIUS + style.dot.strokeWidth / 2) * unit, 0, TAU)
        ctx.fill()
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
      }
      ctx.fillStyle = style.dot.fill
      ctx.strokeStyle = style.dot.stroke
      ctx.beginPath()
      ctx.arc(dotX, dotY, DOT_RADIUS * unit, 0, TAU)
      ctx.fill()
      ctx.stroke()
    })
  }
  ctx.restore()
}
