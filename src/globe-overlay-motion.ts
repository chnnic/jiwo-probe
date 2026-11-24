// 经典地球上的弧线光点和亮点光晕：叠在地球上的 HTML 元素，用 Web Animations 关键帧播放，只动 transform 和 opacity。
// 这两样原先画在 SVG 里、每 50ms 改一次属性，地球在屏幕内时主线程每秒要重绘二十次；
// SVG 元素上的位移动画在高分屏（缩放不为 1）交不到合成线程，所以搬到 HTML 里。
// 关键帧仍然每 50ms 一步、步与步之间保持不动：画面和逐步改属性时一样，合成器也只在换步的那一帧重画（每秒 20 次），
// 不用按屏幕刷新率出帧。所有动画的周期都是步长的整数倍，并对齐到页面时间轴零点，全页在同一帧里换步。
// 关键帧的坐标是 SVG 用户单位，外层容器按地球的显示比例整体缩放（见 ProbeRegionGlobe）。
import { MOTION_STEP_MS, pulseAt } from './globe-motion.ts'
import type { StepHold } from './step-hold.ts'

/** 弧上的一个采样点，和 globe-arcs 的 sampleArc 返回值同形 */
export type PacketPoint = { x: number; y: number; visible: boolean }

export type StepKeyframe = { offset: number; transform: string; opacity: number; easing?: string }

/** 光点在弧两头各用这么大比例的路程淡入、淡出 */
const PACKET_FADE = 0.08
// linear 方式下换步用的时间占整圈的比例，远小于一帧
const JUMP = 1e-6

/** 每一步保持不动：step 方式每步一个带阶梯缓动的关键帧；linear 方式每步两个相同的关键帧，下一步开始前的一瞬间才跳（做法同 route-badge-motion）。 */
function stepKeyframes(steps: number, hold: StepHold, at: (step: number) => { transform: string; opacity: number }): StepKeyframe[] {
  const keyframes: StepKeyframe[] = []
  for (let step = 0; step < steps; step++) {
    const value = at(step)
    if (hold === 'step') {
      keyframes.push({ offset: step / steps, ...value, easing: 'step-end' })
      if (step === steps - 1) keyframes.push({ offset: 1, ...value })
    } else {
      keyframes.push({ offset: step / steps, ...value })
      keyframes.push({ offset: step === steps - 1 ? 1 : (step + 1) / steps - JUMP, ...value })
    }
  }
  return keyframes
}

export type PacketMotion = {
  keyframes: StepKeyframe[]
  /** 走完一圈的毫秒数，取整到步长的倍数 */
  duration: number
  /** 从一圈的哪里开始（0～1），取整到整步 */
  iterationStart: number
}

/**
 * 光点沿弧走一圈的动画：每 50ms 一步，位置在相邻采样点之间线性插值；两头各 8% 淡入淡出，被地球挡住的片段不显示。
 * origin 是容器左上角对应的 SVG 坐标（viewBox 的起点），durationMs 是走完一圈的时间，phase 是出发时刻错开的比例（0～1）。
 * hold 见 step-hold。采样点不足两个时返回 undefined。
 */
export function packetMotion(points: readonly PacketPoint[], origin: { x: number; y: number }, durationMs: number, phase: number, hold: StepHold): PacketMotion | undefined {
  const last = points.length - 1
  if (last < 1 || !(durationMs > 0)) return undefined
  const steps = Math.max(1, Math.round(durationMs / MOTION_STEP_MS))
  const keyframes = stepKeyframes(steps, hold, (step) => {
    const t = step / steps
    const at = t * last
    const index = Math.min(Math.floor(at), last - 1)
    const from = points[index]
    const to = points[index + 1]
    const part = at - index
    const x = from.x + (to.x - from.x) * part - origin.x
    const y = from.y + (to.y - from.y) * part - origin.y
    return {
      transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`,
      // 两头淡入淡出,别从端点上「蹦」出来；所在的小段有一端被挡住就不显示
      opacity: from.visible && to.visible ? Number(Math.min(1, t / PACKET_FADE, (1 - t) / PACKET_FADE).toFixed(2)) : 0,
    }
  })
  const startStep = ((Math.round(phase * steps) % steps) + steps) % steps
  return { keyframes, duration: steps * MOTION_STEP_MS, iterationStart: startStep / steps }
}

/** 亮点光晕一次脉冲的时长 */
export const HALO_PULSE_MS = 1150

/** 光晕脉冲的关键帧：每 50ms 一步，数值见 globe-motion 的 pulseAt */
export function haloKeyframes(hold: StepHold): StepKeyframe[] {
  return stepKeyframes(HALO_PULSE_MS / MOTION_STEP_MS, hold, (step) => {
    const { opacity, scale } = pulseAt(step * MOTION_STEP_MS, HALO_PULSE_MS)
    return { transform: `scale(${scale.toFixed(2)})`, opacity: Number(opacity.toFixed(2)) }
  })
}

export type GlobeBox = { left: number; top: number; width: number; height: number; scale: number }

/**
 * 地球那张 SVG 在舞台里的位置和显示比例，叠在上面的图层照这个摆。
 * svg / stage 是两者的屏幕矩形，border 是舞台的左、上边框宽度（绝对定位从内边距盒算起）；
 * SVG 按 viewBox 等比缩放并居中（被 max-height 限高时两侧留空），scale 是每个 SVG 单位占多少 px。
 */
export function globeBox(
  svg: { left: number; top: number; width: number; height: number },
  stage: { left: number; top: number },
  border: { left: number; top: number },
  view: { width: number; height: number },
): GlobeBox | undefined {
  const scale = Math.min(svg.width / view.width, svg.height / view.height)
  if (!(scale > 0) || !Number.isFinite(scale)) return undefined
  return { left: svg.left - stage.left - border.left, top: svg.top - stage.top - border.top, width: svg.width, height: svg.height, scale }
}
