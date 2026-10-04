import { useEffect } from 'react'
import App from './App'
import { startRanTranslation } from './i18n/translate-dom'
import './styles/tokens.css'

export function RanApp({ initialTheme }: { initialTheme?: string }) {
  // 界面汉化：词典见 i18n/zh.ts；Ran 卸载（切换到其他主题）时停止
  useEffect(() => startRanTranslation(), [])
  return <App initialTheme={initialTheme} />
}
