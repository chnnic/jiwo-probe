import test from 'node:test'
import assert from 'node:assert/strict'
import { MOTION_STEP_MS, dashOffset, motionProgress, shouldRunMotion, pulseAt } from './globe-motion.ts'

test('每 50ms 推一步（20fps）', () => {
  assert.equal(MOTION_STEP_MS, 50)
})

test('循环进度在 0～1 之间往复，周期无效时为 0', () => {
  assert.equal(motionProgress(0, 2400), 0)
  assert.equal(motionProgress(600, 2400), 0.25)
  assert.equal(motionProgress(2400, 2400), 0)
  assert.equal(motionProgress(3000, 2400), 0.25)
  assert.equal(motionProgress(100, 0), 0)
  assert.equal(motionProgress(NaN, 2400), 0)
})

test('虚线流动与原 CSS 动画一致：正向从 0 走到 -distance，反向从 -distance 走回 0', () => {
  assert.equal(dashOffset(0, 14000, 120), -0)
  assert.equal(dashOffset(7000, 14000, 120), -60)
  assert.equal(dashOffset(3500, 14000, 120), -30)
  assert.equal(dashOffset(0, 18000, 120, true), -120)
  assert.equal(dashOffset(9000, 18000, 120, true), -60)
  assert.equal(dashOffset(800, 3200, 40, true), -30)
})

test('不在视口、页面在后台、系统开了减少动态效果时都停掉', () => {
  assert.equal(shouldRunMotion({ inView: true, pageHidden: false, reducedMotion: false }), true)
  assert.equal(shouldRunMotion({ inView: false, pageHidden: false, reducedMotion: false }), false)
  assert.equal(shouldRunMotion({ inView: true, pageHidden: true, reducedMotion: false }), false)
  assert.equal(shouldRunMotion({ inView: true, pageHidden: false, reducedMotion: true }), false)
})

test('亮点光晕脉冲：从小而亮缓出到大而透明，最后 20% 保持不可见', () => {
  assert.deepEqual(pulseAt(0, 1150), { opacity: 0.8, scale: 0.5 })
  const middle = pulseAt(1150 * 0.4, 1150)
  // 缓出：时间走到一半时已经走过一半以上
  assert.ok(middle.opacity < 0.4 && middle.opacity > 0)
  assert.ok(middle.scale > 1.1 && middle.scale < 1.7)
  for (const progress of [0.8, 0.9, 0.99]) {
    const { opacity, scale } = pulseAt(1150 * progress, 1150)
    assert.ok(Math.abs(opacity) < 1e-9 && Math.abs(scale - 1.7) < 1e-9, `progress ${progress}`)
  }
  // 下一个周期从头开始
  assert.deepEqual(pulseAt(1150, 1150), { opacity: 0.8, scale: 0.5 })
})
