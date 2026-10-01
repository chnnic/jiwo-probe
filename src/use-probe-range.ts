import { createContext, useContext, useState } from 'react'
import { effectiveProbeRange, probeHistoryDays, probeRangeOptions, type ProbeRange } from './probe-ranges'

export const ProbeHistoryDaysContext = createContext<number | undefined>(undefined)

export function useProbeRange() {
  const historyDays = probeHistoryDays(useContext(ProbeHistoryDaysContext))
  const options = probeRangeOptions(historyDays)
  const [picked, setRange] = useState<ProbeRange>('1h')
  const range = effectiveProbeRange(picked, options)
  // Forget a selection invalidated by a shorter retention period.
  if (range !== picked) setRange(range)
  return { range, setRange, options, historyDays }
}
