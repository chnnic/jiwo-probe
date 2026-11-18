// 服务商 logo（移植自上游 47ae510 / ec038af，与主控内置探针同一样式）。
//
// 主控下发的是它自己的缓存地址 /api/public/provider-logo/{文件名}；外置探针与主控不同源，
// 由 Worker 的 /api/provider-logo/{文件名} 转发（见 worker/index.ts）。
// 许可证服务给的是透明 PNG：垫白底、不加边框，深色主题下深色 logo 也看得清。
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
  const img = <img src={src} alt={name || ''} title={name || undefined} loading="lazy" decoding="async" width={size} height={size}
    style={{ width: size, height: size, flexShrink: 0, borderRadius: 4, background: '#fff', objectFit: 'contain' }} />
  if (!url) return <span className="provider-logo" style={wrap}>{img}</span>
  return <a className="provider-logo" href={url} target="_blank" rel="noopener noreferrer" style={wrap} onClick={(event) => event.stopPropagation()}>{img}</a>
}
