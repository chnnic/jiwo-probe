import assert from 'node:assert/strict'
import test from 'node:test'
import { SETUP_PLACEHOLDER, missingSetupVars, setupErrorMessage } from './probe-setup.ts'

const token = 'real-token'
const origin = 'https://panel.example.com'

test('两项都填好时不提示', () => {
  assert.deepEqual(missingSetupVars({ MMWX_ORIGIN: origin, PROBE_TOKEN: token }), [])
  assert.deepEqual(missingSetupVars({ MMWX_ORIGIN: 'http://localhost:8080', PROBE_TOKEN: token }), [])
})

test('占位值、空值和没创建的变量都算没填', () => {
  assert.deepEqual(missingSetupVars({ MMWX_ORIGIN: SETUP_PLACEHOLDER, PROBE_TOKEN: SETUP_PLACEHOLDER }), ['MMWX_ORIGIN', 'PROBE_TOKEN'])
  assert.deepEqual(missingSetupVars({}), ['MMWX_ORIGIN', 'PROBE_TOKEN'])
  assert.deepEqual(missingSetupVars({ MMWX_ORIGIN: '  ', PROBE_TOKEN: '' }), ['MMWX_ORIGIN', 'PROBE_TOKEN'])
  assert.deepEqual(missingSetupVars({ MMWX_ORIGIN: origin, PROBE_TOKEN: ` ${SETUP_PLACEHOLDER} ` }), ['PROBE_TOKEN'])
})

test('主控地址缺协议或不是 HTTPS 时提示地址', () => {
  for (const value of ['panel.example.com', 'http://panel.example.com']) {
    assert.deepEqual(missingSetupVars({ MMWX_ORIGIN: value, PROBE_TOKEN: token }), ['MMWX_ORIGIN'])
  }
})

test('提示文案列出设置项名称', () => {
  assert.match(setupErrorMessage('MMWX_ORIGIN,PROBE_TOKEN'), /MMWX_ORIGIN、PROBE_TOKEN/)
})
