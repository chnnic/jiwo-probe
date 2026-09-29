import test from 'node:test'
import assert from 'node:assert/strict'
import { THEME_OPTIONS, pickerPosition, pickerNextIndex } from './theme-picker-model.ts'

test('picker exposes all 11 themes and automatic choice exactly once', () => {
  assert.equal(THEME_OPTIONS.length, 12)
  assert.equal(new Set(THEME_OPTIONS.map(option => option.value)).size, 12)
  assert.equal(THEME_OPTIONS[0].value, null)
  assert.ok(THEME_OPTIONS.some(option => option.value === 'ran'))
})
test('picker stays inside narrow and short viewports at either edge', () => {
  for (const width of [280, 320, 390, 1280]) for (const height of [240, 844]) {
    for (const right of [46, width - 8]) {
      const p = pickerPosition({top: 20, bottom: 56, right}, {width, height})
      assert.ok(p.left >= 8 && p.left + p.width <= width - 8)
      assert.ok(p.top >= 8 && p.top + Math.min(328, p.maxHeight) <= height - 8)
    }
  }
})
test('picker aligns right edge and flips above low triggers', () => {
  const p = pickerPosition({top: 500, bottom: 536, right: 900}, {width: 1000, height: 600}, 330)
  assert.equal(p.left + p.width, 900)
  assert.equal(p.top, 162)
})
test('two-column keyboard navigation wraps and supports Home and End', () => {
  assert.equal(pickerNextIndex(1, 'ArrowDown', 12), 3)
  assert.equal(pickerNextIndex(0, 'ArrowUp', 12), 10)
  assert.equal(pickerNextIndex(0, 'ArrowLeft', 12), 11)
  assert.equal(pickerNextIndex(11, 'ArrowRight', 12), 0)
  assert.equal(pickerNextIndex(5, 'Home', 12), 0)
  assert.equal(pickerNextIndex(5, 'End', 12), 11)
})
