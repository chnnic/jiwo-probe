import test from 'node:test'
import assert from 'node:assert/strict'
import { holdAnimation, resumeAnimation } from './offscreen-animations.ts'

function fakeAnimation(startTime = 1200, playState = 'running') {
  const animation = {
    playState,
    calls: [],
    pause() { this.calls.push('pause'); this.playState = 'paused'; this._startTime = null },
    play() { this.calls.push('play'); this.playState = 'running' },
    _startTime: startTime,
    get startTime() { return this._startTime },
    // 和浏览器一样：给停着的动画设开始时间，它就接着播
    set startTime(value) { this.calls.push(`start=${value}`); this._startTime = value; this.playState = 'running' },
  }
  return animation
}

test('滚出屏幕时停下正在播的动画，回来时把开始时间改回去：相当于没停过，同屏的呼吸点仍然同步', () => {
  const held = new WeakMap()
  const animation = fakeAnimation(1200)
  holdAnimation(animation, held)
  assert.deepEqual(animation.calls, ['pause'])
  assert.equal(animation.playState, 'paused')
  // 重复通知不会把已经清空的开始时间记进去
  holdAnimation(animation, held)
  assert.deepEqual(animation.calls, ['pause'])
  resumeAnimation(animation, held)
  assert.deepEqual(animation.calls, ['pause', 'start=1200'])
  assert.equal(animation.playState, 'running')
  // 已经接着播了，再通知一次不动它
  resumeAnimation(animation, held)
  assert.deepEqual(animation.calls, ['pause', 'start=1200'])
})

test('不是自己停的动画不碰：样式里写了 paused 的、还没开始的', () => {
  const held = new WeakMap()
  const paused = fakeAnimation(500, 'paused')
  holdAnimation(paused, held)
  resumeAnimation(paused, held)
  assert.deepEqual(paused.calls, [])
  const idle = fakeAnimation(null, 'idle')
  holdAnimation(idle, held)
  resumeAnimation(idle, held)
  assert.deepEqual(idle.calls, [])
})

test('停着的期间被别人恢复过的不再动；没有开始时间的直接接着播', () => {
  const held = new WeakMap()
  const touched = fakeAnimation(800)
  holdAnimation(touched, held)
  touched.play()
  resumeAnimation(touched, held)
  assert.deepEqual(touched.calls, ['pause', 'play'])

  const pending = fakeAnimation(null)
  holdAnimation(pending, held)
  resumeAnimation(pending, held)
  assert.deepEqual(pending.calls, ['pause', 'play'])
})
