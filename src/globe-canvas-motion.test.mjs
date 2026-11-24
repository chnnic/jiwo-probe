import test from 'node:test'
import assert from 'node:assert/strict'
import { GLOBE_ORBITS, canvasColor, clockwiseArc, drawGlobeMotion, globeCanvasPlacement, globeMotionView, parseDashArray, parseGlow } from './globe-canvas-motion.ts'

const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message ?? ''} ${actual} ≠ ${expected}`)

test('相邻标签之间的弧：两点都在环上、顺时针夹角不到半圈时，圆心就是地球中心', () => {
  const center = { x: 280, y: 170 }
  const at = (radians) => ({ x: center.x + Math.cos(radians) * 145, y: center.y + Math.sin(radians) * 145 })
  const arc = clockwiseArc(at(0.2), at(1.3), 145)
  near(arc.cx, 280)
  near(arc.cy, 170)
  near(arc.radius, 145)
  near(arc.start, 0.2)
  near(arc.sweep, 1.1)
  // 跨过 ±π 的那一段照样是顺时针的短弧
  const wrapped = clockwiseArc(at(3), at(-3), 145)
  near(wrapped.cx, 280)
  near(wrapped.sweep, Math.PI * 2 - 6)
})

test('顺时针夹角超过半圈时取另一侧圆上的短弧（和 SVG 的 A 命令一致）；两点重合不画，弦比直径长时放大半径', () => {
  const center = { x: 280, y: 170 }
  const at = (radians) => ({ x: center.x + Math.cos(radians) * 145, y: center.y + Math.sin(radians) * 145 })
  // 从 1.3 顺时针回到 0.2 要绕大半圈：SVG 画的是镜像圆上那 1.1 弧度
  const mirrored = clockwiseArc(at(1.3), at(0.2), 145)
  near(mirrored.sweep, 1.1)
  near(mirrored.radius, 145)
  assert.ok(Math.hypot(mirrored.cx - center.x, mirrored.cy - center.y) > 100)
  // 弧的两端仍然落在两个标签上
  near(mirrored.cx + Math.cos(mirrored.start) * 145, at(1.3).x)
  near(mirrored.cy + Math.sin(mirrored.start + mirrored.sweep) * 145, at(0.2).y)
  assert.equal(clockwiseArc({ x: 5, y: 5 }, { x: 5, y: 5 }, 145), undefined)
  assert.equal(clockwiseArc({ x: 0, y: 0 }, { x: 10, y: 0 }, 0), undefined)
  const stretched = clockwiseArc({ x: 0, y: 0 }, { x: 400, y: 0 }, 145)
  near(stretched.radius, 200)
  near(stretched.sweep, Math.PI)
})

test('计算样式里的颜色、虚线、辉光转成画布用的值', () => {
  assert.equal(canvasColor('rgba(216, 180, 106, 0.7)'), 'rgba(216, 180, 106, 0.7)')
  assert.equal(canvasColor('rgb(255, 240, 181)'), 'rgb(255, 240, 181)')
  // color-mix() 的计算值
  assert.equal(canvasColor('color(srgb 0.0627451 0.72549 0.505882 / 0.65)'), 'rgba(16, 185, 129, 0.65)')
  assert.equal(canvasColor('color(srgb 1 0.5 0)'), 'rgba(255, 128, 0, 1)')
  assert.equal(canvasColor('color(srgb 0.2 0.4 0.6 / 50%)'), 'rgba(51, 102, 153, 0.5)')
  assert.equal(canvasColor('color(display-p3 1 0 0)'), 'color(display-p3 1 0 0)')

  assert.deepEqual(parseDashArray('7px, 8px'), [7, 8])
  assert.deepEqual(parseDashArray('3 7'), [3, 7])
  assert.deepEqual(parseDashArray('none'), [])
  assert.deepEqual(parseDashArray(''), [])
  assert.deepEqual(parseDashArray('0px, 0px'), [])

  assert.deepEqual(parseGlow('drop-shadow(rgb(240, 189, 78) 0px 0px 5px)'), { color: 'rgb(240, 189, 78)', blur: 5 })
  assert.deepEqual(parseGlow('drop-shadow(0px 0px 4px rgba(216, 180, 106, 0.72))'), { color: 'rgba(216, 180, 106, 0.72)', blur: 4 })
  assert.deepEqual(parseGlow('drop-shadow(color(srgb 0.0627451 0.72549 0.505882 / 0.5) 0px 0px 3px)'), { color: 'rgba(16, 185, 129, 0.5)', blur: 3 })
  assert.equal(parseGlow('none'), undefined)
  assert.equal(parseGlow('blur(4px)'), undefined)
  // 有偏移的投影、没有模糊的投影不是辉光
  assert.equal(parseGlow('drop-shadow(rgb(0, 0, 0) 0px 16px 16px)'), undefined)
  assert.equal(parseGlow('drop-shadow(rgb(0, 0, 0) 0px 0px 0px)'), undefined)
})

test('画布的边对齐到设备像素，SVG 的框差出来的小数记下来', () => {
  const placement = globeCanvasPlacement(
    { left: 671.0546875, top: 169.2578125, width: 516.9453125, height: 313.859375 },
    { left: 667.0546875, top: 146.2578125, width: 524.9453125, height: 360 },
    { width: 524.9453125, height: 360, borderLeft: 0, borderTop: 0 },
    2,
  )
  // 屏幕上的 671.05 → 设备像素 1342.11，往外取整到 1342 和 2376
  assert.equal(placement.width, 1034)
  assert.equal(placement.height, 629)
  near(placement.left, 671 - 667.0546875)
  near(placement.top, 169 - 146.2578125)
  assert.equal(placement.cssWidth, 517)
  assert.equal(placement.cssHeight, 314.5)
  near(placement.svg.x, 0.109375)
  near(placement.svg.y, 0.515625)
  near(placement.svg.width, 1033.890625)
  near(placement.svg.height, 627.71875)
  // 已经对齐的不动
  const aligned = globeCanvasPlacement({ left: 10, top: 20, width: 300, height: 200 }, { left: 8, top: 16, width: 320, height: 240 }, { width: 320, height: 240, borderLeft: 1, borderTop: 2 }, 2)
  assert.deepEqual(aligned, { left: 1, top: 2, cssWidth: 300, cssHeight: 200, width: 600, height: 400, svg: { x: 0, y: 0, width: 600, height: 400 } })
  assert.equal(globeCanvasPlacement({ left: 0, top: 0, width: 0, height: 0 }, { left: 0, top: 0, width: 10, height: 10 }, { width: 10, height: 10, borderLeft: 0, borderTop: 0 }, 2), undefined)
  assert.equal(globeCanvasPlacement({ left: 0, top: 0, width: 10, height: 10 }, { left: 0, top: 0, width: 0, height: 0 }, { width: 0, height: 0, borderLeft: 0, borderTop: 0 }, 2), undefined)
})

test('祖先在做缩放动画时，按排版尺寸换算回去摆画布', () => {
  // 舞台排版时 561×430，入场动画缩到 0.97 倍：屏幕矩形都乘了 0.97
  const scale = 0.97
  const placement = globeCanvasPlacement(
    { left: 500 + 20 * scale, top: 60 + 10 * scale, width: 400 * scale, height: 300 * scale },
    { left: 500, top: 60, width: 561 * scale, height: 430 * scale },
    { width: 561, height: 430, borderLeft: 0, borderTop: 0 },
    2,
  )
  near(placement.left, 20)
  near(placement.top, 10)
  assert.equal(placement.width, 800)
  assert.equal(placement.height, 600)
  near(placement.svg.width, 800)
  near(placement.svg.x, 0)
})

test('viewBox 在画布里等比缩放并居中', () => {
  const view = { width: 560, height: 340 }
  // SVG 比 viewBox 更「高」：按宽度缩放，上下留空
  const tall = globeMotionView({ left: 0, top: 0, cssWidth: 561, cssHeight: 430, width: 1122, height: 860, svg: { x: 0, y: 0, width: 1122, height: 860 } }, view)
  near(tall.unit, 1122 / 560)
  near(tall.originX, 0)
  near(tall.originY, (860 - 340 * (1122 / 560)) / 2)
  assert.equal(tall.pixelRatio, 2)
  // 带小数偏移
  const offset = globeMotionView({ left: 0, top: 0, cssWidth: 517, cssHeight: 314.5, width: 1034, height: 629, svg: { x: 0.25, y: 0.5, width: 1033.5, height: 627.5 } }, view)
  near(offset.unit, 1033.5 / 560)
  near(offset.originX, 0.25)
  near(offset.originY, 0.5 + (627.5 - 340 * (1033.5 / 560)) / 2)
})

function fakeContext() {
  const calls = []
  const state = { lineWidth: 1, lineDashOffset: 0, strokeStyle: '', fillStyle: '', globalAlpha: 1, shadowColor: '', shadowBlur: 0, dash: [] }
  const record = (name) => (...args) => { calls.push({ name, args, ...state, dash: [...state.dash] }) }
  const ctx = {
    setTransform: record('setTransform'), clearRect: record('clearRect'), save: record('save'), restore: record('restore'), beginPath: record('beginPath'),
    rect: record('rect'), arc: record('arc'), ellipse: record('ellipse'), clip: record('clip'), stroke: record('stroke'), fill: record('fill'),
    setLineDash: (dash) => { state.dash = dash },
  }
  for (const key of ['lineWidth', 'lineDashOffset', 'strokeStyle', 'fillStyle', 'globalAlpha', 'shadowColor', 'shadowBlur']) {
    Object.defineProperty(ctx, key, { get: () => state[key], set: (value) => { state[key] = value } })
  }
  return { ctx, calls }
}

const STYLE = {
  orbit: { stroke: 'orbit', width: 1, dash: [7, 8], opacity: [1, 0.7, 0.48] },
  link: { stroke: 'link', width: 1.15, dash: [3, 7] },
  dot: { fill: 'dot', stroke: 'ring', strokeWidth: 1, glow: { color: 'glow', blur: 5 } },
}
const SCENE = {
  width: 1120, height: 680, pixelRatio: 2, unit: 2, originX: 0, originY: 0, view: { width: 560, height: 340 },
  center: { x: 280, y: 170 }, hole: 123, orbits: GLOBE_ORBITS,
  links: [{ cx: 280, cy: 170, radius: 145, start: 0, sweep: 1 }, { cx: 280, cy: 170, radius: 145, start: 1, sweep: 2 }],
  showDots: true,
}

test('轨道和连线：线宽、虚线按屏幕像素算，流动的距离、方向、周期与原先一致', () => {
  const { ctx, calls } = fakeContext()
  drawGlobeMotion(ctx, SCENE, STYLE, 3500)
  // 只画在 viewBox 以内、地球外圈以外
  assert.deepEqual(calls.find((call) => call.name === 'rect').args, [0, 0, 1120, 680])
  assert.deepEqual(calls.find((call) => call.name === 'clip').args, ['evenodd'])
  const strokes = calls.filter((call) => call.name === 'stroke')
  const orbits = strokes.slice(0, 3)
  assert.deepEqual(orbits.map((call) => call.globalAlpha), [1, 0.7, 0.48])
  for (const call of orbits) {
    assert.equal(call.strokeStyle, 'orbit')
    assert.equal(call.lineWidth, 2)
    assert.deepEqual(call.dash, [14, 16])
  }
  // 14s 一圈走 120px：3.5s 走了 30px，画布上是 60 个像素；第二条 18s、反向
  near(orbits[0].lineDashOffset, -60)
  near(orbits[1].lineDashOffset, -240 * (1 - 3500 / 18000))
  near(orbits[2].lineDashOffset, -240 * (3500 / 22000))
  const ellipses = calls.filter((call) => call.name === 'ellipse')
  assert.deepEqual(ellipses[1].args, [560, 340, 364, 180, (-25 * Math.PI) / 180, 0, Math.PI * 2])

  const links = strokes.slice(3, 5)
  for (const call of links) {
    assert.equal(call.strokeStyle, 'link')
    assert.equal(call.globalAlpha, 1)
    near(call.lineWidth, 2.3)
    assert.deepEqual(call.dash, [6, 14])
  }
  // 第一条 2.4s 正向，第二条 3.2s 反向，各走 40px
  near(links[0].lineDashOffset, -80 * ((3500 % 2400) / 2400))
  near(links[1].lineDashOffset, -80 * (1 - (3500 % 3200) / 3200))
  const arcs = calls.filter((call) => call.name === 'arc')
  // 第一个 arc 是挖掉地球的圆，接着是两条连线
  assert.deepEqual(arcs[0].args, [560, 340, 246, 0, Math.PI * 2])
  assert.deepEqual(arcs[1].args, [560, 340, 290, 0, 1])
  assert.deepEqual(arcs[2].args, [560, 340, 290, 1, 3])
})

test('光点沿连线匀速走，带辉光；拖动或减少动态效果时不画', () => {
  const { ctx, calls } = fakeContext()
  drawGlobeMotion(ctx, SCENE, STYLE, 1600)
  const arcs = calls.filter((call) => call.name === 'arc').slice(3)
  // 每个光点两个圆：带阴影的底、光点本身
  assert.equal(arcs.length, 4)
  // 第一条连线上的光点 3.2s 走完，1.6s 时走到一半；第二条 3.65s 走完
  const first = 0 + 1 * 0.5
  near(arcs[0].args[0], (280 + Math.cos(first) * 145) * 2)
  near(arcs[0].args[1], (170 + Math.sin(first) * 145) * 2)
  near(arcs[0].args[2], (2.6 + 0.5) * 2)
  near(arcs[1].args[2], 2.6 * 2)
  const second = 1 + 2 * (1600 / 3650)
  near(arcs[2].args[0], (280 + Math.cos(second) * 145) * 2)
  const fills = calls.filter((call) => call.name === 'fill')
  assert.equal(fills.length, 4)
  // 滤镜里的 5 是标准差（SVG 单位），画布的 shadowBlur 是标准差的两倍
  assert.deepEqual([fills[0].shadowColor, fills[0].shadowBlur, fills[0].fillStyle], ['glow', 20, 'ring'])
  assert.deepEqual([fills[1].shadowColor, fills[1].shadowBlur, fills[1].fillStyle], ['transparent', 0, 'dot'])
  const dotStroke = calls.filter((call) => call.name === 'stroke').at(-1)
  assert.deepEqual([dotStroke.strokeStyle, dotStroke.lineWidth, dotStroke.dash], ['ring', 2, []])

  const plain = fakeContext()
  drawGlobeMotion(plain.ctx, SCENE, { ...STYLE, dot: { ...STYLE.dot, glow: undefined } }, 1600)
  assert.equal(plain.calls.filter((call) => call.name === 'fill').length, 2)

  const hidden = fakeContext()
  drawGlobeMotion(hidden.ctx, { ...SCENE, showDots: false }, STYLE, 1600)
  assert.equal(hidden.calls.filter((call) => call.name === 'fill').length, 0)
  assert.equal(hidden.calls.filter((call) => call.name === 'stroke').length, 5)
})
