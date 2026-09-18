import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_NETWORK_SPEED_UNIT, formatNetworkSpeed, parseNetworkSpeedUnit } from './network-speed.ts'

test('bits is the install / frontend fallback; bytes accepts case and whitespace', () => {
  assert.equal(DEFAULT_NETWORK_SPEED_UNIT, 'bits')
  for (const value of [undefined, null, {}, 42, '', 'invalid', 'Bits', ' BITS ']) assert.equal(parseNetworkSpeedUnit(value), 'bits')
  for (const value of ['bytes', ' Bytes ', 'BYTES']) assert.equal(parseNetworkSpeedUnit(value), 'bytes')
})

test('API bytes/s converts once to decimal bits/s; bytes uses the existing 1024 scale', () => {
  assert.equal(formatNetworkSpeed(125), '1 Kbps')
  assert.equal(formatNetworkSpeed(125_000), '1 Mbps')
  assert.equal(formatNetworkSpeed(125_000_000), '1 Gbps')
  assert.equal(formatNetworkSpeed(125_000_000_000), '1 Tbps')
  assert.equal(formatNetworkSpeed(1_048_576), '8.39 Mbps')
  assert.equal(formatNetworkSpeed(1_048_576, 'bytes'), '1 MB/s')
  assert.equal(formatNetworkSpeed(1024, 'bytes'), '1 KB/s')
  assert.equal(formatNetworkSpeed(1024 ** 3, 'bytes'), '1 GB/s')
  assert.equal(formatNetworkSpeed(1024 ** 4, 'bytes'), '1 TB/s')
  assert.equal(formatNetworkSpeed(1, 'bytes'), '1 B/s')
  assert.equal(formatNetworkSpeed(1), '8 bps')
})

test('zero, absent, negative and non-finite samples never produce invalid text', () => {
  for (const value of [0, undefined, -1, NaN, Infinity, -Infinity]) {
    assert.equal(formatNetworkSpeed(value), '0 bps')
    assert.equal(formatNetworkSpeed(value, 'bytes'), '0 B/s')
  }
  for (const unit of ['bits', 'bytes']) {
    assert.doesNotMatch(formatNetworkSpeed(Number.MAX_VALUE, unit), /NaN|Infinity/)
  }
})

test('rounding at a unit boundary promotes to the next unit', () => {
  assert.equal(formatNetworkSpeed(124_999), '1 Mbps')
  assert.equal(formatNetworkSpeed(1024 ** 2 - 1, 'bytes'), '1 MB/s')
  assert.equal(formatNetworkSpeed(1250), '10 Kbps')
  assert.equal(formatNetworkSpeed(12500), '100 Kbps')
})
