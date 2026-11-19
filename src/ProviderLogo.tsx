// 服务商 logo（移植自上游 47ae510 / ec038af / e1a487d / 434e33d，与主控内置探针同一样式）。
//
// 主控下发的是它自己的缓存地址 /api/public/provider-logo/{文件名}；外置探针与主控不同源，
// 由 Worker 的 /api/provider-logo/{文件名} 转发（见 worker/index.ts）。
// 许可证服务给的是透明 PNG：浅色、深色配色都直接透明显示，不垫底色、不加边框。
// 本身是黑 / 深色的 logo 在深色背景上看不见，图片加载完后量一次（provider-logo-dark.ts），
// 是的话加 class provider-logo-invert，由 styles.css 在深色配色下反色显示。
import { useReducer, type CSSProperties } from 'react'
import { knownDarkLogo, measureDarkLogo } from './provider-logo-dark'

const NAME_RE = /^[0-9]{1,10}\.[0-9a-f]{6,64}\.png$/

export function providerLogoSrc(path?: string): string {
  const name = (path || '').split('/').pop() || ''
  return NAME_RE.test(name) ? `/api/provider-logo/${name}` : ''
}

export function ProviderLogo({ path, name, url, size = 18, style }: { path?: string; name?: string; url?: string; size?: number; style?: CSSProperties }) {
  const src = providerLogoSrc(path)
  const [, refresh] = useReducer((count: number) => count + 1, 0)
  if (!src) return null
  const dark = knownDarkLogo(src)
  const wrap: CSSProperties = { display: 'inline-flex', flexShrink: 0, verticalAlign: 'middle', ...style }
  const img = <img className={dark ? 'provider-logo-img provider-logo-invert' : 'provider-logo-img'} src={src} alt={name || ''} title={name || undefined} loading="lazy" decoding="async" width={size} height={size}
    onLoad={(event) => { if (measureDarkLogo(src, event.currentTarget) && !dark) refresh() }}
    // 图片取不到（主控临时失败）时整个收起，不留裂图
    onError={(event) => { const box = event.currentTarget.parentElement; if (box) box.style.display = 'none' }}
    style={{ width: size, height: size, flexShrink: 0, borderRadius: 4, objectFit: 'contain' }} />
  if (!url) return <span className="provider-logo" style={wrap}>{img}</span>
  return <a className="provider-logo" href={url} target="_blank" rel="noopener noreferrer" style={wrap} onClick={(event) => event.stopPropagation()}>{img}</a>
}
