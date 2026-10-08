import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chainStatus, chainTraffic, chainTrafficDay, flowDuration, flowLevel, formatGb, FORWARD_TRAFFIC_NOTE, FORWARD_TRAFFIC_SETTLE_MINUTES, forwardSummary, hopTone, latencyTone, mayHaveRouteSelection, routeFork, sortChains, trendCells } from './forward-model.ts'

test('选路段：按 route_hop 分叉，带策略说明与各路状态；有 routes 时不再提示可能是选路', () => {
  const chain = {
    name: 'akari', end_to_end_ms: 15, loss_pct: 0, bucket_sec: 300, trend: [],
    groups: [
      { name: '入口', role: 'entry', to_next_ms: 6, servers: [{ name: 'a', to_next_ms: 5, healthy: true, route: '路1' }] },
      { name: '出口', role: 'exit', to_next_ms: 0, servers: [{ name: 'x', to_next_ms: 0, healthy: false }] },
    ],
    route_hop: 0, route_policy: 'lowest_latency', failover_ms: 150,
    routes: [
      { name: '路1', via: [], latency_ms: 16, loss_pct: 0, selected: true, selected_by: ['a'] },
      { name: '路2', via: ['组3'], latency_ms: 200, loss_pct: 0, selected: false },
      { name: '路3', via: ['组4'], latency_ms: 16, loss_pct: 80, selected: false },
    ],
  }
  const fork = routeFork(chain)
  assert.equal(fork.hop, 0)
  assert.equal(fork.policy, '最低延迟优先 · 故障转移 150 ms')
  assert.deepEqual(fork.routes.map(r => r.tone), ['good', 'hi', 'down'])
  assert.equal(mayHaveRouteSelection(chain), false)
  assert.equal(routeFork({ ...chain, route_hop: 1 }), null, '分叉不能在最后一组之后')
  assert.equal(routeFork({ ...chain, routes: [] }), null)
})

test('状态条每段按链路口径着色，无数据为 idle', () => {
  const c = { name: 't', end_to_end_ms: 20, loss_pct: 0, bucket_sec: 300, groups: [], trend: [
    { ts: 1, e2e_ms: 20, loss: 0 }, { ts: 2, e2e_ms: 200, loss: 0 }, { ts: 3, e2e_ms: 20, loss: 25 },
    { ts: 4, e2e_ms: 20, loss: 60 }, { ts: 5, e2e_ms: 0, loss: 0 },
  ] }
  assert.deepEqual(trendCells(c).map(cell => cell.tone), ['ok', 'warn', 'warn', 'down', 'idle'])
  assert.match(trendCells(c)[2].label, /20 ms · 丢包 25\.0%$/)
})

test('连续两个以上中转组提示可能是选路段；单个中转不提示', () => {
  const groups = roles => ({ name: 'r', groups: roles.map((role, i) => ({ name: `g${i}`, role, to_next_ms: 5, servers: [] })) })
  assert.equal(mayHaveRouteSelection(groups(['entry', 'mid', 'mid', 'exit'])), true)
  assert.equal(mayHaveRouteSelection(groups(['entry', 'mid', 'exit'])), false)
  assert.equal(mayHaveRouteSelection(groups(['entry', 'exit'])), false)
})

test('流动档位按实时 bit/s 划分（主控为 byte/s），流动速度按延迟换算', () => {
  assert.deepEqual([0, 5_000, 20_000, 1_000_000, 5_000_000].map(flowLevel), [0, 0, 1, 2, 3])
  assert.deepEqual([1, 14, 120, 500, 0, undefined].map(flowDuration), [0.8, 1, 2.8, 3.2, 2.4, 2.4])
})

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

test('某一天的流量明细：当天合计、按用量排序、不列 0 流量节点', () => {
  const traffic = { days: ['10-03', '10-04'], total_gb: 9, servers: [
    { name: 'in-a', group: '入口组', role: 'entry', daily_gb: [1, 0.5], total_gb: 1.5 },
    { name: 'out-b', group: '出口组', role: 'exit', daily_gb: [3, 4.5], total_gb: 7.5 },
    { name: 'idle', group: '入口组', role: 'entry', daily_gb: [0, 0], total_gb: 0 },
  ] }
  const day = chainTrafficDay(chain('t', { traffic }), 1)
  assert.equal(day.date, '10-04')
  assert.equal(day.total, 5)
  assert.deepEqual(day.servers.map(s => `${s.name} ${s.gb}`), ['out-b 4.5', 'in-a 0.5'])
  assert.equal(chainTrafficDay(chain('t', { traffic }), 2), null)
  assert.equal(chainTrafficDay(chain('none'), 0), null)
})

test('转发链流量的更新提示使用主控 15 分钟结算周期', () => {
  assert.equal(FORWARD_TRAFFIC_SETTLE_MINUTES, 15)
  assert.equal(FORWARD_TRAFFIC_NOTE, '主控每 15 分钟更新一次')
})
