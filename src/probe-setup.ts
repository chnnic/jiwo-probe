// 全新安装时预建的占位值；Worker 看到它就当作还没填写，不会去连主控
export const SETUP_PLACEHOLDER = '待填写'
export const SETUP_ERROR_HEADER = 'X-Probe-Setup'

const filled = (value: string | undefined): value is string => {
  const text = value?.trim()
  return !!text && text !== SETUP_PLACEHOLDER
}

function validOrigin(value: string): boolean {
  try {
    const { protocol, hostname } = new URL(value)
    return protocol === 'https:' || hostname === '127.0.0.1' || hostname === 'localhost'
  } catch {
    return false
  }
}

/** 返回还没填好的设置项名称；地址格式不对也算没填好。 */
export function missingSetupVars(env: { MMWX_ORIGIN?: string, PROBE_TOKEN?: string }): string[] {
  const missing: string[] = []
  if (!filled(env.MMWX_ORIGIN) || !validOrigin(env.MMWX_ORIGIN)) missing.push('MMWX_ORIGIN')
  if (!filled(env.PROBE_TOKEN)) missing.push('PROBE_TOKEN')
  return missing
}

export function setupErrorMessage(names: string): string {
  const list = names.split(',').join('、')
  return `还没填好 ${list}，请到 Cloudflare Worker 的「设置 → 变量和密钥」修改后重新部署（主控地址须以 https:// 开头）`
}
