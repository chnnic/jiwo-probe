import { useEffect, useMemo, useRef, useState } from 'react'
import { geoCentroid, geoGraticule10, geoInterpolate, geoOrthographic, geoPath } from 'd3-geo'
import type { GeoProjection } from 'd3-geo'
import countries from 'i18n-iso-countries'
import { feature } from 'topojson-client'
import world from 'world-atlas/countries-110m.json'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'

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

function LaserBeam({ from, to, projection, delayMs }: { from: [number, number]; to: [number, number]; projection: GeoProjection; delayMs: number }) {
  const glow = useRef<SVGPathElement>(null)
  const core = useRef<SVGPathElement>(null)
  useEffect(() => {
    const outbound = geoInterpolate(from, to)
    const inbound = geoInterpolate(to, from)
    const draw = geoPath(projection)
    const travelDuration = 1400
    const waitDuration = 500
    const duration = travelDuration * 2 + waitDuration * 2
    const beamLength = .28
    const started = performance.now() + delayMs
    let frame = 0
    const render = (now: number) => {
      if (now < started) {
        glow.current?.setAttribute('d', '')
        core.current?.setAttribute('d', '')
        frame = requestAnimationFrame(render)
        return
      }
      const elapsed = (((now - started) % duration) + duration) % duration
      let position: number | undefined
      let interpolate = outbound
      if (elapsed < travelDuration) {
        position = elapsed / travelDuration * (1 + beamLength)
      } else if (elapsed >= travelDuration + waitDuration && elapsed < travelDuration * 2 + waitDuration) {
        interpolate = inbound
        position = (elapsed - travelDuration - waitDuration) / travelDuration * (1 + beamLength)
      }
      const start = position === undefined ? 0 : Math.max(0, position - beamLength)
      const end = position === undefined ? 0 : Math.min(1, position)
      let d = ''
      if (end - start > .002) d = draw({ type: 'LineString', coordinates: Array.from({ length: 13 }, (_, index) => interpolate(start + (end - start) * index / 12)) }) || ''
      glow.current?.setAttribute('d', d)
      core.current?.setAttribute('d', d)
      frame = requestAnimationFrame(render)
    }
    frame = requestAnimationFrame(render)
    return () => cancelAnimationFrame(frame)
  }, [delayMs, from, projection, to])
  return <><path ref={glow} className="laser-segments glow" /><path ref={core} className="laser-segments core" /></>
}

export function RegionGlobe({ regions }: { regions: string[] }) {
  const [rotation, setRotation] = useState<[number, number]>([-105, -18])
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
  const arcs = useMemo(() => {
    if (locations.length < 2) return []
    const result: Array<{ key: string; delayMs: number; from: [number, number]; to: [number, number] }> = []
    for (let fromIndex = 0; fromIndex < locations.length; fromIndex++) {
      for (let toIndex = fromIndex + 1; toIndex < locations.length; toIndex++) {
        const from = locations[fromIndex]
        const to = locations[toIndex]
        // 按连线和起点做稳定错峰，避免所有地区在同一帧同时发射；
        // 不使用随机数，确保组件重绘后动画节奏不会跳变。
        const delayMs = result.length * 260 + fromIndex * 90
        result.push({ key: `${from.code}-${to.code}`, delayMs, from: from.coordinates, to: to.coordinates })
      }
    }
    return result
  }, [locations])
  return <div className="globe-stage">
    <svg className="region-globe" viewBox="0 0 640 380" role="img" aria-label="服务器地区地球分布"
      onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, rotation } }}
      onPointerMove={event => { if (!drag.current) return; const dx = event.clientX - drag.current.x; const dy = event.clientY - drag.current.y; setRotation([drag.current.rotation[0] + dx * .35, Math.max(-75, Math.min(75, drag.current.rotation[1] - dy * .35))]) }}
      onPointerUp={() => { drag.current = undefined }} onPointerCancel={() => { drag.current = undefined }}>
      <defs><radialGradient id="globe-ocean" cx="35%" cy="28%"><stop offset="0" stopColor="var(--globe-ocean-light)" /><stop offset="1" stopColor="var(--globe-ocean-dark)" /></radialGradient><filter id="globe-glow"><feGaussianBlur stdDeviation="7" /></filter></defs>
      <circle className="globe-glow" cx="320" cy="190" r="171" filter="url(#globe-glow)" />
      <path className="globe-ocean" d={path({ type: 'Sphere' }) || ''} />
      <path className="globe-grid" d={path(geoGraticule10()) || ''} />
      {collection.features.map((country: Feature<Geometry, { name?: string }>) => {
        const id = String(country.id || '').padStart(3, '0')
        const code = countries.numericToAlpha2(id)
        const count = code ? activeRegions.get(code) || 0 : 0
        return <path key={id} className={count ? 'globe-country active' : 'globe-country'} d={path(country) || ''}><title>{country.properties?.name || id}{count ? ` · ${count} 台服务器` : ''}</title></path>
      })}
      <g className="globe-arcs">{arcs.map(arc => <LaserBeam key={arc.key} from={arc.from} to={arc.to} projection={projection} delayMs={arc.delayMs} />)}</g>
      <g className="globe-points">{locations.map(location => <g key={location.code} className="laser-origin"><path className="region-point-halo" d={haloPath({ type: 'Point', coordinates: location.coordinates }) || ''} /><path className="region-point" d={pointPath({ type: 'Point', coordinates: location.coordinates }) || ''}><title>{location.code} · {location.count} 台服务器</title></path></g>)}</g>
      <path className="globe-outline" d={path({ type: 'Sphere' }) || ''} />
    </svg>
    <p>拖动地球查看地区 · 已点亮 {activeRegions.size} 个国家或地区</p>
  </div>
}
