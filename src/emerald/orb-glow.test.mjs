import test from 'node:test'
import assert from 'node:assert/strict'
import { ORB_GLOW_SIZE, ORB_GLOW_STOPS, orbGlowColorStops } from './orb-glow.ts'

// 半径 radius 的实心圆经标准差 sigma 的高斯模糊后，离圆心 distance 处的亮度（极坐标数值积分）
function blurredDisc(distance, radius, sigma) {
  const rings = 240
  const spokes = 240
  let sum = 0
  for (let i = 0; i < rings; i++) {
    const r = (i + 0.5) * (radius / rings)
    let ring = 0
    for (let j = 0; j < spokes; j++) {
      const angle = (j + 0.5) * ((2 * Math.PI) / spokes)
      ring += Math.exp(-(r * r + distance * distance - 2 * r * distance * Math.cos(angle)) / (2 * sigma * sigma))
    }
    sum += ring * r
  }
  return (sum * (radius / rings) * ((2 * Math.PI) / spokes)) / (2 * Math.PI * sigma * sigma)
}

function glowAt(position) {
  for (let index = 1; index < ORB_GLOW_STOPS.length; index++) {
    const [from, fromAlpha] = ORB_GLOW_STOPS[index - 1]
    const [to, toAlpha] = ORB_GLOW_STOPS[index]
    if (position <= to) return fromAlpha + ((toAlpha - fromAlpha) * (position - from)) / (to - from)
  }
  return 0
}

test('光斑的渐变色标就是「半径 18rem 的圆经 5rem 高斯模糊」的亮度曲线', () => {
  // 以 16px 的 rem 计：圆半径 288、标准差 80，画布半径对应 288 + 3×80 = 528
  const radius = 288
  const sigma = 80
  const outer = radius + 3 * sigma
  for (let step = 0; step <= 40; step++) {
    const position = step / 40
    const expected = blurredDisc(position * outer, radius, sigma)
    assert.ok(Math.abs(glowAt(position) - expected) < 0.004, `位置 ${position}: ${glowAt(position).toFixed(4)} ≠ ${expected.toFixed(4)}`)
  }
  // 从圆心到边缘单调变淡，最外圈完全透明（不留一圈台阶）
  for (let index = 1; index < ORB_GLOW_STOPS.length; index++) {
    assert.ok(ORB_GLOW_STOPS[index][0] > ORB_GLOW_STOPS[index - 1][0])
    assert.ok(ORB_GLOW_STOPS[index][1] < ORB_GLOW_STOPS[index - 1][1])
  }
  assert.deepEqual(ORB_GLOW_STOPS[0][0], 0)
  assert.deepEqual(ORB_GLOW_STOPS.at(-1), [1, 0])
  // 小画布放大后仍然平滑：相邻像素的不透明度差不超过 2%
  const pixel = 1 / (ORB_GLOW_SIZE / 2)
  for (let position = 0; position + pixel <= 1; position += pixel) assert.ok(Math.abs(glowAt(position) - glowAt(position + pixel)) < 0.045)
})

test('色标颜色取自样式里的 --orb，写法不对时用黑色', () => {
  const stops = orbGlowColorStops(' 168 85 247 ')
  assert.equal(stops.length, ORB_GLOW_STOPS.length)
  assert.deepEqual(stops[0], { offset: 0, color: 'rgba(168, 85, 247, 0.998)' })
  assert.deepEqual(stops.at(-1), { offset: 1, color: 'rgba(168, 85, 247, 0)' })
  assert.equal(orbGlowColorStops('16, 185, 129')[1].color, 'rgba(16, 185, 129, 0.993)')
  assert.equal(orbGlowColorStops('')[0].color, 'rgba(0, 0, 0, 0.998)')
  assert.equal(orbGlowColorStops('red')[0].color, 'rgba(0, 0, 0, 0.998)')
  assert.equal(orbGlowColorStops('300 0 0')[0].color, 'rgba(0, 0, 0, 0.998)')
})
