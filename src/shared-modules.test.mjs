import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { bytes, pct, regionFlag, hasLeadingFlag, regionLabel, regionCountryLabel, averagePing, expiring, expired, remainingDays } from './server-format.ts'
import { serverHealth, averageLatency, percentage, resourcePercentage } from './server-health.ts'

test('公共格式化保留二进制流量、TB 精度、地区和百分比口径', () => {
  assert.equal(bytes(-1), '0 B')
  assert.equal(bytes(1024), '1 KB')
  assert.equal(bytes(1024 ** 2 * 1.25), '1.3 MB')
  assert.equal(bytes(1024 ** 4 * 1.125), '1.13 TB')
  assert.equal(bytes(1024 ** 4), '1 TB')
  assert.equal(bytes(1024 ** 2 * 1.25, false), '1 MB')
  assert.equal(pct(150, 100), 100)
  assert.equal(pct(10, 0), 0)
  assert.equal(regionFlag('hk · Hong Kong'), '🇭🇰')
  assert.equal(regionFlag(' 🇯🇵 '), '🇯🇵')
  assert.equal(regionFlag('Unknown'), '')
  assert.equal(hasLeadingFlag(' 🇭🇰 Node'), true)
  assert.equal(regionLabel({ region_city: 'Tokyo', region_name: 'Tokyo', region_country: 'JP' }), 'Tokyo · Tokyo')
  assert.equal(regionCountryLabel({ region_country: ' JP ' }), 'JP')
})

test('平均延迟保留缺失值与零值，健康评分使用原有取整口径', () => {
  assert.equal(averageLatency({ ping: [] }), undefined)
  const series = [
    { key: 'a', label: 'a', current_ms: 10.4, loss_pct: 0, buckets: [{ ms: 0, loss: 0 }, { ms: -1, loss: -1 }] },
    { key: 'b', label: 'b', current_ms: 20.4, loss_pct: 4, buckets: [{ ms: 20, loss: 2 }, { ms: -1, loss: -1 }] },
  ]
  const avg = averagePing(series)
  assert.ok(Math.abs(avg.current_ms - 15.4) < 1e-9)
  assert.equal(avg.loss_pct, 2)
  assert.deepEqual(avg.buckets, [{ ms: 10, loss: 1 }, { ms: -1, loss: -1 }])
  assert.equal(averageLatency({ ping: series }), 15)
  assert.equal(resourcePercentage(undefined, 100), undefined)
  assert.equal(resourcePercentage(0, 100), 0)
  assert.equal(percentage(-10, 100), 0)
  assert.equal(percentage(110, 100), 100)
})

test('健康评分保持离线、资源压力、延迟丢包与额度扣分边界', () => {
  assert.deepEqual(serverHealth({ online: false }), { score: 0, label: '异常', tone: 'critical', issues: ['服务器离线'] })
  assert.deepEqual(serverHealth({ online: true }), { score: 100, label: '卓越', tone: 'excellent', issues: [] })
  assert.equal(serverHealth({ online: true, cpu_pct: 75 }).score, 91)
  assert.equal(serverHealth({ online: true, cpu_pct: 90 }).score, 82)
  assert.equal(serverHealth({ online: true, mem_used: 90, mem_total: 100, disk_used: 75, disk_total: 100 }).score, 73)
  assert.equal(serverHealth({ online: true, ping: [{ current_ms: 120, loss_pct: 3 }] }).score, 83)
  assert.equal(serverHealth({ online: true, ping: [{ current_ms: 250, loss_pct: 10 }] }).score, 62)
  assert.equal(serverHealth({ online: true, traffic_used_total: 80, traffic_limit: 100 }).score, 93)
  assert.equal(serverHealth({ online: true, traffic_used: 95, traffic_used_total: 1, traffic_limit: 100 }).score, 84)
  assert.equal(serverHealth({ online: true, cpu_pct: 100, mem_used: 100, mem_total: 100, disk_used: 100, disk_total: 100, ping: [{ current_ms: 300, loss_pct: 100 }], traffic_used: 100, traffic_limit: 100 }).score, 0)
})

test('到期与剩余天数保留原时间边界，永久套餐不扣到期分', () => {
  const now = Date.now
  Date.now = () => new Date('2026-10-02T12:00:00').getTime()
  try {
    assert.equal(expired({ expires_at: '2026-10-01' }), true)
    assert.equal(expiring({ expires_at: '2026-10-12' }), true)
    assert.equal(expiring({}), false)
    assert.equal(remainingDays(), '')
    assert.equal(remainingDays('2026-10-03'), '剩余 2 天')
    assert.equal(serverHealth({ online: true, expires_at: '2026-10-01' }).score, 80)
    assert.equal(serverHealth({ online: true, expires_at: '2026-10-10' }).score, 92)
    assert.equal(serverHealth({ online: true, expires_at: '2026-10-01', renewal_cycle: 'permanent' }).score, 100)
  } finally { Date.now = now }
})

test('公共模块和主题不反向导入 App/Premium，静态依赖无环', () => {
  const root = path.dirname(fileURLToPath(import.meta.url))
  const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? entry.name === 'ran' ? [] : files(path.join(dir, entry.name))
    : /\.tsx?$/.test(entry.name) ? [path.join(dir, entry.name)] : [])
  const filesSet = new Set(files(root))
  const graph = new Map()
  for (const file of filesSet) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
    const deps = []
    for (const node of source.statements) {
      if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue
      const spec = node.moduleSpecifier?.text
      if (!spec?.startsWith('.')) continue
      const stem = path.resolve(path.dirname(file), spec)
      const target = [stem, stem + '.ts', stem + '.tsx'].find(candidate => filesSet.has(candidate))
      if (!target) continue
      if (path.basename(target) === 'App.tsx') assert.equal(path.basename(file), 'main.tsx', file)
      assert.notEqual(path.basename(target), 'PremiumProbePage.tsx', file)
      if (!node.importClause?.isTypeOnly) deps.push(target)
    }
    graph.set(file, deps)
  }
  function visit(file, trail = []) {
    assert.ok(!trail.includes(file), `静态依赖成环: ${[...trail, file].map(f => path.relative(root, f)).join(' → ')}`)
    if (done.has(file)) return
    for (const dep of graph.get(file) || []) visit(dep, [...trail, file])
    done.add(file)
  }
  const done = new Set()
  for (const file of graph.keys()) visit(file)
})

test('首屏静态依赖不含 recharts / lottie，图表与勋章动画按需加载', () => {
  const root = path.dirname(fileURLToPath(import.meta.url))
  const heavy = new Set(['recharts', 'lottie-react', 'lottie-web'])
  const seen = new Set()
  const offenders = []
  const visit = file => {
    if (seen.has(file)) return
    seen.add(file)
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
    for (const node of source.statements) {
      if (!ts.isImportDeclaration(node) || node.importClause?.isTypeOnly) continue
      const spec = node.moduleSpecifier.text
      if (heavy.has(spec)) offenders.push(`${path.relative(root, file)} → ${spec}`)
      if (!spec.startsWith('.')) continue
      const stem = path.resolve(path.dirname(file), spec)
      const target = [stem + '.ts', stem + '.tsx', stem].find(candidate => /\.tsx?$/.test(candidate) && readdirSync(path.dirname(candidate)).includes(path.basename(candidate)))
      if (target) visit(target)
    }
  }
  visit(path.join(root, 'main.tsx'))
  assert.deepEqual(offenders, [])
  assert.ok(seen.has(path.join(root, 'deferred.tsx')), '首屏应通过 deferred.tsx 引用图表')
})

test('后台超过 1 分钟断开实时连接，回到前台补帧并重连', () => {
  const source = readFileSync(new URL('./use-probe.ts', import.meta.url), 'utf8')
  assert.match(source, /const HIDDEN_PAUSE_MS = 60_000/)
  assert.match(source, /addEventListener\('visibilitychange', onVisibilityChange\)/)
  assert.match(source, /removeEventListener\('visibilitychange', onVisibilityChange\)/)
  assert.match(source, /if \(stopped \|\| paused \|\| timer\.current\) return/)
})

test('实时连接声明增量帧、断线按退避自动重连，主动断开不重连', () => {
  const source = readFileSync(new URL('./use-probe.ts', import.meta.url), 'utf8')
  assert.match(source, /\/api\/stream\?delta=1/)
  assert.match(source, /isProbeDeltaFrame\(frame\) \? applyProbeDelta\(frame, base\)/)
  assert.match(source, /const RECONNECT_DELAYS_MS = \[2_000, 5_000, 15_000, 30_000\]/)
  assert.match(source, /if \(wsRef\.current !== ws\) return \/\/ 主动断开/)
  const worker = readFileSync(new URL('../worker/index.ts', import.meta.url), 'utf8')
  assert.match(worker, /probe-hub\.internal\/stream\$\{incoming\.search\}/)
  assert.match(worker, /getTags\(client\)\.includes\(HUB_DELTA_TAG\)/)
})
