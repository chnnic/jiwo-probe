import test from 'node:test'
import assert from 'node:assert/strict'
import { canonicalThemeOverride, isBuiltinTheme, parseThemeName } from './theme-name.ts'

const themeNames = [
  'pixel', 'flat', 'anime', 'glass', 'lumina', 'luminaplus', 'premium',
  'ran', 'glassmorphism', 'emerald', 'lite',
  'ran-night', 'ran-mist', 'ran-ember', 'ran-sakura', 'ran-lavender',
  'ran-tomcat', 'ran-teal', 'ran-midnight', 'ran-mint', 'ran-butter', 'ran-ji',
]
const mixedCase = name => [...name].map((letter, index) => index % 2 ? letter.toUpperCase() : letter).join('')

test('all built-in themes and Ran variants ignore case in controller names and saved selections', () => {
  for (const name of themeNames) {
    for (const input of [name, name.toUpperCase(), mixedCase(name), ` ${name.toUpperCase()} `]) {
      assert.equal(parseThemeName(input).theme, name, input)
      assert.equal(isBuiltinTheme(input), true, input)
      assert.equal(canonicalThemeOverride(input), name, input)
    }
  }
  assert.equal(canonicalThemeOverride(' MINI '), 'lite')
})

test('all existing color suffixes and legacy aliases ignore case without losing their modes', () => {
  for (const name of ['lumina-gold', 'lumina-platinum', 'premium-platinum', 'premium-light',
    'luminaplus-light', 'luminaplus-dark', 'glassmorphism-light', 'glassmorphism-dark',
    'lite-light', 'lite-dark', 'mini-light', 'mini-dark']) {
    const expected = parseThemeName(name)
    for (const input of [name.toUpperCase(), mixedCase(name), ` ${name.toUpperCase().replaceAll('-', '_')} `]) {
      assert.deepEqual(parseThemeName(input), expected, input)
    }
  }
  for (const name of ['My-Custom', 'ran-CUSTOM']) {
    assert.equal(parseThemeName(name).theme, name)
    assert.equal(canonicalThemeOverride(name), name)
    assert.equal(isBuiltinTheme(name), false)
  }
  assert.equal(isBuiltinTheme(undefined), false)
})

test('LuminaPlus is independent from Lumina and supports explicit light/dark', () => {
  for (const name of ['luminaplus', 'LuminaPlus', 'Lumina Plus']) assert.deepEqual(parseThemeName(name), { theme: 'luminaplus', gold: false, platinum: false })
  assert.deepEqual(parseThemeName('luminaplus-light'), { theme: 'luminaplus', gold: false, platinum: false, light: true })
  assert.deepEqual(parseThemeName('LuminaPlus_Dark'), { theme: 'luminaplus', gold: false, platinum: false, light: false })
  assert.equal(isBuiltinTheme('luminaplus'), true)
  assert.equal(parseThemeName('lumina').theme, 'lumina')
  assert.equal(parseThemeName('lumina-gold').gold, true)
})

test('luminaplus-paper is a palette of LuminaPlus, with case-insensitive controller and saved names', () => {
  const expected = { theme: 'luminaplus', gold: false, platinum: false, light: true, paper: true }
  for (const input of ['luminaplus-paper', 'LUMINAPLUS-PAPER', 'LuminaPlus_Paper', ' Lumina Plus Paper ']) {
    assert.deepEqual(parseThemeName(input), expected)
    assert.equal(isBuiltinTheme(input), true)
    assert.equal(canonicalThemeOverride(input), 'luminaplus-paper')
  }
  assert.equal(parseThemeName('lumina-paper').paper, undefined)
  assert.deepEqual(parseThemeName('luminaplus-paper-dark'), { theme: 'luminaplus', gold: false, platinum: false, light: false, paper: true })
  assert.equal(canonicalThemeOverride('LuminaPlus Paper Light'), 'luminaplus-paper-light')
  assert.equal(parseThemeName('luminaplus').paper, undefined)
})

test('luminaplus-mint 及 -light / -dark 是 LuminaPlus 的配色，名称不分大小写', () => {
  const cases = [
    ['luminaplus-mint', 'luminaplus-mint', { mint: true }],
    ['LuminaPlus_Mint', 'luminaplus-mint', { mint: true }],
    ['luminaplus-mint-light', 'luminaplus-mint-light', { light: true, mint: true }],
    [' Lumina Plus Mint Dark ', 'luminaplus-mint-dark', { light: false, mint: true }],
  ]
  for (const [input, canonical, flags] of cases) {
    assert.deepEqual(parseThemeName(input), { theme: 'luminaplus', gold: false, platinum: false, ...flags })
    assert.equal(isBuiltinTheme(input), true)
    assert.equal(canonicalThemeOverride(input), canonical)
  }
  assert.equal(parseThemeName('lumina-mint').mint, undefined)
  assert.equal(parseThemeName('ran-mint').theme, 'ran-mint', 'Ran 的 mint 变体不受影响')
})

test('Lite supports automatic, light and dark master names', () => {
  for (const name of ['lite', 'Lite', ' LITE ']) assert.deepEqual(parseThemeName(name), { theme: 'lite', gold: false, platinum: false })
  for (const name of ['lite-light', 'Lite Light', 'LITE_LIGHT']) assert.equal(parseThemeName(name).light, true)
  for (const name of ['lite-dark', 'Lite Dark', 'LITE_DARK']) assert.equal(parseThemeName(name).light, false)
  assert.equal(isBuiltinTheme('lite'), true)
})
test('old Mini master names and saved selections resolve to Lite', () => {
  for (const suffix of ['', '-light', '-dark']) assert.deepEqual(parseThemeName(`mini${suffix}`), parseThemeName(`lite${suffix}`))
  assert.equal(canonicalThemeOverride('mini'), 'lite')
  assert.equal(canonicalThemeOverride('lite'), 'lite')
  assert.equal(canonicalThemeOverride(null), null)
})
test('other themes and custom theme names remain unchanged', () => {
  assert.deepEqual(parseThemeName('Lumina-Gold'), { theme: 'lumina', gold: true, platinum: false })
  assert.deepEqual(parseThemeName('Premium Light'), { theme: 'premium', gold: false, platinum: true })
  assert.equal(parseThemeName('glassmorphism-dark').light, false)
  assert.equal(parseThemeName('My-Custom').theme, 'My-Custom')
  assert.equal(canonicalThemeOverride('lumina'), 'lumina')
})
