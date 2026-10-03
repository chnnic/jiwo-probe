// 地球标签的方位计算。从 black-gold-globe.tsx 里拆出来单测 —— 这块全是几何,
// 不该为了验证它去起一个 React 树。
import { geoDistance, geoOrthographic } from 'd3-geo'
import type { PremiumProbeRegion } from './BlackGoldGlobe'

export const GLOBE_CENTER = { x: 280, y: 170 }
export const GLOBE_RADIUS = 112
// 标签之间的最小角间隔(弧度)。地区一旦扎堆(港澳台新经常如此),按真实方位摆会叠在一起,
// 排完序按这个下限推开。
export const LABEL_MIN_GAP = 0.42
// 一圈最多能按 LABEL_MIN_GAP 排开的标签数;再多就推不开了。
export const MAX_ORBIT_LABELS = Math.floor((Math.PI * 2) / LABEL_MIN_GAP)

// 110m 世界地图里没有独立面的城市地区 —— 它们并进了所属国家,直接取质心会把
// 香港的标签指到内蒙古去。这三个单独给坐标(与 probe-region-globe 那边同一份口径)。
export const CITY_REGION_COORDINATES: Record<string, [number, number]> = {
  HK: [114.17, 22.32],
  MO: [113.54, 22.2],
  SG: [103.82, 1.35],
}

export type OrbitPoint = {
  region: PremiumProbeRegion
  radians: number
  /** 该地区在球面上的投影点(背面的钉在边缘上) */
  rimX: number
  rimY: number
  /** 是否在朝向我们这一面 */
  front: boolean
  x: number
  y: number
}

// 按地区的真实经纬度算标签方位。扎堆的地区(港澳台新)会叠在一起,所以排完序再按
// LABEL_MIN_GAP 推开 —— 方位大体还对,但不至于糊成一团。
export function layoutOrbit(
  regions: PremiumProbeRegion[],
  coordinates: Map<string, [number, number]>,
  rotation: [number, number],
  orbitRadius: number
): OrbitPoint[] {
  const cx = GLOBE_CENTER.x
  const cy = GLOBE_CENTER.y
  const projection = geoOrthographic()
    .translate([cx, cy])
    .scale(GLOBE_RADIUS)
    .rotate(rotation)
  // 正对着我们的那个经纬度 —— 用它判断地区在正面还是背面
  const facing: [number, number] = [-rotation[0], -rotation[1]]

  const placed = regions.map((region, index) => {
    const coords = coordinates.get(region.code.toUpperCase())
    const projected = coords ? projection(coords) : null
    // 没有坐标的(数据里没有这个国家)退回旧的按序号平分,至少不会重叠
    const fallback =
      ((-148 +
        (regions.length === 1 ? 148 : (index * 296) / (regions.length - 1))) *
        Math.PI) /
      180
    let radians = fallback
    let rimX = cx + Math.cos(fallback) * GLOBE_RADIUS
    let rimY = cy + Math.sin(fallback) * GLOBE_RADIUS
    let front = true
    if (coords && projected) {
      const dx = projected[0] - cx
      const dy = projected[1] - cy
      // 正对球心的点没有方位可言(dx=dy=0),退回 fallback,否则 atan2 会抖
      if (Math.hypot(dx, dy) > 0.5) radians = Math.atan2(dy, dx)
      front = geoDistance(coords, facing) < Math.PI / 2
      if (front) {
        rimX = projected[0]
        rimY = projected[1]
      } else {
        // 转到背面了:把点钉在边缘,读起来就是「在地平线那头」
        rimX = cx + Math.cos(radians) * GLOBE_RADIUS
        rimY = cy + Math.sin(radians) * GLOBE_RADIUS
      }
    }
    return { region, radians, rimX, rimY, front, index }
  })

  // 按角度排开,保证相邻两个至少差 LABEL_MIN_GAP(绕一圈,首尾也要算)
  const order = [...placed].sort((a, b) => a.radians - b.radians)
  const span = Math.PI * 2
  const need = order.length * LABEL_MIN_GAP
  if (order.length > 1 && need <= span) {
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < order.length; i++) {
        const gap = order[i].radians - order[i - 1].radians
        if (gap < LABEL_MIN_GAP)
          order[i].radians = order[i - 1].radians + LABEL_MIN_GAP
      }
      // 首尾跨 0 度那一段
      const wrap = order[0].radians + span - order[order.length - 1].radians
      if (wrap < LABEL_MIN_GAP) {
        const shift = (LABEL_MIN_GAP - wrap) / 2
        order[0].radians += shift
        order[order.length - 1].radians -= shift
      }
    }
  }

  return placed.map((point) => ({
    region: point.region,
    radians: point.radians,
    rimX: point.rimX,
    rimY: point.rimY,
    front: point.front,
    x: GLOBE_CENTER.x + Math.cos(point.radians) * orbitRadius,
    y: GLOBE_CENTER.y + Math.sin(point.radians) * orbitRadius,
  }))
}
