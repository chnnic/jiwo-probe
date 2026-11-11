// 主控断联提示：连接出错且数据超过 STALE_AFTER_MS 没更新才提示，偶发一次请求失败不打扰访客。
export const STALE_AFTER_MS = 20_000

export function staleDataLabel(ageMs: number, updatedAt: number): string {
  const seconds = Math.max(0, Math.round(ageMs / 1000))
  const age = seconds < 60 ? `${seconds} 秒` : seconds < 3600 ? `${Math.floor(seconds / 60)} 分钟` : `${Math.floor(seconds / 3600)} 小时`
  const time = new Date(updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `主控连接中断，正在显示 ${age}前（${time}）的数据，自动重试中`
}

// 快照提示延迟出现：线路正常时实时数据很快就到，不必闪一下提示条。
export const SNAPSHOT_HINT_DELAY_MS = 1_500

export function snapshotHintLabel(savedAt: number): string {
  const time = new Date(savedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  // 快照可能来自本机上次打开时的缓存，也可能是 Worker 冷启动时给的上一份数据，文案不区分来源
  return `正在显示 ${time} 的数据，实时数据加载中`
}

export function isStale(error: string | undefined, updatedAt: number | undefined, now: number): boolean {
  return !!error && updatedAt !== undefined && now - updatedAt >= STALE_AFTER_MS
}
