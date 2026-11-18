import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import MapApp from './MapApp'
import { ProbeProvider } from '../use-probe'
import { startRanTranslation } from './i18n/translate-dom'
import './styles/tokens.css'
import { installFlagFont } from '../flag-font'

installFlagFont()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProbeProvider>
      <MapApp />
    </ProbeProvider>
  </StrictMode>,
)

// 独立地图页同样汉化
startRanTranslation()
