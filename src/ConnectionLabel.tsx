import { Cable, Network } from 'lucide-react'

/** Shared protocol labels; colors and typography continue to follow each theme. */
export function ConnectionLabel({ protocol, size = 13 }: { protocol: 'TCP' | 'UDP'; size?: number }) {
  const Icon = protocol === 'TCP' ? Cable : Network
  return <span className="probe-connection-label"><Icon size={size} aria-hidden="true" />{protocol}</span>
}
