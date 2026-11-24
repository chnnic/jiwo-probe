// 经典主题（像素 / 扁平 / 动漫 / 玻璃 / Lumina）的地区地球：与主控内置探针同款（拱形弧线 + 流动光点 + 亮点旁旗帜与台数），
// 移植自上游 989b8e7 的 src/RegionGlobe.tsx，改了导出名。Emerald 仍用 RegionGlobe.tsx（Premium 地球）。
// 画面分三层叠在一起：底层 SVG（地球、国家、弧线）→ 动效层（弧线光点、亮点光晕，HTML 元素，合成线程播放，
// 见 globe-overlay-motion）→ 顶层 SVG（亮点、轮廓、标签）。地球本身不再逐步重绘。
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { geoCentroid, geoDistance, geoGraticule10, geoOrthographic, geoPath } from 'd3-geo'
import type { GeoProjection } from 'd3-geo'
import countries from 'i18n-iso-countries'
import { feature } from 'topojson-client'
import world from 'world-atlas/countries-110m.json'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'
import { arcPath, pickArcPairs, sampleArc } from './globe-arcs'
import { flagTwemojiFile, layoutGlobeLabels, type GlobeLabelMetrics } from './globe-labels'
import { HALO_PULSE_MS, globeBox, haloKeyframes, packetMotion, type GlobeBox } from './globe-overlay-motion'
import { stepHoldFor } from './step-hold'
import { useMotionRunning } from './use-motion-ticker'

function countryCode(region: string): string {
  const points = [...region.trim()].map(char => char.codePointAt(0) || 0)
  if (points.length === 2 && points.every(point => point >= 0x1f1e6 && point <= 0x1f1ff)) {
    return points.map(point => String.fromCharCode(point - 0x1f1e6 + 65)).join('')
  }
  const code = region.trim().split(/[·,\s]+/)[0]?.toUpperCase() || ''
  return /^[A-Z]{2}$/.test(code) ? code : ''
}

const regionCoordinates: Record<string, [number, number]> = {
  HK: [114.17, 22.32], MO: [113.54, 22.20], SG: [103.82, 1.35],
}

// 地球默认朝向(对着东亚)
const DEFAULT_ROTATION: [number, number] = [-105, -18]

type RegionArc = { key: string; from: [number, number]; to: [number, number]; phase: number }
type ArcGeometry = RegionArc & { points: ReturnType<typeof sampleArc>; d: string; duration: number }
type Halo = { code: string; x: number; y: number }

// 地区之间的 3D 弧线:渐变描边 + 一层模糊光晕。弧上跑的光点在动效层（GlobeMotion）。
function RegionArcs({ arcs }: { arcs: ArcGeometry[] }) {
  return <g className="globe-arcs">
    <defs>{arcs.map(arc => {
      const first = arc.points[0]
      const last = arc.points[arc.points.length - 1]
      return first && last ? <linearGradient key={arc.key} id={`globe-arc-${arc.key}`} gradientUnits="userSpaceOnUse" x1={first.x} y1={first.y} x2={last.x} y2={last.y}><stop offset="0" className="arc-from" /><stop offset="1" className="arc-to" /></linearGradient> : null
    })}</defs>
    <g filter="url(#globe-arc-blur)">{arcs.map(arc => <path key={arc.key} className="arc-glow" d={arc.d} stroke={`url(#globe-arc-${arc.key})`} />)}</g>
    {arcs.map(arc => <path key={arc.key} className="arc-core" d={arc.d} stroke={`url(#globe-arc-${arc.key})`} />)}
  </g>
}

// 动效层：弧线光点从一头跑到另一头，亮点光晕一圈圈脉冲。内层容器的坐标就是 SVG 用户单位（左上角对着 viewBox 起点），
// 按显示比例整体缩放。动画都对齐到页面时间轴零点：拖动地球时关键帧整批重建，光点位置不跳；所有光晕同步，
// 光点和光晕在同一帧里换步。
function GlobeMotion({ arcs, halos, box, view, running }: {
  arcs: ArcGeometry[]
  halos: Halo[]
  box: GlobeBox
  view: { x: number; y: number; width: number; height: number }
  running: boolean
}) {
  const space = useRef<HTMLDivElement>(null)
  const haloKey = halos.map(halo => halo.code).join(' ')
  useEffect(() => {
    const root = space.current
    if (!running || !root || typeof root.animate !== 'function') return
    const animations: Animation[] = []
    const hold = stepHoldFor(navigator.userAgent)
    const play = (element: Element, keyframes: Keyframe[], timing: KeyframeAnimationOptions) => {
      const animation = element.animate(keyframes, { iterations: Infinity, ...timing })
      animation.startTime = 0
      animations.push(animation)
    }
    root.querySelectorAll('.arc-packet').forEach((packet, index) => {
      const arc = arcs[index]
      const motion = arc && packetMotion(arc.points, view, arc.duration, arc.phase, hold)
      if (motion) play(packet, motion.keyframes, { duration: motion.duration, iterationStart: motion.iterationStart })
    })
    const pulse = haloKeyframes(hold)
    root.querySelectorAll('.region-point-halo').forEach(halo => play(halo, pulse, { duration: HALO_PULSE_MS }))
    return () => { for (const animation of animations) animation.cancel() }
    // 光晕的动画和位置无关，地区集合（haloKey）变了才需要重建
  }, [running, arcs, view, haloKey])
  return <div className="globe-motion" aria-hidden="true" style={{ left: box.left, top: box.top, width: box.width, height: box.height }}>
    <div ref={space} className="globe-motion-space" style={{
      left: (box.width - view.width * box.scale) / 2,
      top: (box.height - view.height * box.scale) / 2,
      width: view.width,
      height: view.height,
      transform: `scale(${box.scale})`,
    }}>
      {arcs.map(arc => <i key={arc.key} className="arc-packet" />)}
      {halos.map(halo => <i key={halo.code} className="region-point-halo" style={{ left: halo.x - view.x, top: halo.y - view.y }} />)}
    </div>
  </div>
}

// 亮点旁的小标签:旗帜 + 服务器数量。尺寸按屏幕像素定(约 9px 字),再换算成 SVG 单位;
// 摆放与避让见 globe-labels(与主仓内置探针同一份逻辑)。
function RegionLabels({ locations, projection, rotation, unitsPerPx }: {
  locations: Array<{ code: string; count: number; coordinates: [number, number] }>
  projection: GeoProjection
  rotation: [number, number]
  unitsPerPx: number
}) {
  const u = unitsPerPx
  const list = useMemo(() => {
    const center: [number, number] = [-rotation[0], -rotation[1]]
    const points = locations
      // 转到背面的地区不放标签
      .filter(l => geoDistance(l.coordinates, center) < Math.PI / 2 - 0.03)
      .map(l => { const [x, y] = projection(l.coordinates) || [NaN, NaN]; return { code: l.code, count: l.count, x, y } })
      .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y))
    const metrics: GlobeLabelMetrics = { height: 14 * u, flag: 11 * u, digit: 5.6 * u, padding: 3.5 * u, gap: 2.5 * u, offset: 6 * u, dotRadius: 5 * u }
    const [cx, cy] = projection.translate()
    return layoutGlobeLabels(points, metrics, { cx, cy, r: projection.scale() })
  }, [locations, projection, rotation, u])
  return <g className="region-labels">{list.map(label => {
    const file = flagTwemojiFile(label.code)
    return <g key={label.code}>
      {label.leader && <line className="region-label-leader" x1={label.leader.x1} y1={label.leader.y1} x2={label.leader.x2} y2={label.leader.y2} />}
      <rect className="region-label" x={label.x} y={label.y} width={label.width} height={label.height} rx={label.height / 2} />
      {file && <image href={`/twemoji/svg/${file}.svg`} x={label.x + 3.5 * u} y={label.y + (label.height - 11 * u) / 2} width={11 * u} height={11 * u} />}
      <text className="region-label-text" x={label.x + label.width - 3.5 * u} y={label.y + label.height / 2} fontSize={9.5 * u} textAnchor="end" dominantBaseline="central">{label.count}</text>
    </g>
  })}</g>
}

/** compact:放在指标旁的小地球,裁掉两侧给弧线留的空白,底部说明文字也省掉 */
export function ProbeRegionGlobe({ regions, compact = false }: { regions: string[]; compact?: boolean }) {
  const [rotation, setRotation] = useState<[number, number]>(DEFAULT_ROTATION)
  const drag = useRef<{ x: number; y: number; rotation: [number, number] } | undefined>(undefined)
  // 地区集合不变时保持 key 稳定；节点地区变化时同步刷新地图高亮。
  const regionKey = [...regions].filter(Boolean).sort().join('\u0001')
  const activeRegions = useMemo(() => {
    const result = new Map<string, number>()
    for (const region of regionKey.split('\u0001')) {
      const code = countryCode(region)
      if (code) result.set(code, (result.get(code) || 0) + 1)
    }
    return result
  }, [regionKey])
  const collection = useMemo(() => feature(
    world as unknown as Topology,
    (world as unknown as Topology).objects.countries as GeometryCollection,
  ) as unknown as FeatureCollection<Geometry, { name?: string }>, [])
  const projection = useMemo(() => geoOrthographic().translate([320, 190]).scale(168).clipAngle(90).precision(.5).rotate(rotation), [rotation])
  const path = useMemo(() => geoPath(projection), [projection])
  const pointPath = useMemo(() => geoPath(projection).pointRadius(3.5), [projection])
  const locations = useMemo(() => [...activeRegions].map(([code, count]) => {
    const numeric = countries.alpha2ToNumeric(code)
    const country = collection.features.find(item => String(item.id || '').padStart(3, '0') === numeric)
    const coordinates = regionCoordinates[code] || (country ? geoCentroid(country) as [number, number] : undefined)
    return coordinates ? { code, count, coordinates } : undefined
  }).filter((item): item is { code: string; count: number; coordinates: [number, number] } => !!item), [activeRegions, collection])
  const arcs = useMemo(() => pickArcPairs(locations, [-DEFAULT_ROTATION[0], -DEFAULT_ROTATION[1]]).map(([from, to], index): RegionArc => ({
    key: `${from.code}-${to.code}`,
    from: from.coordinates,
    to: to.coordinates,
    // 错开各条弧上光点的出发时刻;不用随机数,重绘后节奏不跳
    phase: (index * .382) % 1,
  })), [locations])
  const arcGeometry = useMemo(() => arcs.map((arc): ArcGeometry => {
    const points = sampleArc(projection, arc.from, arc.to)
    // 光点走完一条弧的时间:远的走得久一些
    return { ...arc, points, d: arcPath(points), duration: 1800 + 1600 * (geoDistance(arc.from, arc.to) / Math.PI) }
  }), [arcs, projection])
  // 转到背面的亮点不画（和 geoPath 对点的裁剪一致），光晕跟着亮点走
  const points = useMemo(() => locations.flatMap(location => {
    const d = pointPath({ type: 'Point', coordinates: location.coordinates })
    const at = d ? projection(location.coordinates) : null
    return d && at ? [{ ...location, d, x: at[0], y: at[1] }] : []
  }), [locations, pointPath, projection])
  // 底层 SVG 在舞台里的位置和显示比例：动效层、顶层 SVG 照这个叠上去；标签在任何尺寸下都是约 9px 的小字，也按这个比例换算。
  // 地球被 max-height 限高时按 viewBox 等比缩小,宽高都要算
  const stageRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const view = useMemo(() => compact ? { x: 120, y: -12, width: 400, height: 400 } : { x: 0, y: -40, width: 640, height: 460 }, [compact])
  const viewBox = `${view.x} ${view.y} ${view.width} ${view.height}`
  const [box, setBox] = useState<GlobeBox>()
  useLayoutEffect(() => {
    const el = svgRef.current
    const stage = stageRef.current
    if (!el || !stage) return
    const update = () => {
      const next = globeBox(el.getBoundingClientRect(), stage.getBoundingClientRect(), { left: stage.clientLeft, top: stage.clientTop }, view)
      if (!next) return
      setBox(current => current && current.left === next.left && current.top === next.top && current.width === next.width && current.height === next.height ? current : next)
    }
    update()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(update)
    ro.observe(el)
    ro.observe(stage)
    return () => ro.disconnect()
  }, [view])
  const unitsPerPx = box ? 1 / box.scale : 1
  // 地球不在视口 / 页面在后台 / 系统开了「减少动态效果」时不播：光点不显示，光晕停在样式表里的静态样子
  const running = useMotionRunning(svgRef)
  return <div ref={stageRef} className={compact ? 'globe-stage compact' : 'globe-stage'}>
    <svg ref={svgRef} className="region-globe" viewBox={viewBox} role="img" aria-label="服务器地区地球分布"
      onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, rotation } }}
      onPointerMove={event => { if (!drag.current) return; const dx = event.clientX - drag.current.x; const dy = event.clientY - drag.current.y; setRotation([drag.current.rotation[0] + dx * .35, Math.max(-75, Math.min(75, drag.current.rotation[1] - dy * .35))]) }}
      onPointerUp={() => { drag.current = undefined }} onPointerCancel={() => { drag.current = undefined }}>
      <defs><radialGradient id="globe-ocean" cx="35%" cy="28%"><stop offset="0" stopColor="var(--globe-ocean-light)" /><stop offset="1" stopColor="var(--globe-ocean-dark)" /></radialGradient><filter id="globe-glow"><feGaussianBlur stdDeviation="7" /></filter><filter id="globe-arc-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.5" /></filter></defs>
      <circle className="globe-glow" cx="320" cy="190" r="171" filter="url(#globe-glow)" />
      <path className="globe-ocean" d={path({ type: 'Sphere' }) || ''} />
      <path className="globe-grid" d={path(geoGraticule10()) || ''} />
      {collection.features.map((country: Feature<Geometry, { name?: string }>) => {
        const id = String(country.id || '').padStart(3, '0')
        const code = countries.numericToAlpha2(id)
        const count = code ? activeRegions.get(code) || 0 : 0
        return <path key={id} className={count ? 'globe-country active' : 'globe-country'} d={path(country) || ''}><title>{country.properties?.name || id}{count ? ` · ${count} 台服务器` : ''}</title></path>
      })}
      <RegionArcs arcs={arcGeometry} />
    </svg>
    {box && <GlobeMotion arcs={arcGeometry} halos={points} box={box} view={view} running={running} />}
    {box && <svg className="region-globe-top" viewBox={viewBox} aria-hidden="true" style={{ left: box.left, top: box.top, width: box.width, height: box.height }}>
      <g className="globe-points">{points.map(point => <g key={point.code} className="laser-origin"><path className="region-point" d={point.d}><title>{point.code} · {point.count} 台服务器</title></path></g>)}</g>
      <path className="globe-outline" d={path({ type: 'Sphere' }) || ''} />
      <RegionLabels locations={locations} projection={projection} rotation={rotation} unitsPerPx={unitsPerPx} />
    </svg>}
    {!compact && <p>拖动地球查看地区 · 已点亮 {activeRegions.size} 个国家或地区</p>}
  </div>
}
