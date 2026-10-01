import {
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { geoCentroid, geoGraticule10, geoOrthographic, geoPath } from 'd3-geo'
import type { FeatureCollection, Geometry } from 'geojson'
import countries from 'i18n-iso-countries'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import world from 'world-atlas/countries-110m.json'
import { Twemoji } from './Twemoji'
import './region-globe.css'
import {
  CITY_REGION_COORDINATES,
  GLOBE_CENTER,
  GLOBE_RADIUS,
  layoutOrbit,
} from './orbit-layout'

export type PremiumProbeRegion = {
  code: string
  label: string
  total: number
  online: number
}

const GLOBE_VIEWBOX_WIDTH = 560
// 高度以前只写在 viewBox 字符串里,没有常量 —— 于是标签框只夹了 X、漏了 Y。
const GLOBE_VIEWBOX_HEIGHT = 340
const GLOBE_LABEL_HEIGHT = 26
const GLOBE_LABEL_MARGIN = 8
const INITIAL_ROTATION: [number, number] = [-108, -16]

export function BlackGoldGlobe({ regions, themed = false }: { regions: PremiumProbeRegion[]; themed?: boolean }) {
  const rotation = useRef<[number, number]>(INITIAL_ROTATION)
  const pendingRotation = useRef<[number, number] | undefined>(undefined)
  const animationFrame = useRef<number | undefined>(undefined)
  const drag = useRef<
    { x: number; y: number; rotation: [number, number] } | undefined
  >(undefined)
  const oceanPath = useRef<SVGPathElement>(null)
  const graticulePath = useRef<SVGPathElement>(null)
  const inactiveCountriesPath = useRef<SVGPathElement>(null)
  const activeCountryPaths = useRef<Array<SVGPathElement | null>>([])
  const outlinePath = useRef<SVGPathElement>(null)
  const orbitLabels = useRef<OrbitLabelsHandle>(null)
  const id = useId().replace(/:/g, '')
  const oceanID = `premium-probe-ocean-${id}`
  const glowID = `premium-probe-glow-${id}`
  const outsideMaskID = `premium-probe-outside-${id}`
  const center = GLOBE_CENTER
  const radius = GLOBE_RADIUS

  const activeCodes = useMemo(
    () => new Set(regions.map((region) => region.code.toUpperCase())),
    [regions]
  )
  const collection = useMemo(
    () =>
      feature(
        world as unknown as Topology,
        (world as unknown as Topology).objects.countries as GeometryCollection
      ) as unknown as FeatureCollection<Geometry, { name?: string }>,
    []
  )
  const projection = useMemo(
    () =>
      geoOrthographic()
        .translate([GLOBE_CENTER.x, GLOBE_CENTER.y])
        .scale(GLOBE_RADIUS)
        .clipAngle(90)
        .precision(0.4)
        .rotate(INITIAL_ROTATION),
    []
  )
  const path = useMemo(() => geoPath(projection), [projection])
  const graticule = useMemo(() => geoGraticule10(), [])
  const countryLayers = useMemo(() => {
    const active: Array<{
      code: string
      numeric: string
      feature: (typeof collection.features)[number]
    }> = []
    const inactive: typeof collection.features = []
    for (const country of collection.features) {
      const numeric = String(country.id || '').padStart(3, '0')
      const code = countries.numericToAlpha2(numeric) || ''
      if (activeCodes.has(code))
        active.push({ code, numeric, feature: country })
      else inactive.push(country)
    }
    return {
      active,
      inactive: {
        type: 'FeatureCollection' as const,
        features: inactive,
      },
    }
  }, [activeCodes, collection])
  const visibleRegions = useMemo(() => regions.slice(0, 7), [regions])
  const orbitRadius = radius + 33
  // 地区 → 真实经纬度。标签按这个方位摆,拖动地球时跟着转(工单 #566:
  // 原来角度只按数组下标平分,标签钉死在环上,转地球也纹丝不动)。
  const regionCoordinates = useMemo(() => {
    const map = new Map<string, [number, number]>()
    for (const country of collection.features) {
      const code = countries.numericToAlpha2(
        String(country.id || '').padStart(3, '0')
      )
      if (code) map.set(code, geoCentroid(country) as [number, number])
    }
    for (const [code, coordinates] of Object.entries(CITY_REGION_COORDINATES)) {
      map.set(code, coordinates)
    }
    return map
  }, [collection])

  useEffect(
    () => () => {
      if (animationFrame.current !== undefined)
        cancelAnimationFrame(animationFrame.current)
    },
    []
  )

  const queueRotation = (nextRotation: [number, number]) => {
    pendingRotation.current = nextRotation
    if (animationFrame.current !== undefined) return
    animationFrame.current = requestAnimationFrame(() => {
      const next = pendingRotation.current
      animationFrame.current = undefined
      if (!next) return
      projection.rotate(next)
      rotation.current = next
      const sphere = path({ type: 'Sphere' }) || ''
      oceanPath.current?.setAttribute('d', sphere)
      outlinePath.current?.setAttribute('d', sphere)
      graticulePath.current?.setAttribute('d', path(graticule) || '')
      inactiveCountriesPath.current?.setAttribute(
        'd',
        path(countryLayers.inactive) || ''
      )
      countryLayers.active.forEach((country, index) => {
        activeCountryPaths.current[index]?.setAttribute(
          'd',
          path(country.feature) || ''
        )
      })
      // 标签是按真实方位摆的,转地球必须一起重排。地球本体走 setAttribute 不重渲染,
      // 标签这一小块交给它自己的 state —— 只重渲染这个子树,不带上整张世界地图。
      orbitLabels.current?.update(next)
    })
  }

  return (
    <div className={`premium-probe-globe-stage${themed ? ' shared-region-globe' : ''}`}>
      <svg
        viewBox={`0 0 ${GLOBE_VIEWBOX_WIDTH} ${GLOBE_VIEWBOX_HEIGHT}`}
        role='img'
        aria-label='服务器地区分布 3D 地球'
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          event.currentTarget.classList.add('is-dragging')
          projection.precision(0.9)
          drag.current = {
            x: event.clientX,
            y: event.clientY,
            rotation: rotation.current,
          }
        }}
        onPointerMove={(event) => {
          if (!drag.current) return
          const dx = event.clientX - drag.current.x
          const dy = event.clientY - drag.current.y
          queueRotation([
            drag.current.rotation[0] + dx * 0.34,
            Math.max(-72, Math.min(72, drag.current.rotation[1] - dy * 0.34)),
          ])
        }}
        onPointerUp={(event) => {
          drag.current = undefined
          event.currentTarget.classList.remove('is-dragging')
          projection.precision(0.4)
          queueRotation(pendingRotation.current || rotation.current)
        }}
        onPointerCancel={(event) => {
          drag.current = undefined
          event.currentTarget.classList.remove('is-dragging')
          projection.precision(0.4)
          queueRotation(pendingRotation.current || rotation.current)
        }}
      >
        <defs>
          <radialGradient id={oceanID} cx='34%' cy='26%'>
            <stop
              className='premium-probe-ocean-start'
              offset='0'
              stopColor='#2b2922'
            />
            <stop
              className='premium-probe-ocean-middle'
              offset='0.55'
              stopColor='#12130f'
            />
            <stop
              className='premium-probe-ocean-end'
              offset='1'
              stopColor='#040505'
            />
          </radialGradient>
          <filter id={glowID} x='-40%' y='-40%' width='180%' height='180%'>
            <feGaussianBlur stdDeviation='7' />
          </filter>
          <mask id={outsideMaskID}>
            <rect width='560' height='340' fill='white' />
            <circle cx={center.x} cy={center.y} r={radius + 11} fill='black' />
          </mask>
        </defs>

        <g className='premium-probe-orbits' mask={`url(#${outsideMaskID})`}>
          <ellipse cx={center.x} cy={center.y} rx='174' ry='124' />
          <ellipse
            cx={center.x}
            cy={center.y}
            rx='182'
            ry='90'
            transform={`rotate(-25 ${center.x} ${center.y})`}
          />
          <ellipse
            cx={center.x}
            cy={center.y}
            rx='166'
            ry='112'
            transform={`rotate(34 ${center.x} ${center.y})`}
          />
        </g>

        <circle
          className='premium-probe-globe-glow'
          cx={center.x}
          cy={center.y}
          r={radius + 4}
          filter={`url(#${glowID})`}
        />
        <path
          ref={oceanPath}
          className='premium-probe-ocean'
          fill={`url(#${oceanID})`}
          d={path({ type: 'Sphere' }) || ''}
        />
        <path
          ref={graticulePath}
          className='premium-probe-graticule'
          d={path(graticule) || ''}
        />
        <path
          ref={inactiveCountriesPath}
          data-premium-probe-country
          d={path(countryLayers.inactive) || ''}
        />
        {countryLayers.active.map((country, index) => (
          <path
            ref={(element) => {
              activeCountryPaths.current[index] = element
            }}
            key={country.numeric}
            className='is-active'
            data-premium-probe-country
            d={path(country.feature) || ''}
          >
            <title>{country.feature.properties?.name || country.code}</title>
          </path>
        ))}
        <path
          ref={outlinePath}
          className='premium-probe-globe-outline'
          d={path({ type: 'Sphere' }) || ''}
        />

        <OrbitLabels
          ref={orbitLabels}
          regions={visibleRegions}
          coordinates={regionCoordinates}
          orbitRadius={orbitRadius}
          maskID={outsideMaskID}
          idPrefix={id}
        />
      </svg>
      <span>拖动地球查看地区</span>
    </div>
  )
}

type OrbitLabelsHandle = { update: (rotation: [number, number]) => void }

function OrbitLabels({
  regions,
  coordinates,
  orbitRadius,
  maskID,
  idPrefix,
  ref,
}: {
  regions: PremiumProbeRegion[]
  coordinates: Map<string, [number, number]>
  orbitRadius: number
  maskID: string
  idPrefix: string
  ref: React.Ref<OrbitLabelsHandle>
}) {
  const [rotation, setRotation] = useState<[number, number]>(INITIAL_ROTATION)
  useImperativeHandle(ref, () => ({ update: setRotation }), [])

  const orbitPoints = useMemo(
    () => layoutOrbit(regions, coordinates, rotation, orbitRadius),
    [regions, coordinates, rotation, orbitRadius]
  )

  return (
    <>
      {orbitPoints.length > 1 && (
        <g className='premium-probe-node-connections' mask={`url(#${maskID})`}>
          {orbitPoints.map((point, index) => {
            const next = orbitPoints[(index + 1) % orbitPoints.length]
            const connectionID = `premium-probe-connection-${idPrefix}-${index}`
            const connection = `M ${point.x} ${point.y} A ${orbitRadius} ${orbitRadius} 0 0 1 ${next.x} ${next.y}`
            return (
              <g key={point.region.code}>
                <path id={connectionID} d={connection} />
                <circle r='2.6'>
                  <animateMotion
                    dur={`${3.2 + index * 0.45}s`}
                    repeatCount='indefinite'
                  >
                    <mpath href={`#${connectionID}`} />
                  </animateMotion>
                </circle>
              </g>
            )
          })}
        </g>
      )}

      <g className='premium-probe-orbit-labels'>
        {orbitPoints.map(({ region, radians, rimX, rimY, front }) => {
          const anchorX = GLOBE_CENTER.x + Math.cos(radians) * orbitRadius
          const anchorY = GLOBE_CENTER.y + Math.sin(radians) * orbitRadius
          const labelX =
            GLOBE_CENTER.x + Math.cos(radians) * (GLOBE_RADIUS + 46)
          const labelY =
            GLOBE_CENTER.y + Math.sin(radians) * (GLOBE_RADIUS + 46)
          const cosine = Math.cos(radians)
          const labelWidth = Math.min(
            152,
            Math.max(72, Array.from(region.label).length * 7.5 + 38)
          )
          const preferredBoxX =
            cosine < -0.2
              ? labelX - labelWidth
              : cosine > 0.2
                ? labelX
                : labelX - labelWidth / 2
          const boxX = Math.max(
            GLOBE_LABEL_MARGIN,
            Math.min(
              preferredBoxX,
              GLOBE_VIEWBOX_WIDTH - labelWidth - GLOBE_LABEL_MARGIN
            )
          )
          // Y 也得夹,否则最上/最下那两个标签会伸出视口被裁掉。
          // 正上方的标签:labelY = 170 - (112 + 46) = 12,框顶 12 - 13 = -1;
          // 正下方的:框底 328 + 13 = 341,而视口高 340 —— 各差 1px,
          // 而描边只有 1px 且居中,那半像素在外面,整条边就没了(用户实报:
          // 上下两个地区的上下边框被遮挡)。
          const boxY = Math.max(
            GLOBE_LABEL_MARGIN,
            Math.min(
              labelY - GLOBE_LABEL_HEIGHT / 2,
              GLOBE_VIEWBOX_HEIGHT - GLOBE_LABEL_HEIGHT - GLOBE_LABEL_MARGIN
            )
          )
          return (
            <g
              key={region.code}
              className={front ? undefined : 'is-behind'}
              data-front={front ? 'true' : 'false'}
            >
              <line x1={rimX} y1={rimY} x2={anchorX} y2={anchorY} />
              <circle cx={rimX} cy={rimY} r='3.5' />
              <rect
                x={boxX}
                y={boxY}
                width={labelWidth}
                height={GLOBE_LABEL_HEIGHT}
                rx='4'
              />
              <foreignObject
                x={boxX}
                y={boxY}
                width={labelWidth}
                height={GLOBE_LABEL_HEIGHT}
              >
                <div className='premium-probe-orbit-label-content'>
                  <Twemoji className='premium-probe-orbit-label-name'>
                    {region.label}
                  </Twemoji>
                  <span
                    className='premium-probe-orbit-label-count'
                    aria-label={`${region.total} 台服务器`}
                  >
                    {region.total}
                  </span>
                </div>
              </foreignObject>
            </g>
          )
        })}
      </g>
    </>
  )
}
