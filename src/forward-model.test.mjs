import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chainStatus, chainTraffic, formatGb, forwardSummary, hopTone, latencyTone, sortChains } from './forward-model.ts'

const server = (name, healthy, to_next_ms = 5) => ({ name, healthy, to_next_ms })
const chain = (name, { e2e = 20, loss = 0, entry = [true, true], mid, exitHealthy = false, trend = [{ ts: 1, e2e_ms: 20, loss: 0 }], traffic = null } = {}) => ({
  name, end_to_end_ms: e2e, loss_pct: loss, bucket_sec: 300, trend, traffic,
  groups: [
    { name: '入口', role: 'entry', to_next_ms: e2e, servers: entry.map((h, i) => server(`e${i}`, h)) },
    ...(mid ? [{ name: '中转', role: 'mid', to_next_ms: 10, servers: mid.map((h, i) => server(`m${i}`, h)) }] : []),
    { name: '出口', role: 'exit', to_next_ms: 0, servers: [server('x', exitHealthy, 0)] },
  ],
})

test('出口组 healthy 恒为 false 不算异常；延迟阈值与上游 Premium 一致', () => {
  assert.equal(chainStatus(chain('a')).status, 'ok')
  assert.deepEqual(['idle', 'good', 'ok', 'hi'], [0, 79, 159, 160].map(latencyTone))
  assert.equal(latencyTone(undefined), 'idle')
})

test('部分探测异常、延迟偏高、丢包偏高为偏慢，并给出原因', () => {
  assert.deepEqual(chainStatus(chain('a', { entry: [true, true, false, true] })), { status: 'warn', reasons: ['入口组 1/4 台探测异常'] })
  assert.deepEqual(chainStatus(chain('b', { e2e: 200 })).reasons, ['端到端 200 ms'])
  assert.deepEqual(chainStatus(chain('c', { loss: 6 })).reasons, ['丢包 6.0%'])
})

test('无有效延迟、某组全部不可用或丢包过半为异常', () => {
  assert.equal(chainStatus(chain('a', { e2e: 0, trend: [], entry: [false], mid: [false] })).status, 'down')
  assert.deepEqual(chainStatus(chain('b', { mid: [false, false] })).reasons, ['中转组无可用服务器'])
  assert.equal(chainStatus(chain('c', { loss: 60 })).status, 'down')
  // 端到端暂时为 0 但近期趋势有数据：不算无数据
  assert.equal(chainStatus(chain('d', { e2e: 0 })).status, 'ok')
})

test('异常置顶、偏慢其次，同状态保持原顺序；汇总计数', () => {
  const list = [chain('ok1'), chain('slow', { e2e: 300 }), chain('down', { loss: 90 }), chain('ok2')]
  assert.deepEqual(sortChains(list).map(item => item.chain.name), ['down', 'slow', 'ok1', 'ok2'])
  assert.deepEqual(forwardSummary(list), { total: 4, ok: 2, warn: 1, down: 1 })
})

test('组内全部不可用时连线标为 down', () => {
  assert.equal(hopTone({ role: 'entry', to_next_ms: 10, servers: [server('a', false)] }), 'down')
  assert.equal(hopTone({ role: 'exit', to_next_ms: 0, servers: [server('a', false)] }), 'idle')
})

test('7 天流量按天合计各节点，取流量最多的节点', () => {
  const traffic = { days: ['d1', 'd2'], total_gb: 6, servers: [
    { name: 'a', group: 'g', role: 'entry', daily_gb: [1, 2], total_gb: 3 },
    { name: 'b', group: 'g', role: 'exit', daily_gb: [0.5, 2.5], total_gb: 3.5 },
    { name: 'c', group: 'g', role: 'exit', daily_gb: [0, 0], total_gb: 0 },
  ] }
  const result = chainTraffic(chain('t', { traffic }))
  assert.deepEqual(result.daily, [{ date: 'd1', gb: 1.5 }, { date: 'd2', gb: 4.5 }])
  assert.deepEqual(result.servers.map(s => s.name), ['b', 'a'])
  assert.equal(chainTraffic(chain('none')), null)
  assert.deepEqual([0, 0.5, 12.34, 512, 2048].map(formatGb), ['0 GB', '512 MB', '12.3 GB', '512 GB', '2.00 TB'])
})
