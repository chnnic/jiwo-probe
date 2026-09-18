import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'

// 与 Wrangler 相同地打包 TS，测试公开端点，不需要连接主控或使用密钥。
const bundle = await build({ entryPoints: [new URL('./index.ts', import.meta.url).pathname], bundle: true, write: false, format: 'esm', platform: 'neutral' })
const { default: worker } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)

test('ping settings are available without a background and do not expose other env vars', async () => {
  const response = await worker.fetch(new Request('https://probe.test/api/theme-config'), {
    PROBE_PING_GROUP_COUNT: '3',
    PROBE_PING_DEFAULT_TARGETS: '平均延迟，内地延迟，海外延迟',
    PROBE_PING_INTL_TARGETS: 'Cloudflare，Google',
    PROBE_TOKEN: 'test-secret-not-public',
  }, {})
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { networkSpeedUnit: 'bits', pingGroups: { count: 3, defaultTargets: ['__avg__', '__avg_cn__', '__avg_intl__'], intlTargets: ['Cloudflare', 'Google'] } })
})

test('missing variables use the three script defaults, even with an invalid image URL', async () => {
  const response = await worker.fetch(new Request('https://probe.test/api/theme-config'), { PROBE_BACKGROUND_URL: 'invalid', PROBE_PING_GROUP_COUNT: '4' }, {})
  assert.deepEqual(await response.json(), { networkSpeedUnit: 'bits', pingGroups: { count: 3, defaultTargets: ['__avg__', '__avg_cn__', '__avg_intl__'], intlTargets: ['intl-web-cloudflare', 'intl-web-google', 'intl-tg-dc5'] } })
})

test('CF one-group override is respected without replacing its target or backup', async () => {
  const response = await worker.fetch(new Request('https://probe.test/api/theme-config'), {
    PROBE_PING_GROUP_COUNT: '1', PROBE_PING_DEFAULT_TARGETS: '上海电信', PROBE_PING_INTL_TARGETS: 'Google',
  }, {})
  assert.deepEqual(await response.json(), { networkSpeedUnit: 'bits', pingGroups: { count: 1, defaultTargets: ['上海电信'], intlTargets: ['Google'] } })
})

test('global speed config defaults to bits and normalizes bytes without exposing secrets', async () => {
  for (const [value, expected] of [[undefined, 'bits'], ['', 'bits'], ['wrong', 'bits'], ['bits', 'bits'], [' BITS ', 'bits'], ['bytes', 'bytes'], [' BYTES ', 'bytes']]) {
    const response = await worker.fetch(new Request('https://probe.test/api/theme-config'), {
      PROBE_NETWORK_SPEED_UNIT: value, PROBE_TOKEN: 'private-token', MMWX_ORIGIN: 'https://private.test',
    }, {})
    const body = await response.json()
    assert.equal(body.networkSpeedUnit, expected)
    assert.equal(JSON.stringify(body).includes('private'), false)
  }
})
