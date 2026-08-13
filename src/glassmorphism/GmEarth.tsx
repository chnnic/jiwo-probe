import { useEffect, useId, useMemo, useRef } from 'react'
import { geoGraticule10, geoOrthographic, geoPath } from 'd3-geo'
import type { FeatureCollection, Geometry } from 'geojson'
import countries from 'i18n-iso-countries'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import world from 'world-atlas/countries-110m.json'
import { Twemoji } from '../Twemoji'

export type GmRegion = {
  code: string
  label: string
  total: number
  online: number
}

const GM_GLOBE_CENTER = { x: 280, y: 170 }
const GM_GLOBE_RADIUS = 112
const GM_GLOBE_VIEWBOX_WIDTH = 560
const GM_GLOBE_LABEL_MARGIN = 8
const GM_INITIAL_ROTATION: [number, number] = [-108, -16]

export function GmEarth({ regions }: { regions: GmRegion[] }) {
  const rotation = useRef<[number, number]>(GM_INITIAL_ROTATION)
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
  const id = useId().replace(/:/g, '')
  const oceanID = `gm-ocean-${id}`
  const glowID = `gm-glow-${id}`
  const outsideMaskID = `gm-outside-${id}`
  const center = GM_GLOBE_CENTER
  const radius = GM_GLOBE_RADIUS

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
        .translate([GM_GLOBE_CENTER.x, GM_GLOBE_CENTER.y])
        .scale(GM_GLOBE_RADIUS)
        .clipAngle(90)
        .precision(0.4)
        .rotate(GM_INITIAL_ROTATION),
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
  const visibleRegions = regions.slice(0, 7)
  const orbitRadius = radius + 33
  const orbitPoints = visibleRegions.map((region, index) => {
    const angle =
      -148 +
      (visibleRegions.length === 1
        ? 148
        : (index * 296) / (visibleRegions.length - 1))
    const radians = (angle * Math.PI) / 180
    return {
      region,
      radians,
      x: center.x + Math.cos(radians) * orbitRadius,
      y: center.y + Math.sin(radians) * orbitRadius,
    }
  })

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
    })
  }

  return (
    <div className='gm-globe-stage'>
      <svg
        viewBox='0 0 560 340'
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
            <stop offset='0' stopColor='#16323a' />
            <stop offset='0.55' stopColor='#0d1f27' />
            <stop offset='1' stopColor='#060d13' />
          </radialGradient>
          <filter id={glowID} x='-40%' y='-40%' width='180%' height='180%'>
            <feGaussianBlur stdDeviation='7' />
          </filter>
          <mask id={outsideMaskID}>
            <rect width='560' height='340' fill='white' />
            <circle cx={center.x} cy={center.y} r={radius + 11} fill='black' />
          </mask>
        </defs>

        <g className='gm-orbits' mask={`url(#${outsideMaskID})`}>
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
          className='gm-globe-glow'
          cx={center.x}
          cy={center.y}
          r={radius + 4}
          filter={`url(#${glowID})`}
        />
        <path
          ref={oceanPath}
          className='gm-ocean'
          fill={`url(#${oceanID})`}
          d={path({ type: 'Sphere' }) || ''}
        />
        <path
          ref={graticulePath}
          className='gm-graticule'
          d={path(graticule) || ''}
        />
        <path
          ref={inactiveCountriesPath}
          data-gm-country
          d={path(countryLayers.inactive) || ''}
        />
        {countryLayers.active.map((country, index) => (
          <path
            ref={(element) => {
              activeCountryPaths.current[index] = element
            }}
            key={country.numeric}
            className='is-active'
            data-gm-country
            d={path(country.feature) || ''}
          >
            <title>{country.feature.properties?.name || country.code}</title>
          </path>
        ))}
        <path
          ref={outlinePath}
          className='gm-globe-outline'
          d={path({ type: 'Sphere' }) || ''}
        />

        {orbitPoints.length > 1 && (
          <g
            className='gm-node-connections'
            mask={`url(#${outsideMaskID})`}
          >
            {orbitPoints.map((point, index) => {
              const next = orbitPoints[(index + 1) % orbitPoints.length]
              const connectionID = `gm-connection-${id}-${index}`
              const connection = `M ${point.x} ${point.y} A ${orbitRadius} ${orbitRadius} 0 0 1 ${next.x} ${next.y}`
              return (
                <g key={connectionID}>
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

        <g className='gm-orbit-labels'>
          {orbitPoints.map(({ region, radians }) => {
            const rimX = center.x + Math.cos(radians) * radius
            const rimY = center.y + Math.sin(radians) * radius
            const anchorX = center.x + Math.cos(radians) * orbitRadius
            const anchorY = center.y + Math.sin(radians) * orbitRadius
            const labelX = center.x + Math.cos(radians) * (radius + 46)
            const labelY = center.y + Math.sin(radians) * (radius + 46)
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
              GM_GLOBE_LABEL_MARGIN,
              Math.min(
                preferredBoxX,
                GM_GLOBE_VIEWBOX_WIDTH - labelWidth - GM_GLOBE_LABEL_MARGIN
              )
            )
            return (
              <g key={region.code}>
                <line x1={rimX} y1={rimY} x2={anchorX} y2={anchorY} />
                <circle cx={rimX} cy={rimY} r='3.5' />
                <rect
                  x={boxX}
                  y={labelY - 13}
                  width={labelWidth}
                  height='26'
                  rx='4'
                />
                <foreignObject
                  x={boxX}
                  y={labelY - 13}
                  width={labelWidth}
                  height='26'
                >
                  <div className='gm-orbit-label-content'>
                    <Twemoji className='gm-orbit-label-name'>
                      {region.label}
                    </Twemoji>
                    <span
                      className='gm-orbit-label-count'
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
      </svg>
      <span>拖动地球查看地区</span>
    </div>
  )
}
