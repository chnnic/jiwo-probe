import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { FLAG_FONT_NAME, flagFontCss, needsFlagFont } from './flag-font.ts'

test('只有 Windows 上的 Chrome / Edge 需要国旗字体', () => {
  assert.equal(needsFlagFont('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'), true)
  assert.equal(needsFlagFont('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0'), true)
  assert.equal(needsFlagFont('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0'), false, 'Firefox 自带 Twemoji Mozilla')
  assert.equal(needsFlagFont('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'), false)
  assert.equal(needsFlagFont('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'), false)
  assert.equal(needsFlagFont('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'), false)
})

test('国旗字体只接管国旗码位，字体文件随站点一起发布', () => {
  const css = flagFontCss()
  assert.match(css, /unicode-range:U\+1F1E6-1F1FF/)
  assert.match(css, /font-display:swap/)
  assert.ok(statSync(new URL('../public/fonts/TwemojiCountryFlags.woff2', import.meta.url)).size > 50_000)
})

test('各主题的字体栈都把国旗字体放在最前面', () => {
  const root = new URL('.', import.meta.url).pathname
  const files = []
  const walk = (dir) => { for (const name of readdirSync(dir)) { const full = join(dir, name); if (statSync(full).isDirectory()) walk(full); else if (name.endsWith('.css')) files.push(full) } }
  walk(root)
  const missing = []
  for (const file of files) {
    const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    for (const match of css.matchAll(/(font-family|--[\w-]*font[\w-]*)\s*:\s*([^;}]+)/g)) {
      const value = match[2].trim()
      // 继承、引用变量的不用管；@font-face 里声明自己名字的那一行只有一个字体名
      if (/^(inherit|var\()/.test(value) || !value.includes(',')) continue
      if (!value.startsWith(`"${FLAG_FONT_NAME}"`)) missing.push(`${file.slice(root.length)}: ${value.slice(0, 60)}`)
    }
  }
  assert.deepEqual(missing, [])
})
