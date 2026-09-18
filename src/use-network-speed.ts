import { useCallback } from 'react'
import { useProbe } from './use-probe'
import { formatNetworkSpeed } from './network-speed'

/** Context subscription also updates memoized cards when config arrives after data. */
export function useNetworkSpeed() {
  const { networkSpeedUnit } = useProbe()
  return useCallback((value = 0) => formatNetworkSpeed(value, networkSpeedUnit), [networkSpeedUnit])
}
