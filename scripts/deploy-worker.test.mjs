import assert from 'node:assert/strict'
import test from 'node:test'
import { deployArgs, missingPingVars, readExistingBindings, readScriptDefaults } from './deploy-worker.mjs'

const defaults = {
  PROBE_PING_GROUP_COUNT: '3',
  PROBE_PING_DEFAULT_TARGETS: '平均延迟，内地延迟，海外延迟',
  PROBE_PING_INTL_TARGETS: 'intl-web-cloudflare,intl-web-google,intl-tg-dc5',
  PROBE_NETWORK_SPEED_UNIT: 'bits',
}
const current = bindings => args => args[0] === 'deployments'
  ? { versions: [{ version_id: 'active' }] }
  : { resources: { bindings } }

test('installer reads shared ping and speed defaults and creates actual Text bindings', async () => {
  assert.deepEqual(await readScriptDefaults(), defaults)
  assert.deepEqual(deployArgs(defaults), ['deploy', '--keep-vars',
    '--var', 'PROBE_PING_GROUP_COUNT:3',
    '--var', 'PROBE_PING_DEFAULT_TARGETS:平均延迟，内地延迟，海外延迟',
    '--var', 'PROBE_PING_INTL_TARGETS:intl-web-cloudflare,intl-web-google,intl-tg-dc5',
    '--var', 'PROBE_NETWORK_SPEED_UNIT:bits',
  ])
})

test('existing Worker gets missing defaults without copying unrelated bindings', () => {
  const bindings = readExistingBindings(current([
    { name: 'PROBE_TOKEN', type: 'secret_text' },
    { name: 'PROBE_BACKGROUND_URL', type: 'plain_text', text: 'https://example.test/image.jpg' },
  ]))
  assert.deepEqual(missingPingVars(defaults, bindings), defaults)
  assert.ok(!deployArgs(missingPingVars(defaults, bindings)).join(' ').includes('PROBE_TOKEN'))
})

test('custom count, Chinese target values, empty values and secret-typed overrides are never reset', () => {
  const bindings = readExistingBindings(current([
    { name: 'PROBE_PING_GROUP_COUNT', type: 'plain_text', text: '2' },
    { name: 'PROBE_PING_DEFAULT_TARGETS', type: 'plain_text', text: '上海电信，海外延迟' },
    { name: 'PROBE_PING_INTL_TARGETS', type: 'secret_text' },
    { name: 'PROBE_NETWORK_SPEED_UNIT', type: 'plain_text', text: 'bytes' },
  ]))
  assert.deepEqual(deployArgs(missingPingVars(defaults, bindings)), ['deploy', '--keep-vars'])
  const partial = missingPingVars(defaults, [{ name: 'PROBE_PING_GROUP_COUNT', type: 'plain_text', text: '' }])
  assert.deepEqual(Object.keys(partial), ['PROBE_PING_DEFAULT_TARGETS', 'PROBE_PING_INTL_TARGETS', 'PROBE_NETWORK_SPEED_UNIT'])
})

test('only a confirmed nonexistent Worker can use first-install defaults', () => {
  assert.deepEqual(readExistingBindings(() => { throw Object.assign(new Error(), { cfCode: 10007 }) }), [])
  for (const error of [Object.assign(new Error('auth'), { cfCode: 10000 }), new Error('timeout'), new SyntaxError('invalid json')]) {
    assert.throws(() => readExistingBindings(() => { throw error }), error)
  }
})

test('an uploaded but undeployed Worker preserves the newest version bindings', () => {
  const calls = []
  const bindings = readExistingBindings(args => {
    calls.push(args)
    if (args[0] === 'deployments') throw Object.assign(new Error(), { noDeployments: true })
    if (args[1] === 'list') return [
      { id: 'old', metadata: { created_on: '2026-09-01T00:00:00Z' } },
      { id: 'new', metadata: { created_on: '2026-09-02T00:00:00Z' } },
    ]
    return { resources: { bindings: [{ name: 'PROBE_PING_GROUP_COUNT', type: 'plain_text', text: '1' }] } }
  })
  assert.deepEqual(calls.at(-1), ['versions', 'view', 'new'])
  assert.equal(Object.hasOwn(missingPingVars(defaults, bindings), 'PROBE_PING_GROUP_COUNT'), false)
})

test('gradual deployments preserve names present in either active version', () => {
  const bindings = readExistingBindings(args => {
    if (args[0] === 'deployments') return { versions: [{ version_id: 'a' }, { version_id: 'b' }] }
    return { resources: { bindings: [{ name: args[2] === 'a' ? 'PROBE_PING_GROUP_COUNT' : 'PROBE_PING_DEFAULT_TARGETS' }] } }
  })
  assert.deepEqual(missingPingVars(defaults, bindings), { PROBE_PING_INTL_TARGETS: defaults.PROBE_PING_INTL_TARGETS, PROBE_NETWORK_SPEED_UNIT: 'bits' })
})

test('malformed deployment or binding data aborts instead of restoring defaults', () => {
  for (const response of [{}, { versions: [] }, { versions: [{}] }]) {
    assert.throws(() => readExistingBindings(() => response))
  }
  for (const bindings of [undefined, {}, [{ type: 'plain_text' }]]) {
    assert.throws(() => readExistingBindings(current(bindings)))
  }
})
