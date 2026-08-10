/**
 * NetworkLossHeatmap — world map showing per-node packet loss as colored
 * bubbles. Uses the same world-atlas / d3-geo pipeline as VisitorFocusMap,
 * so the geography looks real instead of hand-drawn polygons.
 *
 * Bubble color and size scale with loss percent:
 *
 *   < 0.1%    healthy green, small
 *   0.1 – 0.5 lime
 *   0.5 – 1   yellow
 *   1   – 2   amber
 *   > 2%      red, large
 *
 * Offline nodes show as red bubbles regardless of loss.
 *
 * Projection: Natural Earth — better for compact aspect ratios than
 * equirectangular (continents aren't stretched at the top/bottom).
 */

import { useMemo } from 'react'
import { geoNaturalEarth1, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Topology } from 'topojson-specification'
import type { FeatureCollection, Geometry, GeoJsonProperties } from 'geojson'
import topo from 'world-atlas/countries-110m.json'

import type { KomariNode, KomariRecord } from '@/types/komari'
import { Etch } from '@/components/atoms/Etch'
import { SerialPlate } from '@/components/atoms/SerialPlate'
import { contentFs } from '@/utils/fontScale'
import { nodeToLonLat } from '@/utils/cities'

const COUNTRIES = feature(
  topo as unknown as Topology,
  (topo as unknown as Topology).objects.countries,
) as FeatureCollection<Geometry, GeoJsonProperties>

interface Props {
  nodes: KomariNode[]
  records: Record<string, KomariRecord>
  title?: string
  serial?: string
}

interface Bubble {
  uuid: string
  name: string
  cx: number
  cy: number
  loss: number
  online: boolean
  size: number
  color: string
}

function colorForLoss(loss: number, online: boolean): string {
  if (!online) return 'var(--signal-bad)'
  if (loss > 2) return 'var(--signal-bad)'
  if (loss > 1) return '#d97a3a'
  if (loss > 0.5) return 'var(--signal-warn)'
  if (loss > 0.1) return '#a0b03a'
  return 'var(--signal-good)'
}

function sizeForLoss(loss: number, online: boolean): number {
  if (!online) return 7
  if (loss > 2) return 9
  if (loss > 1) return 7.5
  if (loss > 0.5) return 6.5
  return 5.5
}

export function NetworkLossHeatmap({
  nodes,
  records,
  title = 'NETWORK HEATMAP (LOSS %)',
  serial = 'NH01',
}: Props) {
  const width = 760
  const height = 380

  // Natural Earth projection — fitted to the SVG canvas
  const projection = useMemo(
    () => geoNaturalEarth1().fitSize([width, height], { type: 'Sphere' }),
    [width, height],
  )
  const path = useMemo(() => geoPath(projection), [projection])

  const bubbles: Bubble[] = useMemo(() => {
    const out: Bubble[] = []
    for (const n of nodes) {
      const lonLat = nodeToLonLat(n)
      if (!lonLat) continue
      const projected = projection(lonLat)
      if (!projected) continue
      const [cx, cy] = projected
      const r = records[n.uuid]
      const online = !!r?.online
      const loss = typeof r?.loss === 'number' ? r.loss : 0
      out.push({
        uuid: n.uuid,
        name: n.name ?? n.uuid.slice(0, 8),
        cx,
        cy,
        loss,
        online,
        size: sizeForLoss(loss, online),
        color: colorForLoss(loss, online),
      })
    }
    // Render highest-loss bubbles last so they sit on top
    out.sort((a, b) => a.loss - b.loss)
    return out
  }, [nodes, records, projection])

  return (
    <div
      className="precision-card"
      style={{
        padding: '14px 18px',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <Etch>{title}</Etch>
        <SerialPlate>{serial}</SerialPlate>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 14,
          alignItems: 'flex-start',
          flex: 1,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMidYMid meet"
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              background: 'var(--bg-1)',
              borderRadius: 2,
            }}
          >
            {/* Country outlines */}
            {COUNTRIES.features.map((c, i) => (
              <path
                key={i}
                d={path(c) ?? undefined}
                fill="var(--bg-inset)"
                stroke="var(--edge-engrave)"
                strokeWidth={0.5}
              />
            ))}

            {/* Node bubbles */}
            {bubbles.map((b) => (
              <g key={b.uuid}>
                <circle
                  cx={b.cx}
                  cy={b.cy}
                  r={b.size + 3}
                  fill={b.color}
                  opacity={0.18}
                />
                <circle
                  cx={b.cx}
                  cy={b.cy}
                  r={b.size}
                  fill={b.color}
                  fillOpacity={0.8}
                  stroke={b.color}
                  strokeWidth={0.8}
                >
                  <title>
                    {b.name} · loss {b.loss.toFixed(2)}%
                    {!b.online ? ' (offline)' : ''}
                  </title>
                </circle>
              </g>
            ))}

            {bubbles.length === 0 && (
              <text
                x={width / 2}
                y={height / 2}
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                fontSize={13}
                fill="var(--fg-3)"
                letterSpacing="0.1em"
              >
                no node coordinates available
              </text>
            )}
          </svg>
        </div>

        {/* Legend */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 7,
            paddingLeft: 10,
            borderLeft: '1px solid var(--edge-engrave)',
            minWidth: 110,
            flexShrink: 0,
          }}
        >
          {(
            [
              { color: 'var(--signal-good)', label: '< 0.1%' },
              { color: '#a0b03a', label: '0.1% – 0.5%' },
              { color: 'var(--signal-warn)', label: '0.5% – 1%' },
              { color: '#d97a3a', label: '1% – 2%' },
              { color: 'var(--signal-bad)', label: '> 2%' },
            ] as const
          ).map((row) => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                fontFamily: 'var(--font-mono)',
                fontSize: contentFs(10),
                color: 'var(--fg-1)',
                letterSpacing: '0.04em',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: row.color,
                  flexShrink: 0,
                }}
              />
              {row.label}
            </div>
          ))}
          <div style={{ marginTop: 'auto', paddingTop: 10 }}>
            <a
              href="#/map"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontFamily: 'var(--font-mono)',
                fontSize: contentFs(10),
                letterSpacing: '0.02em',
                color: 'var(--fg-2)',
                textDecoration: 'none',
                transition: 'color 0.12s ease',
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.color =
                  'var(--accent-bright)')
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.color =
                  'var(--fg-2)')
              }
            >
              <span>View Geo Map</span>
              <span style={{ fontSize: contentFs(11) }}>→</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
