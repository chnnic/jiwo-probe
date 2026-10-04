// 用虚拟数据为 README 生成各主题截图：npm run build && node scripts/screenshots/capture.mjs [主题名…]
// 同一端口提供 dist 静态文件和虚拟 /api/probe（不连主控），无头 Chrome 每张图用全新用户目录，
// 不受本机 localStorage 里记住的主题影响。输出到 docs/screenshots/。
import { execFile } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import http from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { buildDemoPayload } from './demo-data.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const dist = path.join(root, 'dist')
const out = path.join(root, 'docs/screenshots')
const run = promisify(execFile)
// 无头 Chrome 的窗口宽度下限，更窄的视口改用 iframe 方案
const MIN_WINDOW_WIDTH = 500
const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

// [文件名, 主控下发的主题名, 明暗, 视口宽, 视口高]
// 不带明暗后缀的主题默认按北京时间自动切换；这里固定写入访客明暗设置，任何时候生成的截图都一致。
const SHOTS = [
  ['luminaplus-light', 'luminaplus-light', null, 1440, 1000],
  ['luminaplus-dark', 'luminaplus-dark', null, 1440, 1000],
  ['luminaplus-paper', 'luminaplus-paper', null, 1440, 1000],
  ['premium', 'premium', 'dark', 1440, 1000],
  ['premium-platinum', 'premium-platinum', null, 1440, 1000],
  ['lumina', 'lumina', 'dark', 1440, 1000],
  ['glassmorphism', 'glassmorphism-dark', null, 1440, 1000],
  ['emerald', 'emerald', 'dark', 1440, 1000],
  ['lite', 'lite-light', null, 1440, 1000],
  ['ran', 'ran', null, 1440, 1000],
  ['flat', 'flat', 'light', 1440, 1000],
  ['mobile-luminaplus', 'luminaplus-paper', null, 390, 844],
]

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.jpg': 'image/jpeg' }

let theme = 'luminaplus'
let colorMode = null
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')
  if (url.pathname === '/api/probe') {
    res.setHeader('content-type', 'application/json')
    return res.end(JSON.stringify(buildDemoPayload({ theme })))
  }
  if (url.pathname.startsWith('/api/')) {
    res.statusCode = url.pathname === '/api/theme-config' ? 200 : 404
    res.setHeader('content-type', 'application/json')
    return res.end('{}')
  }
  if (url.pathname === '/__frame') {
    // 手机截图：无头 Chrome 窗口最窄 500px，页面会按 500 宽排版；改用固定宽度 iframe 让页面按真实手机宽度布局，
    // 截图后再从中间裁出 iframe 那一块。
    const w = Number(url.searchParams.get('w')), h = Number(url.searchParams.get('h'))
    res.setHeader('content-type', TYPES['.html'])
    return res.end(`<!doctype html><body style="margin:0;display:flex;justify-content:center;background:#000"><iframe src="/" style="border:0;width:${w}px;height:${h}px"></iframe></body>`)
  }
  let file = path.join(dist, decodeURIComponent(url.pathname))
  if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) file = path.join(dist, 'index.html')
  res.setHeader('content-type', TYPES[path.extname(file)] || 'application/octet-stream')
  if (path.basename(file) !== 'index.html') return res.end(readFileSync(file))
  // 在应用脚本之前写入访客设置：明暗（与页面里手动切换写同一个键），并跳过 Ran 每会话一次的访客信息浮卡
  const preset = [
    colorMode ? `localStorage.setItem('mmwx-probe-dark-override', ${JSON.stringify(colorMode)})` : '',
    // Premium 有自己的三态配色（auto 跟随北京时间），需单独固定
    colorMode && theme.startsWith('premium') ? `localStorage.setItem('premium-probe-color-mode', ${JSON.stringify(colorMode)})` : '',
    "sessionStorage.setItem('ran.visitor_alert_shown', '1')",
  ].filter(Boolean).join(';')
  res.end(readFileSync(file, 'utf8').replace('<head>', `<head><script>${preset}</script>`))
})

if (!existsSync(path.join(dist, 'index.html'))) throw new Error('缺少 dist/，请先运行 npm run build')
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const { port } = server.address()
const only = new Set(process.argv.slice(2))

try {
  for (const [name, shotTheme, shotMode, width, height] of SHOTS) {
    if (only.size && !only.has(name)) continue
    theme = shotTheme
    colorMode = shotMode
    const profile = mkdtempSync(path.join(tmpdir(), 'jiwo-shot-'))
    const target = path.join(out, `${name}.png`)
    const narrow = width < MIN_WINDOW_WIDTH
    const page = narrow ? `http://127.0.0.1:${port}/__frame?w=${width}&h=${height}` : `http://127.0.0.1:${port}/`
    try {
      // 必须异步：同步等待会卡住同进程里的本地服务器，Chrome 永远拿不到页面
      await run(chrome, [
        '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
        // 减少动态效果：许可证铭牌等动画显示静态终态，截图不会截在动画中间
        '--force-prefers-reduced-motion',
        `--user-data-dir=${profile}`, `--window-size=${Math.max(width, MIN_WINDOW_WIDTH)},${height}`, '--force-device-scale-factor=1',
        '--virtual-time-budget=12000', `--screenshot=${target}`, page,
      ], { timeout: 90_000 })
      if (narrow) await run('sips', ['-c', String(height), String(width), target], { timeout: 30_000 })
      console.log(`✓ ${name}.png (${Math.round(statSync(target).size / 1024)} KB)`)
    } finally {
      rmSync(profile, { recursive: true, force: true })
    }
  }
} finally {
  server.close()
}
