import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

// 部署后核对：线上 index.html 引用的 main-*.js 必须与本地 dist/index.html 一致。
// 只在设置了 PROBE_VERIFY_URL 时由 deploy.sh 调用；Cloudflare 网页构建不受影响。

export function mainAssetOf(html) {
  return html.match(/\/assets\/main-[\w-]+\.js/)?.[0] ?? null
}

export async function waitForAsset(url, expected, { fetchImpl = fetch, timeoutMs = 90_000, intervalMs = 5_000, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  const deadline = Date.now() + timeoutMs
  let seen = null
  for (;;) {
    try {
      const target = new URL(url)
      // 加随机参数绕过边缘缓存，拿到的一定是当前版本的 index.html。
      target.searchParams.set('_verify', String(Date.now()))
      const response = await fetchImpl(target, { cache: 'no-store' })
      if (response.ok) seen = mainAssetOf(await response.text())
    } catch {
      // 网络抖动时继续重试，直到超时。
    }
    if (seen === expected) return { ok: true, seen }
    if (Date.now() + intervalMs > deadline) return { ok: false, seen }
    await sleep(intervalMs)
  }
}

async function main() {
  const url = process.env.PROBE_VERIFY_URL
  if (!url) return
  const expected = mainAssetOf(readFileSync(fileURLToPath(new URL('../dist/index.html', import.meta.url)), 'utf8'))
  if (!expected) throw new Error('本地 dist/index.html 里找不到 main-*.js，无法核对。')
  console.log(`正在核对线上版本：${url}（期望 ${expected}）`)
  const result = await waitForAsset(url, expected)
  if (!result.ok) throw new Error(`线上仍是 ${result.seen ?? '未知版本'}，与本地 ${expected} 不一致。请稍后手动再查。`)
  console.log(`线上已更新到 ${expected}。`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
}
