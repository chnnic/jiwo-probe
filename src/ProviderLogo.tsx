// 服务商 logo（移植自上游 47ae510 / ec038af / e1a487d，与主控内置探针同一样式）。
//
// 主控下发的是它自己的缓存地址 /api/public/provider-logo/{文件名}；外置探针与主控不同源，
// 由 Worker 的 /api/provider-logo/{文件名} 转发（见 worker/index.ts）。
// 许可证服务给的是透明 PNG：浅色配色直接透明显示；深色配色垫白底（styles.css 的 .provider-logo-img 规则，
// 上游 e1a487d），黑字之类的深色 logo 才看得清。不加边框。
import type { CSSProperties } from 'react'

const NAME_RE = /^[0-9]{1,10}\.[0-9a-f]{6,64}\.png$/

export function providerLogoSrc(path?: string): string {
  const name = (path || '').split('/').pop() || ''
  return NAME_RE.test(name) ? `/api/provider-logo/${name}` : ''
}

export function ProviderLogo({ path, name, url, size = 18, style }: { path?: string; name?: string; url?: string; size?: number; style?: CSSProperties }) {
  const src = providerLogoSrc(path)
  if (!src) return null
  const wrap: CSSProperties = { display: 'inline-flex', flexShrink: 0, verticalAlign: 'middle', ...style }
  const img = <img className="provider-logo-img" src={src} alt={name || ''} title={name || undefined} loading="lazy" decoding="async" width={size} height={size}
    // 图片取不到（主控临时失败）时整个收起，不留裂图
    onError={(event) => { const box = event.currentTarget.parentElement; if (box) box.style.display = 'none' }}
    style={{ width: size, height: size, flexShrink: 0, borderRadius: 4, objectFit: 'contain' }} />
  if (!url) return <span className="provider-logo" style={wrap}>{img}</span>
  return <a className="provider-logo" href={url} target="_blank" rel="noopener noreferrer" style={wrap} onClick={(event) => event.stopPropagation()}>{img}</a>
}
