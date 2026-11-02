import { useEffect, useState } from 'react'
import { isStale, SNAPSHOT_HINT_DELAY_MS, snapshotHintLabel, staleDataLabel } from './stale-data'
import './stale-data.css'

/** 所有经典界面主题共用的断联提示条；数据恢复后自动消失。Ran 有自己的连接状态，不经过这里。 */
export function StaleDataBanner({ error, updatedAt, fromSnapshot }: { error?: string; updatedAt?: number; fromSnapshot?: boolean }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!error) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 5000)
    return () => window.clearInterval(timer)
  }, [error])
  const [snapshotHint, setSnapshotHint] = useState(false)
  useEffect(() => {
    if (!fromSnapshot) {
      setSnapshotHint(false)
      return
    }
    const timer = window.setTimeout(() => setSnapshotHint(true), SNAPSHOT_HINT_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [fromSnapshot])
  if (!isStale(error, updatedAt, now)) {
    if (!snapshotHint || updatedAt === undefined) return null
    return <div className="stale-data-banner" role="status" aria-live="polite"><i aria-hidden="true" />{snapshotHintLabel(updatedAt)}</div>
  }
  return <div className="stale-data-banner" role="status" aria-live="polite"><i aria-hidden="true" />{staleDataLabel(now - updatedAt!, updatedAt!)}</div>
}
