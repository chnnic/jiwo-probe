// 经典主题（像素 / 扁平 / 动漫 / 玻璃 / Lumina）的地区地球：与主控内置探针同款（拱形弧线 + 流动光点 + 亮点旁旗帜与台数），
// 移植自上游 989b8e7 的 src/RegionGlobe.tsx，改了导出名；弧线光点和亮点光晕改为每 50ms 推一步（见 use-motion-ticker）。Emerald 仍用 RegionGlobe.tsx（Premium 地球）。
import { useEffect, useMemo, useRef, useState } from 'react'
import { geoCentroid, geoDistance, geoGraticule10, geoOrthographic, geoPath } from 'd3-geo'
import type { GeoProjection } from 'd3-geo'
import countries from 'i18n-iso-countries'
import { feature } from 'topojson-client'
import world from 'world-atlas/countries-110m.json'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'
import { arcPath, arcPointAt, pickArcPairs, sampleArc } from './globe-arcs'
import { flagTwemojiFile, layoutGlobeLabels, type GlobeLabelMetrics } from './globe-labels'
import { pulseAt } from './globe-motion'
import { useMotionTicker } from './use-motion-ticker'

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

// 亮点光晕一次脉冲的时长
const HALO_PULSE_MS = 1150

// 地球默认朝向(对着东亚)
const DEFAULT_ROTATION: [number, number] = [-105, -18]

type RegionArc = { key: string; from: [number, number]; to: [number, number]; phase: number }

// 地区之间的 3D 弧线:渐变描边 + 一层模糊光晕,弧上有光点从一头跑到另一头。
function RegionArcs({ arcs, projection }: { arcs: RegionArc[]; projection: GeoProjection }) {
  const geometry = useMemo(() => arcs.map(arc => {
    const points = sampleArc(projection, arc.from, arc.to)
    // 光点走完一条弧的时间:远的走得久一些
    return { ...arc, points, d: arcPath(points), duration: 1800 + 1600 * (geoDistance(arc.from, arc.to) / Math.PI) }
  }), [arcs, projection])
  const packets = useRef<Array<SVGGElement | null>>([])
  const latest = useRef(geometry)
  useEffect(() => { latest.current = geometry }, [geometry])
  // 光点每 50ms 推一步（原先每帧都算）；地球不在视口 / 页面在后台 / 系统开了「减少动态效果」时停掉，见 use-motion-ticker
  const root = useRef<SVGGElement>(null)
  useMotionTicker(root, (elapsed) => {
    latest.current.forEach((arc, index) => {
      const el = packets.current[index]
      if (!el) return
      const t = (elapsed / arc.duration + arc.phase) % 1
      const at = arcPointAt(arc.points, t)
      if (!at) { el.setAttribute('opacity', '0'); return }
      // 两头淡入淡出,别从端点上「蹦」出来
      el.setAttribute('opacity', Math.min(1, t / .08, (1 - t) / .08).toFixed(2))
      el.setAttribute('transform', `translate(${at.x.toFixed(1)} ${at.y.toFixed(1)})`)
    })
  })
  return <g className="globe-arcs" ref={root}>
    <defs>{geometry.map(arc => {
      const first = arc.points[0]
      const last = arc.points[arc.points.length - 1]
      return first && last ? <linearGradient key={arc.key} id={`globe-arc-${arc.key}`} gradientUnits="userSpaceOnUse" x1={first.x} y1={first.y} x2={last.x} y2={last.y}><stop offset="0" className="arc-from" /><stop offset="1" className="arc-to" /></linearGradient> : null
    })}</defs>
    <g filter="url(#globe-arc-blur)">{geometry.map(arc => <path key={arc.key} className="arc-glow" d={arc.d} stroke={`url(#globe-arc-${arc.key})`} />)}</g>
    {geometry.map(arc => <path key={arc.key} className="arc-core" d={arc.d} stroke={`url(#globe-arc-${arc.key})`} />)}
    {geometry.map((arc, index) => <g key={arc.key} ref={el => { packets.current[index] = el }} opacity="0"><circle className="arc-packet-glow" r="5" /><circle className="arc-packet" r="2.2" /></g>)}
  </g>
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
  const haloPath = useMemo(() => geoPath(projection).pointRadius(8), [projection])
  const locations = useMemo(() => [...activeRegions].map(([code, count]) => {
    const numeric = countries.alpha2ToNumeric(code)
    const country = collection.features.find(item => String(item.id || '').padStart(3, '0') === numeric)
    const coordinates = regionCoordinates[code] || (country ? geoCentroid(country) as [number, number] : undefined)
    return coordinates ? { code, count, coordinates } : undefined
  }).filter((item): item is { code: string; count: number; coordinates: [number, number] } => !!item), [activeRegions, collection])
  const arcs = useMemo(() => pickArcPairs(locations, [-DEFAULT_ROTATION[0], -DEFAULT_ROTATION[1]]).map(([from, to], index) => ({
    key: `${from.code}-${to.code}`,
    from: from.coordinates,
    to: to.coordinates,
    // 错开各条弧上光点的出发时刻;不用随机数,重绘后节奏不跳
    phase: (index * .382) % 1,
  })), [locations])
  // SVG 单位与屏幕像素的比例,标签在任何尺寸下都是约 9px 的小字。
  // 地球被 max-height 限高时按 viewBox 等比缩小,宽高都要算
  const svgRef = useRef<SVGSVGElement | null>(null)
  const viewWidth = compact ? 400 : 640
  const viewHeight = compact ? 400 : 460
  const [unitsPerPx, setUnitsPerPx] = useState(1)
  useEffect(() => {
    const el = svgRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const update = () => {
      const { width, height } = el.getBoundingClientRect()
      const scale = Math.min(width / viewWidth, height / viewHeight)
      if (scale > 0) setUnitsPerPx(1 / scale)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [viewWidth, viewHeight])
  // 亮点光晕的脉冲也每 50ms 推一步：原先的 CSS 动画作用在 SVG 路径上，交不到合成线程，
  // 地球滚出视口后仍让整页按屏幕刷新率出帧
  const pointsRef = useRef<SVGGElement>(null)
  useMotionTicker(pointsRef, (elapsed) => {
    const { opacity, scale } = pulseAt(elapsed, HALO_PULSE_MS)
    for (const halo of pointsRef.current?.querySelectorAll<SVGPathElement>('.region-point-halo') ?? []) {
      halo.style.opacity = opacity.toFixed(2)
      halo.style.transform = `scale(${scale.toFixed(2)})`
    }
  })
  return <div className={compact ? 'globe-stage compact' : 'globe-stage'}>
    <svg ref={svgRef} className="region-globe" viewBox={compact ? '120 -12 400 400' : '0 -40 640 460'} role="img" aria-label="服务器地区地球分布"
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
      <RegionArcs arcs={arcs} projection={projection} />
      <g className="globe-points" ref={pointsRef}>{locations.map(location => <g key={location.code} className="laser-origin"><path className="region-point-halo" d={haloPath({ type: 'Point', coordinates: location.coordinates }) || ''} /><path className="region-point" d={pointPath({ type: 'Point', coordinates: location.coordinates }) || ''}><title>{location.code} · {location.count} 台服务器</title></path></g>)}</g>
      <path className="globe-outline" d={path({ type: 'Sphere' }) || ''} />
      <RegionLabels locations={locations} projection={projection} rotation={rotation} unitsPerPx={unitsPerPx} />
    </svg>
    {!compact && <p>拖动地球查看地区 · 已点亮 {activeRegions.size} 个国家或地区</p>}
  </div>
}
