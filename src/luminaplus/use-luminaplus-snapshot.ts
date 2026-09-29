import { useEffect, useRef, useState } from 'react'
import type { ProbePayload } from '../types'
import { nextSpeedTrails } from './luminaplus-model'

/** Presentation-only batching. The shared data stream and history APIs are unchanged. */
export function useLuminaPlusSnapshot(data: ProbePayload) {
  const latest = useRef(data)
  const accepted = useRef(data)
  const scrolling = useRef(false)
  const [snapshot, setSnapshot] = useState(() => ({ data, trails: nextSpeedTrails(data.servers || []) }))
  const publish = useRef(() => {})
  publish.current = () => {
    if (scrolling.current || document.hidden || accepted.current === latest.current) return
    accepted.current = latest.current
    setSnapshot(before => ({ data: latest.current, trails: nextSpeedTrails(latest.current.servers || [], before.trails) }))
  }
  useEffect(() => { latest.current = data; publish.current() }, [data])
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const onScroll = () => {
      scrolling.current = true
      clearTimeout(timer)
      timer = setTimeout(() => { scrolling.current = false; publish.current() }, 160)
    }
    const onVisibility = () => publish.current()
    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    document.addEventListener('visibilitychange', onVisibility)
    return () => { clearTimeout(timer); window.removeEventListener('scroll', onScroll, true); document.removeEventListener('visibilitychange', onVisibility) }
  }, [])
  return snapshot
}
