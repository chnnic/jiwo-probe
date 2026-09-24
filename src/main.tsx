import { lazy, StrictMode, Suspense, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { applyAppearance, getActiveTheme, ProbeProvider, useProbe } from './use-probe'
import './styles.css'
import './win2000.css'

// Ran 主题界面（复刻 Komari-Ran-Theme · 精密金工质感），懒加载保持首屏体积。
// 主控下发 theme 为 ran 系列（ran/ran-night/ran-mist/...）时渲染金工界面，
// 其余（pixel/flat/anime/glass/lumina/自定义）渲染经典界面。
const RanApp = lazy(() => import('./ran/RanApp').then((module) => ({ default: module.RanApp })))
const Win2000App = lazy(() => import('./Win2000App').then((module) => ({ default: module.Win2000App })))

const RAN_PREFIX = /^ran(-|$)/i

function isRanTheme(theme: string): boolean {
  return RAN_PREFIX.test(theme)
}

function Root() {
  const [theme, setTheme] = useState<string>(() => getActiveTheme())
  // 主控下发变化（WS/poll 新帧）→ 同步切换界面
  useProbe()
  useEffect(() => {
    const refresh = () => setTheme(getActiveTheme())
    refresh()
    // applyAppearance 会改 documentElement 类，监听类变化即可捕获主控下发
    const observer = new MutationObserver(refresh)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const ran = isRanTheme(theme)
  const win2000 = theme === 'win2000'
  return (
    <Suspense fallback={<main className="center">{ran ? 'Loading Ran…' : win2000 ? 'Loading Windows 2000…' : 'Loading…'}</main>}>
      {ran ? <RanApp initialTheme={theme.toLowerCase()} /> : win2000 ? <Win2000App /> : <App />}
    </Suspense>
  )
}

applyAppearance()
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProbeProvider>
      <Root />
    </ProbeProvider>
  </StrictMode>,
)
