import test from 'node:test'
import assert from 'node:assert/strict'
import { skipAnimationIterationEvents } from './skip-iteration-events.ts'

test('animationiteration 的监听被丢掉，其他事件连同参数和 this 原样注册', () => {
  const calls = []
  const target = { addEventListener(type, listener, options) { calls.push({ self: this, type, listener, options }) } }
  skipAnimationIterationEvents(target)
  const listener = () => {}
  target.addEventListener('animationiteration', listener, true)
  target.addEventListener('webkitAnimationIteration', listener)
  target.addEventListener('animationend', listener, { passive: true })
  target.addEventListener('click', listener)
  assert.deepEqual(calls.map((call) => call.type), ['animationend', 'click'])
  assert.equal(calls[0].self, target)
  assert.equal(calls[0].listener, listener)
  assert.deepEqual(calls[0].options, { passive: true })
})

test('包在原型上时对每个实例生效', () => {
  const calls = []
  class Target { addEventListener(type) { calls.push([this, type]) } }
  skipAnimationIterationEvents(Target.prototype)
  const first = new Target()
  first.addEventListener('animationiteration')
  first.addEventListener('scroll')
  assert.deepEqual(calls, [[first, 'scroll']])
})

test('没有可包的对象时什么都不做', () => {
  assert.doesNotThrow(() => skipAnimationIterationEvents(undefined))
})
