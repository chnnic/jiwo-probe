import { useEffect, useState } from 'react'
import { isStale, staleDataLabel } from './stale-data'
import './stale-data.css'

/** 所有经典界面主题共用的断联提示条；数据恢复后自动消失。Ran 有自己的连接状态，不经过这里。 */
export function StaleDataBanner({ error, updatedAt }: { error?: string; updatedAt?: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!error) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 5000)
    return () => window.clearInterval(timer)
  }, [error])
  if (!isStale(error, updatedAt, now)) return null
  return <div className="stale-data-banner" role="status" aria-live="polite"><i aria-hidden="true" />{staleDataLabel(now - updatedAt!, updatedAt!)}</div>
}
