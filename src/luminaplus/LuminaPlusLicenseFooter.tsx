import type { ProbePayload } from '../types'
import { ProbeLicenseBar } from '../components/ProbeLicenseBar'

export function LuminaPlusLicenseFooter({ badges }: { badges: ProbePayload['license_badge'] }) {
  return <ProbeLicenseBar badges={badges} storageKey="jiwo-luminaplus-license-anim" className="lp-license-footer" toggleClassName="lp-license-toggle" />
}
