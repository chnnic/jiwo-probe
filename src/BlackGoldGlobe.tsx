import {
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
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
  MAX_ORBIT_LABELS,
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
  const graticulePath = useRef<SVGPathElement>(null)
  const inactiveCountriesPath = useRef<SVGPathElement>(null)
  const activeCountryPaths = useRef<Array<SVGPathElement | null>>([])
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
  // 环上的标签数以布局算法能保证的间隔为限(一圈放得下 2π / LABEL_MIN_GAP 个)。
  // 从前写死 7 个,第 8 个起的地区既没有标签、右边的「地区状态」里也没有(冰岛实报)。
  const visibleRegions = useMemo(
    () => regions.slice(0, MAX_ORBIT_LABELS),
    [regions]
  )
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
      // 海洋和外圈不用动:正射投影下球的轮廓怎么转都是同一个圆,重设 d 只会让带阴影的
      // 海洋每帧整块重绘(拖动卡顿的来源之一,与许可证站服务商榜的地球同样处理)。
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

  const targets = useMemo(
    () => layoutOrbit(regions, coordinates, rotation, orbitRadius),
    [regions, coordinates, rotation, orbitRadius]
  )
  // 标签实际显示的角度。扎堆的地区方位一交错,layoutOrbit 的推开顺序就会互换,标签会整格
  // 跳到另一边(拖动时「卡顿、闪到别的位置」);这里每帧只朝目标角度走 20%(且不超过
  // 0.15 弧度),正常拖动时跟随几乎无延迟。引线在球面上的那一端仍是实时的。
  // 与许可证站服务商榜的地球(vps-globe.tsx)同一套做法。
  const [shown, setShown] = useState<Map<string, number>>(() => new Map())
  const shownRef = useRef(shown)
  const latest = useRef(targets)
  const frame = useRef<number | undefined>(undefined)
  useLayoutEffect(() => {
    latest.current = targets
    const step = () => {
      frame.current = undefined
      let moving = false
      const next = new Map<string, number>()
      for (const { region, radians } of latest.current) {
        const last = shownRef.current.get(region.code)
        const delta =
          last === undefined
            ? 0
            : Math.atan2(Math.sin(radians - last), Math.cos(radians - last))
        const settled = Math.abs(delta) < 0.002
        if (!settled) moving = true
        next.set(
          region.code,
          last === undefined || settled
            ? radians
            : last + Math.max(-0.15, Math.min(0.15, delta * 0.2))
        )
      }
      shownRef.current = next
      setShown(next)
      if (moving) frame.current = requestAnimationFrame(step)
    }
    // 每帧最多挪一步:拖动时 targets 每帧都在变,这里要是再立刻挪一步,一帧就会走两步
    if (frame.current === undefined) frame.current = requestAnimationFrame(step)
  }, [targets])
  useEffect(
    () => () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current)
    },
    []
  )
  const orbitPoints = targets.map((point) => {
    const radians = shown.get(point.region.code) ?? point.radians
    return {
      ...point,
      radians,
      x: GLOBE_CENTER.x + Math.cos(radians) * orbitRadius,
      y: GLOBE_CENTER.y + Math.sin(radians) * orbitRadius,
    }
  })

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
          const labelWidth = Math.min(
            152,
            Math.max(72, Array.from(region.label).length * 7.5 + 38)
          )
          // 框相对 labelX 的位置随方位连续过渡:右侧框贴在它右边、左侧贴左边、正上下居中。
          // 原来按 cos 阈值三档切换,拖动经过阈值时标签会一下子横跳半个框宽。
          const shift =
            0.5 - 0.5 * Math.max(-1, Math.min(1, Math.cos(radians) / 0.4))
          const boxX = Math.max(
            GLOBE_LABEL_MARGIN,
            Math.min(
              labelX - labelWidth * shift,
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
          // 引线:球面上的点 → 轨道锚点 → 框上离锚点最近的一点。原来只画到锚点,和框之间空着一截。
          const endX = Math.max(boxX, Math.min(anchorX, boxX + labelWidth))
          const endY = Math.max(
            boxY,
            Math.min(anchorY, boxY + GLOBE_LABEL_HEIGHT)
          )
          return (
            <g
              key={region.code}
              className={front ? undefined : 'is-behind'}
              data-front={front ? 'true' : 'false'}
            >
              <polyline
                points={`${rimX},${rimY} ${anchorX},${anchorY} ${endX},${endY}`}
              />
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
