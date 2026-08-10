import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { applyAppearance } from './use-probe'
import './styles.css'

// Ran 主题界面（复刻 Komari-Ran-Theme · 精密金工质感），懒加载保持首屏体积
const RanApp = lazy(() => import('./ran/RanApp').then((module) => ({ default: module.RanApp })))

applyAppearance()
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<main className="center">Loading Ran…</main>}>
      <RanApp />
    </Suspense>
  </StrictMode>,
)
