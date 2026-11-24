import test from 'node:test'
import assert from 'node:assert/strict'
import { HALO_PULSE_MS, globeBox, haloKeyframes, packetMotion } from './globe-overlay-motion.ts'
import { stepHoldFor } from './step-hold.ts'

// 一条有 n+1 个采样点的横线，hidden 里的下标是被地球挡住的点
const line = (segments, hidden = []) => Array.from({ length: segments + 1 }, (_, index) => ({ x: index * 10, y: 5, visible: !hidden.includes(index) }))
// 播到 t（0～1）时停在哪一帧：同一步的两帧数值相同，取不晚于 t 的最后一帧
const frameAt = (frames, t) => frames.findLast((frame) => frame.offset <= t) ?? frames[0]
const xOf = (frame) => Number(frame.transform.match(/translate\((-?[\d.]+)px/)[1])

test('光点每 50ms 一步（linear 保持）：周期取整到步长的倍数，每步两帧、数值相同，偏移量严格递增', () => {
  const motion = packetMotion(line(64), { x: 0, y: 0 }, 2010, 0, 'linear')
  assert.equal(motion.duration, 2000)
  assert.equal(motion.keyframes.length, 80)
  assert.equal(motion.keyframes[0].offset, 0)
  assert.equal(motion.keyframes.at(-1).offset, 1)
  for (let index = 1; index < motion.keyframes.length; index++) assert.ok(motion.keyframes[index].offset > motion.keyframes[index - 1].offset, `第 ${index} 帧`)
  for (let step = 0; step < 40; step++) {
    const [hold, jump] = motion.keyframes.slice(step * 2, step * 2 + 2)
    assert.deepEqual([hold.transform, hold.opacity], [jump.transform, jump.opacity], `第 ${step} 步`)
    assert.equal(hold.offset, step / 40)
    // 下一步开始前的一瞬间才跳
    if (step < 39) assert.ok((step + 1) / 40 - jump.offset > 0 && (step + 1) / 40 - jump.offset < 1e-5)
  }
})

test('光点位置：在相邻采样点之间线性插值，坐标减去 viewBox 起点', () => {
  // 4 段、每段 10 个单位，2000ms 走完 → 每步走 1 个单位
  const { keyframes } = packetMotion(line(4), { x: 120, y: -12 }, 2000, 0, 'linear')
  assert.equal(keyframes[0].transform, 'translate(-120.0px, 17.0px)')
  assert.equal(frameAt(keyframes, 0.5).transform, 'translate(-100.0px, 17.0px)')
  assert.equal(xOf(frameAt(keyframes, 0.26)), -110 + 0.0)
  assert.equal(keyframes.at(-1).transform, 'translate(-81.0px, 17.0px)')
})

test('光点不透明度：两头各 8% 淡入淡出，中间全亮；被地球挡住的片段为 0（和逐步改属性时一致）', () => {
  // 64 段里第 20～30 个采样点被挡住：第 19～30 段（两端有一个看不见）都不显示
  const hidden = Array.from({ length: 11 }, (_, index) => 20 + index)
  const points = line(64, hidden)
  const { keyframes } = packetMotion(points, { x: 0, y: 0 }, 2000, 0, 'linear')
  for (let step = 0; step < 40; step++) {
    const t = step / 40
    const segment = Math.min(Math.floor(t * 64), 63)
    const expected = points[segment].visible && points[segment + 1].visible ? Number(Math.min(1, t / 0.08, (1 - t) / 0.08).toFixed(2)) : 0
    assert.equal(keyframes[step * 2].opacity, expected, `第 ${step} 步`)
  }
  assert.equal(keyframes[0].opacity, 0)
  assert.equal(frameAt(keyframes, 0.05).opacity, 0.63)
  assert.equal(frameAt(keyframes, 0.2).opacity, 1)
  assert.equal(frameAt(keyframes, 0.4).opacity, 0)
  assert.equal(frameAt(keyframes, 0.6).opacity, 1)
})

test('光点出发时刻错开的比例取整到整步，各条弧在同一帧里换步', () => {
  assert.equal(packetMotion(line(8), { x: 0, y: 0 }, 2000, 0.382, 'step').iterationStart, 15 / 40)
  assert.equal(packetMotion(line(8), { x: 0, y: 0 }, 2000, 0.999, 'step').iterationStart, 0)
  assert.equal(packetMotion(line(8), { x: 0, y: 0 }, 2000, 0, 'step').iterationStart, 0)
})

test('光点：整条弧都被挡住时一直不显示；采样点不足两个或周期无效时没有动画', () => {
  const { keyframes } = packetMotion(line(8, [0, 1, 2, 3, 4, 5, 6, 7, 8]), { x: 0, y: 0 }, 1800, 0, 'step')
  assert.ok(keyframes.every((frame) => frame.opacity === 0))
  assert.equal(packetMotion([], { x: 0, y: 0 }, 1800, 0, 'step'), undefined)
  assert.equal(packetMotion(line(0), { x: 0, y: 0 }, 1800, 0, 'step'), undefined)
  assert.equal(packetMotion(line(8), { x: 0, y: 0 }, 0, 0, 'step'), undefined)
})

test('step 保持：每步一帧、带阶梯缓动，末尾补一帧收在 1；各步的数值和 linear 保持相同', () => {
  const step = packetMotion(line(64, [30, 31]), { x: 0, y: 0 }, 2000, 0.25, 'step')
  const linear = packetMotion(line(64, [30, 31]), { x: 0, y: 0 }, 2000, 0.25, 'linear')
  assert.deepEqual([step.duration, step.iterationStart], [linear.duration, linear.iterationStart])
  assert.equal(step.keyframes.length, 41)
  for (let index = 0; index < 40; index++) {
    const frame = step.keyframes[index]
    assert.deepEqual([frame.offset, frame.easing], [index / 40, 'step-end'])
    assert.deepEqual([frame.transform, frame.opacity], [linear.keyframes[index * 2].transform, linear.keyframes[index * 2].opacity])
  }
  const end = step.keyframes.at(-1)
  assert.deepEqual([end.offset, end.easing, end.transform], [1, undefined, step.keyframes[39].transform])
  assert.ok(linear.keyframes.every((frame) => frame.easing === undefined))
})

test('保持方式按内核挑：Safari 和 iOS 上的浏览器用 linear，Chrome、Edge、Firefox 用 step', () => {
  assert.equal(stepHoldFor('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15'), 'linear')
  assert.equal(stepHoldFor('Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.156 Mobile/15E148 Safari/604.1'), 'linear')
  assert.equal(stepHoldFor('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'), 'step')
  assert.equal(stepHoldFor('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0'), 'step')
  assert.equal(stepHoldFor('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0'), 'step')
  assert.equal(stepHoldFor(''), 'step')
})

test('亮点光晕脉冲：1150ms 分 23 步，从小而亮缓出到大而透明，最后 20% 保持不可见', () => {
  assert.equal(HALO_PULSE_MS, 1150)
  const frames = haloKeyframes('step')
  assert.equal(frames.length, 24)
  assert.deepEqual([frames[0].offset, frames[0].opacity, frames[0].transform, frames[0].easing], [0, 0.8, 'scale(0.50)', 'step-end'])
  for (let index = 1; index < frames.length; index++) assert.ok(frames[index].opacity <= frames[index - 1].opacity, `第 ${index} 步`)
  for (const frame of frames.filter((item) => item.offset >= 0.82)) assert.deepEqual([frame.opacity, frame.transform], [0, 'scale(1.70)'])
  assert.equal(frames.at(-1).offset, 1)
  assert.equal(haloKeyframes('linear').length, 46)
})

test('叠加层的位置：减去舞台的位置和边框；显示比例取宽高里更紧的一边', () => {
  const view = { width: 640, height: 460 }
  assert.deepEqual(globeBox({ left: 118, top: 60, width: 680, height: 488.75 }, { left: 100, top: 50 }, { left: 1, top: 2 }, view), { left: 17, top: 8, width: 680, height: 488.75, scale: 1.0625 })
  // 被 max-height 限高：宽度有富余，按高度算
  assert.equal(globeBox({ left: 0, top: 0, width: 680, height: 345 }, { left: 0, top: 0 }, { left: 0, top: 0 }, view).scale, 0.75)
  // 还没有尺寸（display: none）时不给结果
  assert.equal(globeBox({ left: 0, top: 0, width: 0, height: 0 }, { left: 0, top: 0 }, { left: 0, top: 0 }, view), undefined)
})
