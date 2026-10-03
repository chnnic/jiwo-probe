import { lazy, Suspense } from 'react'
import { Monitor } from 'lucide-react'
import { siAlmalinux, siAlpinelinux, siApple, siArchlinux, siCentos, siDebian, siFedora, siFreebsd, siGentoo, siKalilinux, siLinux, siLinuxmint, siNixos, siOpensuse, siProxmox, siRedhat, siRockylinux, siUbuntu } from 'simple-icons'
import type { ProbeReturnRoute, ProbeServer } from '../types'

export function Meter({ icon, label, value, percent }: { icon: React.ReactNode; label: string; value: string; percent: number }) {
  return (
    <div className="metric">
      <div className="metric-head">
        <span>
          {icon}
          {label}
        </span>
        <strong>{value}</strong>
      </div>
      <div className="meter">
        <i style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
      </div>
    </div>
  )
}


export function systemTitle(server: ProbeServer): string {
  return (
    [server.os, server.kernel, server.arch].filter(Boolean).join(' · ') ||
    '系统信息未上报'
  )
}

const systemIcons = [
  { terms: ['alma'], icon: siAlmalinux },
  { terms: ['alpine'], icon: siAlpinelinux },
  { terms: ['arch'], icon: siArchlinux },
  { terms: ['centos'], icon: siCentos },
  { terms: ['debian'], icon: siDebian },
  { terms: ['fedora'], icon: siFedora },
  { terms: ['freebsd'], icon: siFreebsd },
  { terms: ['gentoo'], icon: siGentoo },
  { terms: ['kali'], icon: siKalilinux },
  { terms: ['mint'], icon: siLinuxmint },
  { terms: ['nixos', 'nix os'], icon: siNixos },
  { terms: ['opensuse', 'open suse', 'suse'], icon: siOpensuse },
  { terms: ['proxmox'], icon: siProxmox },
  { terms: ['red hat', 'redhat', 'rhel'], icon: siRedhat },
  { terms: ['rocky'], icon: siRockylinux },
  { terms: ['ubuntu'], icon: siUbuntu },
  { terms: ['darwin', 'macos', 'mac os'], icon: siApple },
]

export function SystemIcon({ server }: { server: ProbeServer }) {
  const os = (server.os || '').toLowerCase()
  if (os.includes('windows')) return <Monitor size={16} />
  const icon =
    systemIcons.find(({ terms }) => terms.some((term) => os.includes(term)))?.icon ?? siLinux
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      role="img"
      viewBox="0 0 24 24"
      fill={`#${icon.hex}`}
    >
      <path d={icon.path} />
    </svg>
  )
}


export const routeCarrierLabels = {
  telecom: '电信',
  unicom: '联通',
  mobile: '移动',
} as const

export const goldRoutes = new Set(['CN2GIA', 'CTGGIA', '9929', 'CMIN2', '163PP'])

export function displayReturnRoute(route: string): string {
  return route.toUpperCase().replace(/[^A-Z0-9]/g, '') === 'CMIN' ? 'CMI' : route
}


const RouteAnimation = lazy(() => import('./RouteAnimation'))

function ReturnRouteIcon({ premium }: { premium: boolean }) {
  // 加载动画前先占同样大小的位置，勋章不会跳动
  return <Suspense fallback={<span className="route-badge-icon" aria-hidden="true" />}><RouteAnimation premium={premium} /></Suspense>
}


export function ReturnRouteBadges({ routes, telecomPaidPeer, variant }: { routes: ProbeReturnRoute[]; telecomPaidPeer?: boolean; variant?: 'lumina' | 'anime' | 'glass' | 'emerald' }) {
  const byCarrier = new Map(routes.map((route) => [route.carrier, route]))
  const items = (['telecom', 'unicom', 'mobile'] as const).map((carrier) => {
    const route = byCarrier.get(carrier)
    const detectedRouteType = displayReturnRoute(route?.route_type || 'Unknown')
    const routeType = carrier === 'telecom' && telecomPaidPeer && detectedRouteType === '163' ? '163 PP' : detectedRouteType
    return { carrier, route, routeType, premium: goldRoutes.has(routeType.toUpperCase().replace(/[^A-Z0-9]/g, '')) }
  })
  if (variant === 'lumina' || variant === 'anime' || variant === 'glass' || variant === 'emerald') {
    // 主题化勋章：用主题原生 chip 代替通用 Lottie 动画，避免详情页与卡片视觉割裂。
    const flat = variant === 'lumina' ? 'lumina-route' : variant === 'anime' ? 'anime-route' : variant === 'glass' ? 'glass-route' : 'emerald-detail-route'
    return (
      <div className={`${flat}-badges`}>
        {items.map(({ carrier, route, routeType, premium }) => (
          <span className={`${flat}-chip${premium ? ' gold' : ''}`} key={carrier} title={route?.region ? `${route.region} · ${routeType}` : routeType}>
            <small>{routeCarrierLabels[carrier]}</small>
            <strong>{routeType}</strong>
          </span>
        ))}
      </div>
    )
  }
  return (
    <div className="return-route-badges">
      {items.map(({ carrier, route, routeType, premium }) => (
        <div className="route-badge" key={carrier} title={route?.region ? `${route.region} · ${routeType}` : routeType}>
          <div className={premium ? 'route-badge-animation gold' : 'route-badge-animation silver'}><ReturnRouteIcon premium={premium} /></div>
          <div className={premium ? 'route-badge-text gold' : 'route-badge-text silver'}>
            <small>{routeCarrierLabels[carrier]}</small>
            <strong>{routeType}</strong>
          </div>
        </div>
      ))}
    </div>
  )
}
