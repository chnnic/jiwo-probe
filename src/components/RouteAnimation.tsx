import { useMemo, useRef } from 'react'
import Lottie, { type LottieRefCurrentProps } from 'lottie-react'
import commonRouteAnimation from '../assets/return-route/common.json'
import premiumRouteAnimation from '../assets/return-route/premium.json'
import { useMotionTicker } from '../use-motion-ticker'

// lottie-web 体积大，只有经典主题的回程勋章用到，单独拆包按需加载（见 ServerVisuals）。
export default function RouteAnimation({ premium }: { premium: boolean }) {
  const lottieRef = useRef<LottieRefCurrentProps>(null)
  const data = premium ? premiumRouteAnimation : commonRouteAnimation
  // 容器是 lottie-react 自己建的，挂载后才拿得到
  const container = useMemo(() => ({ get current() { return lottieRef.current?.animationContainerRef.current ?? null } }), [])
  // 这个动画带表达式，每帧都很贵：不让 lottie 自己按屏幕刷新率播放，改由全页共用的 50ms 定时器逐步定位，
  // 一屏十几枚勋章在同一帧里一起更新；只推进屏幕内的（见 use-motion-ticker）。
  useMotionTicker(container, (elapsed) => {
    const frames = data.op - data.ip
    lottieRef.current?.goToAndStop(((elapsed / 1000) * data.fr) % frames, true)
  })
  return <Lottie lottieRef={lottieRef} animationData={data} aria-hidden="true" className="route-badge-icon" loop autoplay={false} />
}
