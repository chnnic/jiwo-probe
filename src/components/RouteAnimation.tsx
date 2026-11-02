import { useEffect, useRef } from 'react'
import Lottie, { type LottieRefCurrentProps } from 'lottie-react'
import commonRouteAnimation from '../assets/return-route/common.json'
import premiumRouteAnimation from '../assets/return-route/premium.json'

// lottie-web 体积大，只有经典主题的回程勋章用到，单独拆包按需加载（见 ServerVisuals）。
export default function RouteAnimation({ premium }: { premium: boolean }) {
  const lottieRef = useRef<LottieRefCurrentProps>(null)
  // 这个动画带表达式，每帧都很贵：只播放屏幕内的，并按动画自身的 30 帧播放，不跟屏幕刷新率。
  useEffect(() => {
    const lottie = lottieRef.current
    const container = lottie?.animationContainerRef.current
    if (!lottie || !container) return
    lottie.setSubframe(false)
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) lottie.play()
      else lottie.pause()
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])
  return <Lottie lottieRef={lottieRef} animationData={premium ? premiumRouteAnimation : commonRouteAnimation} aria-hidden="true" className="route-badge-icon" loop autoplay={false} />
}
