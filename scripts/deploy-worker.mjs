import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../', import.meta.url))
const wrangler = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url))

// 只读取 Wrangler 的结构化结果；不打印完整绑定、主控地址或认证信息。
export function readWranglerJson(args) {
  let output
  try {
    output = execFileSync(process.execPath, [wrangler, ...args, '--json'], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000,
    })
  } catch (cause) {
    const message = `${cause.stdout || ''}\n${cause.stderr || ''}`
    const code = Number(message.match(/\[code:\s*(\d+)\]/)?.[1]) || undefined
    const error = new Error(`无法读取 CF 配置${code ? `（错误码 ${code}）` : ''}，已停止部署。请检查 Wrangler 登录、权限或网络后重试。`)
    error.cfCode = code
    error.noDeployments = /The Worker [^\r\n]+ has no deployments\./.test(message)
    throw error
  }
  // 非 JSON / 不完整响应不能当作“未设置”，避免重置线上配置。
  return JSON.parse(output)
}

export async function readScriptDefaults() {
  // 与前端 / Worker 使用同一份默认值，避免部署脚本另存一套而发生偏差。
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL('../src/runtime-defaults.ts', import.meta.url))],
    bundle: true, write: false, format: 'esm', platform: 'node',
  })
  const module = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
  return Object.fromEntries(Object.entries(module.RUNTIME_SCRIPT_VARS).map(([name, value]) => [name, String(value)]))
}

export function readExistingBindings(readJson = readWranglerJson) {
  let ids
  try {
    const deployment = readJson(['deployments', 'status'])
    if (!Array.isArray(deployment?.versions) || !deployment.versions.length) throw new Error('当前部署版本数据不完整，已停止部署。')
    ids = deployment.versions.map(version => version.version_id)
  } catch (error) {
    // 仅明确的“Worker 不存在”才视为首次安装，鉴权 / 网络错误不能跳过。
    if (error.cfCode === 10007) return []
    if (!error.noDeployments) throw error
    // 已上传但尚未上线的 Worker 也可能已有配置，不能直接按全新安装处理。
    const versions = readJson(['versions', 'list'])
    if (!Array.isArray(versions)) throw new Error('Worker 版本列表不完整，已停止部署。')
    if (!versions.length) return []
    if (versions.some(version => !Number.isFinite(Date.parse(version?.metadata?.created_on)))) {
      throw new Error('Worker 版本时间信息不完整，已停止部署。')
    }
    ids = [[...versions].sort((a, b) => Date.parse(b.metadata.created_on) - Date.parse(a.metadata.created_on))[0].id]
  }
  if (ids.some(id => typeof id !== 'string' || !id)) throw new Error('Worker 版本 ID 不完整，已停止部署。')
  return [...new Set(ids)].flatMap(id => {
    const bindings = readJson(['versions', 'view', id])?.resources?.bindings
    if (!Array.isArray(bindings) || bindings.some(binding => typeof binding?.name !== 'string' || !binding.name)) {
      throw new Error('Worker 绑定信息不完整，已停止部署。')
    }
    return bindings
  })
}

export function missingPingVars(defaults, bindings) {
  const names = new Set(bindings.map(binding => binding.name))
  // 即使值为空、类型不同，也保留站长已有设置；只新增缺失的变量名。
  return Object.fromEntries(Object.entries(defaults).filter(([name]) => !names.has(name)))
}

export function deployArgs(missing) {
  return ['deploy', '--keep-vars', ...Object.entries(missing).flatMap(([name, value]) => ['--var', `${name}:${value}`])]
}

async function main() {
  const defaults = await readScriptDefaults()
  const missing = missingPingVars(defaults, readExistingBindings())
  const names = Object.keys(missing)
  console.log(names.length
    ? `将自动创建 CF 设置项：${names.join('、')}；已有设置保持不变。`
    : 'CF 设置项已存在，将保留后台当前值。')
  if (process.argv.includes('--check')) return
  execFileSync(process.execPath, [wrangler, ...deployArgs(missing)], { cwd: root, stdio: 'inherit' })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
}
