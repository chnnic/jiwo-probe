import { lazy, Suspense, type ComponentProps, type ComponentType, type ReactNode } from 'react'

// recharts 只在详情页、趋势弹窗和转发链视图里用到，却占首屏主包的大头。
// 这些组件统一从这里按需加载：每个外壳自带 Suspense，加载期间只空出自己那一块，
// 不会冒泡到 main.tsx 的整页「Loading…」。首屏渲染后空闲时再预取，点开时基本不用等。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deferred<T extends ComponentType<any>>(load: () => Promise<T>, fallback: ReactNode = null) {
  const Lazy = lazy(() => load().then((component) => ({ default: component })))
  return function Deferred(props: ComponentProps<T>) {
    return <Suspense fallback={fallback}><Lazy {...props} /></Suspense>
  }
}

const loadPingTrend = () => import('./charts/PingTrendDialog')
const loadSystemTrend = () => import('./charts/SystemTrendChart')
const loadTraffic = () => import('./charts/TrafficChart')
const loadServerDetail = () => import('./ServerDetail')
const loadForward = () => import('./ForwardOverview')

export const TrendDialog = deferred(() => loadPingTrend().then((m) => m.TrendDialog))
export const SystemTrendChart = deferred(() => loadSystemTrend().then((m) => m.SystemTrendChart))
export const TrafficDialog = deferred(() => loadTraffic().then((m) => m.TrafficDialog))
export const TrafficChart = deferred(() => loadTraffic().then((m) => m.TrafficChart))
export const ServerDetail = deferred(() => loadServerDetail().then((m) => m.ServerDetail))
export const ForwardOverview = deferred(() => loadForward().then((m) => m.ForwardOverview))

let prefetched = false
/** 首屏稳定后在空闲时预取图表模块；只执行一次，失败也不影响页面（点开时会再加载）。 */
export function prefetchDeferred(): void {
  if (prefetched || typeof window === 'undefined') return
  prefetched = true
  const run = () => {
    for (const load of [loadPingTrend, loadSystemTrend, loadTraffic, loadServerDetail, loadForward]) {
      load().catch(() => { /* 网络失败时保持按需加载 */ })
    }
  }
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 5000 })
  else setTimeout(run, 2000)
}
