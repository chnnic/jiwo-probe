import test from 'node:test'
import assert from 'node:assert/strict'
import { LICENSE_REVEAL_END, nameplateFrame, nameplatePhases } from './license-nameplate-motion.ts'

test('铭牌一个周期的关键时刻：翻入、文字显现、扫光、翻出', () => {
  const start = nameplateFrame(0)
  assert.equal(start.opacity, 0)
  assert.ok(Math.abs(start.rotateX + 92) < 1e-9)
  assert.equal(start.reveal, 0)

  const shown = nameplateFrame(0.5)
  assert.deepEqual([shown.rotateX, shown.scale, shown.opacity, shown.reveal, shown.starOpacity], [0, 1, 1, 1, 0])
  assert.equal(shown.shineOpacity, 1)

  assert.equal(nameplateFrame(LICENSE_REVEAL_END / 2).reveal, 0.5)
  assert.equal(nameplateFrame(0.2).starOpacity, 1)
  assert.equal(nameplateFrame(0.8).shineOpacity, 0)

  const end = nameplateFrame(0.9999)
  assert.ok(end.opacity === 0 && end.rotateX > 83)
})

test('各段关键帧的段内偏移从 0 到 1 严格递增，段的起止落在周期内', () => {
  const phases = nameplatePhases(200)
  for (const [name, { start, end, frames }] of Object.entries(phases)) {
    assert.ok(start >= 0 && end <= 1 && end > start, name)
    assert.equal(frames[0].offset, 0, name)
    assert.equal(frames.at(-1).offset, 1, name)
    for (let index = 1; index < frames.length; index++) assert.ok(frames[index].offset > frames[index - 1].offset, `${name} 第 ${index} 帧`)
  }
  // 翻入从周期开头起，翻出到周期结尾止；扫光在文字显现完之后
  assert.equal(phases.plateIn.start, 0)
  assert.equal(phases.plateOut.end, 1)
  assert.ok(phases.shine.start > phases.text.end)
})

test('文字外层和内层的平移始终抵消，文字停在原位', () => {
  const { text, inner } = nameplatePhases(200)
  const percent = (frame) => Number(frame.transform.match(/translateX\((-?[\d.]+)%\)/)[1])
  assert.deepEqual([text.start, text.end], [inner.start, inner.end])
  assert.deepEqual(text.frames.map((frame) => frame.offset), inner.frames.map((frame) => frame.offset))
  text.frames.forEach((frame, index) => assert.equal(percent(frame) + percent(inner.frames[index]), 0))
  assert.equal(percent(text.frames[0]), -100)
  assert.equal(percent(text.frames.at(-1)), 0)
})

test('各段末态与段外的静止状态衔接：翻入停在完整铭牌，翻出停在不可见，星尘和扫光首尾都不可见', () => {
  const { plateIn, plateOut, stars, shine } = nameplatePhases(200)
  assert.equal(plateIn.frames[0].opacity, 0)
  assert.deepEqual([plateIn.frames.at(-1).opacity, plateIn.frames.at(-1).transform], [1, 'perspective(340px) rotateX(0.00deg) scale(1.000)'])
  assert.equal(plateOut.frames[0].transform, 'perspective(340px) rotateX(0.00deg) scale(1.000)')
  assert.equal(plateOut.frames.at(-1).opacity, 0)
  assert.equal(stars.frames[0].opacity, 0)
  assert.ok(Math.abs(stars.frames.at(-1).opacity) < 1e-9)
  assert.equal(shine.frames[0].opacity, 0)
  assert.ok(Math.abs(shine.frames.at(-1).opacity) < 1e-9)
})

test('段内线性插值与逐帧计算的结果一致', () => {
  const phases = nameplatePhases(240)
  const at = ({ start, end, frames }, progress, read) => {
    const local = (progress - start) / (end - start)
    const next = frames.findIndex((frame) => frame.offset >= local - 1e-12)
    if (next <= 0) return read(frames[0])
    const a = frames[next - 1], b = frames[next]
    return read(a) + (read(b) - read(a)) * ((local - a.offset) / (b.offset - a.offset))
  }
  const number = (pattern) => (frame) => Number(frame.transform.match(pattern)[1])
  const within = ({ start, end }, progress) => progress >= start && progress <= end
  for (let step = 0; step <= 400; step++) {
    const progress = step / 400
    const exact = nameplateFrame(progress)
    for (const part of [phases.plateIn, phases.plateOut]) {
      if (!within(part, progress)) continue
      assert.ok(Math.abs(at(part, progress, number(/rotateX\((-?[\d.]+)deg\)/)) - exact.rotateX) < 0.6, `rotateX @ ${progress}`)
      assert.ok(Math.abs(at(part, progress, number(/scale\(([\d.]+)\)/)) - exact.scale) < 0.004, `scale @ ${progress}`)
      assert.ok(Math.abs(at(part, progress, (frame) => frame.opacity) - exact.opacity) < 0.02, `opacity @ ${progress}`)
    }
    if (within(phases.stars, progress)) {
      assert.ok(Math.abs(at(phases.stars, progress, (frame) => frame.opacity) - exact.starOpacity) < 1e-6, `星尘透明度 @ ${progress}`)
      assert.ok(Math.abs(at(phases.stars, progress, number(/translateX\((-?[\d.]+)px\)/)) - (13 + exact.reveal * (240 - 26))) < 0.06, `星尘位置 @ ${progress}`)
    } else assert.equal(exact.starOpacity, 0, `星尘段外应不可见 @ ${progress}`)
    if (within(phases.shine, progress)) {
      assert.ok(Math.abs(at(phases.shine, progress, (frame) => frame.opacity) - exact.shineOpacity) < 1e-6, `扫光透明度 @ ${progress}`)
      assert.ok(Math.abs(at(phases.shine, progress, number(/translateX\((-?[\d.]+)px\)/)) - ((-55 + exact.shineProgress * 165) / 100) * 240) < 0.06, `扫光位置 @ ${progress}`)
    } else assert.equal(exact.shineOpacity, 0, `扫光段外应不可见 @ ${progress}`)
    // 翻入、翻出之外铭牌完整显示；文字显现段之外文字全部可见
    if (!within(phases.plateIn, progress) && !within(phases.plateOut, progress)) assert.deepEqual([exact.rotateX, exact.scale, exact.opacity], [0, 1, 1])
    if (!within(phases.text, progress)) assert.equal(exact.reveal, 1)
  }
})
