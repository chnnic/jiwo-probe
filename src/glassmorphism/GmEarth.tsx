import { BlackGoldGlobe, type PremiumProbeRegion } from '../BlackGoldGlobe'

export type GmRegion = PremiumProbeRegion

export function GmEarth({ regions }: { regions: GmRegion[] }) {
  return <div className="gm-globe-stage"><BlackGoldGlobe regions={regions} themed /></div>
}
