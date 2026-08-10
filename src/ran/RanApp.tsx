import App from './App'
import './styles/tokens.css'

export function RanApp({ initialTheme }: { initialTheme?: string }) {
  return <App initialTheme={initialTheme} />
}
