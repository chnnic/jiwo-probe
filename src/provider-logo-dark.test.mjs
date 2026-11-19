import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isDarkLogoPixels } from './provider-logo-dark.ts'

const pixels = (...groups) => groups.flatMap(([rgba, count]) => Array.from({ length: count }, () => rgba).flat())

test('黑色或深色像素占三成以上的 logo 判为深色', () => {
  assert.equal(isDarkLogoPixels(pixels([[0, 0, 0, 255], 100])), true, '纯黑字')
  assert.equal(isDarkLogoPixels(pixels([[20, 30, 70, 255], 100])), true, '深蓝')
  assert.equal(isDarkLogoPixels(pixels([[0, 0, 0, 255], 30], [[255, 80, 0, 255], 70])), true, '正好三成')
})

test('彩色、浅色的 logo 不反色', () => {
  assert.equal(isDarkLogoPixels(pixels([[255, 255, 255, 255], 100])), false)
  assert.equal(isDarkLogoPixels(pixels([[230, 60, 40, 255], 100])), false, '红色')
  assert.equal(isDarkLogoPixels(pixels([[0, 0, 0, 255], 29], [[255, 80, 0, 255], 71])), false, '不到三成')
})

test('透明像素不计入，全透明的图不反色', () => {
  assert.equal(isDarkLogoPixels(pixels([[0, 0, 0, 0], 100])), false)
  assert.equal(isDarkLogoPixels(pixels([[0, 0, 0, 40], 90], [[255, 255, 255, 255], 10])), false, '半透明的黑边不算')
  assert.equal(isDarkLogoPixels(pixels([[0, 0, 0, 0], 90], [[0, 0, 0, 255], 10])), true, '大片透明背景上的黑字')
  assert.equal(isDarkLogoPixels([]), false)
})
