import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildGlobeRegions, globeCountryCode } from './globe-regions.ts'
import { CITY_REGION_COORDINATES, GLOBE_CENTER, GLOBE_RADIUS, LABEL_MIN_GAP, layoutOrbit } from './orbit-layout.ts'

const region = code => ({ code, label: code, total: 1, online: 1 })
const coordinates = new Map(Object.entries({ ...CITY_REGION_COORDINATES, JP: [138, 36], US: [-98, 39], DE: [10, 51] }))

test('地球地区兼容国旗、大小写、城市后缀，合并重复地区且顺序稳定', () => {
  assert.equal(globeCountryCode('🇭🇰'), 'HK')
  assert.equal(globeCountryCode(' jp · Tokyo '), 'JP')
  assert.equal(globeCountryCode('unknown'), '')
  const values = ['🇭🇰', 'hk', 'JP · Tokyo', '', 'unknown', 'SG']
  const groups = buildGlobeRegions(values)
  assert.deepEqual(groups.map(({ code, total }) => [code, total]), [['HK', 2], ['JP', 1], ['SG', 1]])
  assert.deepEqual(groups, buildGlobeRegions([...values].reverse()))
  assert.deepEqual(buildGlobeRegions([]), [])
})

test('跟随上游：拖动地球时地区标签随真实方位移动', () => {
  const regions = ['HK', 'US', 'DE'].map(region)
  const before = layoutOrbit(regions, coordinates, [-108, -16], 145)
  const after = layoutOrbit(regions, coordinates, [-8, -16], 145)
  assert.ok(before.filter((point, i) => Math.abs(point.radians - after[i].radians) > 1e-6).length >= 2)
})

test('正面点落在真实球面位置，背面点落在地平线并标记 behind', () => {
  const [lon, lat] = CITY_REGION_COORDINATES.HK
  const [front] = layoutOrbit([region('HK')], coordinates, [-lon, -lat], 145)
  const [back] = layoutOrbit([region('HK')], coordinates, [-(lon + 180), lat], 145)
  assert.ok(front.front)
  assert.ok(Math.hypot(front.rimX - GLOBE_CENTER.x, front.rimY - GLOBE_CENTER.y) < 2)
  assert.equal(back.front, false)
  assert.ok(Math.abs(Math.hypot(back.rimX - GLOBE_CENTER.x, back.rimY - GLOBE_CENTER.y) - GLOBE_RADIUS) < 1e-6)
})

test('港新日相邻标签有最小间隔，缺失坐标及空地区安全降级', () => {
  const points = layoutOrbit(['HK', 'SG', 'JP'].map(region), coordinates, [-114, -22], 145)
  const angles = points.map(point => point.radians).sort((a, b) => a - b)
  for (let i = 1; i < angles.length; i++) assert.ok(angles[i] - angles[i - 1] >= LABEL_MIN_GAP - 1e-9)
  const [unknown] = layoutOrbit([region('ZZ')], coordinates, [-108, -16], 145)
  assert.ok(Number.isFinite(unknown.radians))
  assert.ok(Math.hypot(unknown.x - GLOBE_CENTER.x, unknown.y - GLOBE_CENTER.y) > 100)
  assert.deepEqual(layoutOrbit([], coordinates, [-108, -16], 145), [])
})

test('通用和 Glassmorphism 地球复用 Premium 新组件，不再保留旧渲染副本', () => {
  for (const path of ['./RegionGlobe.tsx', './glassmorphism/GmEarth.tsx']) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8')
    assert.match(source, /<BlackGoldGlobe/)
    assert.doesNotMatch(source, /geoOrthographic|LaserBeam/)
  }
  const source = readFileSync(new URL('./BlackGoldGlobe.tsx', import.meta.url), 'utf8')
  assert.match(source, /orbitLabels\.current\?\.update\(next\)/)
  assert.match(source, /y=\{boxY\}/)
})
