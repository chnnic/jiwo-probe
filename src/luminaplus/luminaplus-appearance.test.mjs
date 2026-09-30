import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { LUMINAPLUS_COLOR_KEY } from './luminaplus-color.ts'

const bundle = await build({ entryPoints: [new URL('../use-probe.ts', import.meta.url).pathname], bundle: true, write: false, platform: 'node', format: 'esm', define: { 'process.env.NODE_ENV': '"production"' } })
const { applyAppearance, getActiveTheme, setLuminaPlusColorMode, setTheme } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)

test('appearance applies Paper idempotently, persists manual palettes and removes its class on other themes', () => {
  const previousDocument = globalThis.document, previousStorage = globalThis.localStorage
  const storage = new Map([['mmwx-probe-dark-override', 'dark']])
  class Classes extends Set {
    contains(value) { return this.has(value) }
    remove(value) { this.delete(value) }
    toggle(value, force) { if (force) this.add(value); else this.delete(value) }
  }
  const root = { classList: new Classes(), style: { removeProperty() {}, setProperty() {} }, dataset: {} }
  globalThis.document = { documentElement: root, body: { removeAttribute() {} } }
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) }
  try {
    for (let frame = 0; frame < 3; frame++) {
      applyAppearance({ theme: 'LUMINAPLUS-PAPER' })
      assert.deepEqual([...root.classList].sort(), ['lp-paper', 'theme-luminaplus'])
      assert.equal(getActiveTheme(), 'luminaplus')
    }
    for (const mode of ['light', 'dark', 'paper']) {
      setLuminaPlusColorMode(mode)
      applyAppearance({ theme: 'luminaplus-paper' })
      assert.equal(root.classList.contains('lp-paper'), mode === 'paper')
      assert.equal(root.classList.contains('dark'), mode === 'dark')
      assert.equal(storage.get('mmwx-probe-dark-override'), 'dark', 'other themes retain their preference')
      assert.equal(storage.get(LUMINAPLUS_COLOR_KEY), mode)
    }
    for (const theme of ['pixel', 'flat', 'anime', 'glass', 'lumina', 'lite', 'premium', 'glassmorphism', 'emerald', 'ran']) {
      applyAppearance({ theme })
      assert.equal(root.classList.contains('lp-paper'), false, theme)
      assert.equal(root.classList.contains(`theme-${theme}`), true, theme)
      assert.equal(storage.get(LUMINAPLUS_COLOR_KEY), 'paper')
    }
    applyAppearance({ theme: 'luminaplus' })
    assert.equal(root.classList.contains('lp-paper'), true, 'returning to LuminaPlus restores its palette')

    setLuminaPlusColorMode('auto')
    applyAppearance({ theme: 'luminaplus-light' })
    assert.equal(root.classList.contains('dark'), false, 'follow-controller ignores legacy global dark')
    assert.equal(root.classList.contains('lp-paper'), false)
    applyAppearance({ theme: 'luminaplus-paper' })
    assert.equal(root.classList.contains('lp-paper'), true)
    setTheme('LuminaPlus_Paper')
    assert.equal(getActiveTheme(), 'luminaplus', 'saved aliases still render the LuminaPlus app')
    assert.equal(root.classList.contains('lp-paper'), true)
    setTheme(null)
    assert.equal(root.classList.contains('lp-paper'), true)
  } finally {
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument
    if (previousStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = previousStorage
  }
})
