import { useMemo } from 'react'
import { BlackGoldGlobe } from './BlackGoldGlobe'
import { buildGlobeRegions } from './globe-regions'

/** All region views share the upstream Premium globe, including its rotating labels. */
export function RegionGlobe({ regions }: { regions: string[] }) {
  const regionKey = [...regions].filter(Boolean).sort().join('\u0001')
  const groups = useMemo(() => buildGlobeRegions(regionKey.split('\u0001')), [regionKey])
  return <div className="globe-stage"><BlackGoldGlobe regions={groups} themed /></div>
}
