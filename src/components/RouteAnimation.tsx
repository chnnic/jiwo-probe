import Lottie from 'lottie-react'
import commonRouteAnimation from '../assets/return-route/common.json'
import premiumRouteAnimation from '../assets/return-route/premium.json'

// lottie-web 体积大，只有经典主题的回程勋章用到，单独拆包按需加载（见 ServerVisuals）。
export default function RouteAnimation({ premium }: { premium: boolean }) {
  return <Lottie animationData={premium ? premiumRouteAnimation : commonRouteAnimation} aria-hidden="true" className="route-badge-icon" loop />
}
