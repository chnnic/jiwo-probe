// 把回程勋章的 Lottie 动画预渲染成帧图：node scripts/route-badges/render.mjs
// 用无头 Chrome + lottie-web 的 SVG 渲染器逐帧截图（和原先页面里的渲染方式一致），再用 sharp 把所有帧
// 按行排进一张无损 WebP；页面用位移动画逐格切换（见 src/route-badge-motion.ts）。
// 源文件 src/assets/return-route/*.json 改了以后重新运行，把生成的 *.webp 和 sprite.json 一起提交。
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = fileURLToPath(new URL('../../', import.meta.url))
const assets = path.join(root, 'src/assets/return-route')
const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

// 勋章在页面上是 20px，手机宽度下 16px。按「显示尺寸 × 屏幕倍数」各出一份，每帧正好对上设备像素，
// 页面用 srcset 的宽度描述挑（见 src/components/ServerVisuals.tsx）
const VARIANTS = [[20, 1], [16, 2], [20, 2], [16, 3], [20, 3]]
const NAMES = ['common', 'premium']
// 输出帧率，默认用动画自己的帧率
const FPS = Number(process.env.FPS || 0)
// 帧图每行放几帧
const COLUMNS = 15
let manifest

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const profile = mkdtempSync(path.join(tmpdir(), 'jiwo-badges-'))
const proc = spawn(chrome, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=500,500',
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' })

try {
  const portFile = path.join(profile, 'DevToolsActivePort')
  for (let i = 0; i < 100 && !existsSync(portFile); i++) await sleep(100)
  const port = readFileSync(portFile, 'utf8').split('\n')[0]
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  const ws = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  let seq = 0
  const pending = new Map()
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id) }
  }
  const send = (method, params = {}) => new Promise((resolve) => { const id = ++seq; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })) })
  const evaluate = async (expression) => {
    const { result } = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result?.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 400))
    return result?.result?.value
  }

  await send('Page.enable')
  await send('Runtime.enable')
  // 透明底截图
  await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } })
  await evaluate(readFileSync(path.join(root, 'node_modules/lottie-web/build/player/lottie_svg.min.js'), 'utf8') + '\n;void 0')
  await evaluate(`document.documentElement.style.background = 'transparent'; document.body.style.cssText = 'margin:0;background:transparent'; void 0`)

  for (const name of NAMES) {
    const source = readFileSync(path.join(assets, `${name}.json`), 'utf8')
    const data = JSON.parse(source)
    const fps = FPS || data.fr
    const count = Math.round(((data.op - data.ip) / data.fr) * fps)
    for (const [size, scale] of VARIANTS) {
      await send('Emulation.setDeviceMetricsOverride', { width: 200, height: 200, deviceScaleFactor: scale, mobile: false })
      await evaluate(`(() => {
        window.__animation?.destroy()
        document.body.innerHTML = '<div id="badge" style="width:${size}px;height:${size}px"></div>'
        window.__animation = lottie.loadAnimation({ container: document.getElementById('badge'), renderer: 'svg', loop: false, autoplay: false, animationData: ${source} })
      })()`)
      const frames = []
      for (let index = 0; index < count; index++) {
        await evaluate(`window.__animation.goToAndStop(${(index * data.fr) / fps}, true); new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))`)
        const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: size, height: size, scale: 1 } })
        frames.push(Buffer.from(shot.result.data, 'base64'))
      }
      const rows = Math.ceil(count / COLUMNS)
      const side = size * scale
      const file = path.join(assets, `${name}-${side}.webp`)
      await sharp({ create: { width: COLUMNS * side, height: rows * side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite(frames.map((input, index) => ({ input, left: (index % COLUMNS) * side, top: Math.floor(index / COLUMNS) * side })))
        .webp({ lossless: true, effort: 6 })
        .toFile(file)
      const sheet = { columns: COLUMNS, rows, frames: count, fps }
      if (manifest && JSON.stringify(manifest) !== JSON.stringify(sheet)) throw new Error(`${name} 的帧数或帧率和其他动画不一致`)
      manifest = sheet
      console.log(`${path.relative(root, file)}  ${COLUMNS * side}×${rows * side}  ${count} 帧  ${fps} 帧/秒  ${(statSync(file).size / 1024).toFixed(1)} KB`)
    }
  }
  writeFileSync(path.join(assets, 'sprite.json'), JSON.stringify(manifest) + '\n')
  ws.close()
} finally {
  proc.kill()
  await sleep(300)
  rmSync(profile, { recursive: true, force: true })
}
