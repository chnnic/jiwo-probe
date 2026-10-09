import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { LUMINAPLUS_COLOR_KEY, LUMINAPLUS_MODE_KEY, LUMINAPLUS_PALETTE_KEY } from './luminaplus-color.ts'

const bundle = await build({ entryPoints: [new URL('../use-probe.ts', import.meta.url).pathname], bundle: true, write: false, platform: 'node', format: 'esm', define: { 'process.env.NODE_ENV': '"production"' } })
const { applyAppearance, followControllerLuminaPlusAppearance, getActiveTheme, setLuminaPlusAppearance, setTheme } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)

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
    // 配色与明暗各自独立：四种组合都能选出来
    for (const palette of ['classic', 'paper', 'mint']) {
      for (const mode of ['light', 'dark']) {
        setLuminaPlusAppearance({ palette, mode })
        applyAppearance({ theme: 'luminaplus-paper' })
        assert.equal(root.classList.contains('lp-paper'), palette === 'paper', `${palette}/${mode}`)
        assert.equal(root.classList.contains('lp-mint'), palette === 'mint', `${palette}/${mode}`)
        assert.equal(root.classList.contains('dark'), mode === 'dark', `${palette}/${mode}`)
        assert.equal(storage.get('mmwx-probe-dark-override'), 'dark', 'other themes retain their preference')
        assert.equal(storage.get(LUMINAPLUS_PALETTE_KEY), palette)
        assert.equal(storage.get(LUMINAPLUS_MODE_KEY), mode)
        assert.equal(storage.has(LUMINAPLUS_COLOR_KEY), false, '旧版合并值不再写入')
      }
    }
    // 自动：记成 auto，按北京时间决定是否挂 dark
    setLuminaPlusAppearance({ palette: 'mint', mode: 'auto' })
    applyAppearance({ theme: 'luminaplus-mint-light' })
    const hour = (new Date().getUTCHours() + 8) % 24
    assert.equal(storage.get(LUMINAPLUS_MODE_KEY), 'auto')
    assert.equal(root.classList.contains('dark'), !(hour >= 6 && hour < 18), '自动按北京时间，不跟主控固定的浅色')
    assert.equal(root.classList.contains('lp-mint'), true)
    setLuminaPlusAppearance({ palette: 'paper', mode: 'light' })
    for (const theme of ['pixel', 'flat', 'anime', 'glass', 'lumina', 'lite', 'premium', 'glassmorphism', 'emerald', 'ran']) {
      applyAppearance({ theme })
      assert.equal(root.classList.contains('lp-paper'), false, theme)
      assert.equal(root.classList.contains(`theme-${theme}`), true, theme)
      assert.equal(storage.get(LUMINAPLUS_PALETTE_KEY), 'paper')
    }
    applyAppearance({ theme: 'luminaplus' })
    assert.equal(root.classList.contains('lp-paper'), true, 'returning to LuminaPlus restores its palette')

    followControllerLuminaPlusAppearance()
    assert.equal(storage.has(LUMINAPLUS_PALETTE_KEY), false)
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

    // Mint 切到其他主题时摘掉；主控组合名决定配色与明暗
    setLuminaPlusAppearance({ palette: 'mint', mode: 'dark' })
    applyAppearance({ theme: 'lumina' })
    assert.equal(root.classList.contains('lp-mint'), false)
    followControllerLuminaPlusAppearance()
    applyAppearance({ theme: 'luminaplus-paper-dark' })
    assert.equal(root.classList.contains('lp-paper'), true)
    assert.equal(root.classList.contains('dark'), true, 'Paper Night')
    applyAppearance({ theme: 'luminaplus-mint-light' })
    assert.equal(root.classList.contains('lp-mint'), true)
    assert.equal(root.classList.contains('dark'), false)
    applyAppearance({ theme: 'luminaplus-mint-dark' })
    assert.equal(root.classList.contains('dark'), true)
  } finally {
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument
    if (previousStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = previousStorage
  }
})
