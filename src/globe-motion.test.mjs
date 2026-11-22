import test from 'node:test'
import assert from 'node:assert/strict'
import { MOTION_STEP_MS, dashOffset, motionProgress, shouldRunMotion } from './globe-motion.ts'

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
