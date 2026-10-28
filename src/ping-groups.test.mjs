import assert from 'node:assert/strict'
import test from 'node:test'
import { aggregatePingGroup, historyPingSeries, inPingChartGroup, isIpv6Ping, parsePingGroupConfig, PING_GROUP_SCRIPT_VARS, pingScope, pingTargetOptions, primaryPing, resolvePingGroups } from './ping-groups.ts'
import { averagePing } from './server-format.ts'

const line = (key, label, isp, ms = 50, loss = 0) => ({ key, label, isp, current_ms: ms, loss_pct: loss, buckets: [{ ms, loss }] })
const cn = line('sh-ct-v4', '上海电信', 'telecom')
const cf = line('intl-web-cloudflare', 'Cloudflare', 'intl', 200, 2)
const google = line('intl-web-google', 'Google', 'intl', 300, 4)
const telegram = line('intl-tg-dc5', 'Telegram DC5', 'intl', 150, 1)
const defaultBackups = ['intl-web-cloudflare', 'intl-web-google', 'intl-tg-dc5']
const all = pingTargetOptions([cn, cf, google])
const resolve = (defaults, backup = 'Cloudflare，Google', options = all, count = 3, overrides) => resolvePingGroups(options, parsePingGroupConfig({ count, defaultTargets: defaults, intlTargets: backup }), overrides)
const keys = groups => groups.map(group => group.target?.key)

test('fresh installation uses the embedded variables without CF setup', () => {
  assert.deepEqual(PING_GROUP_SCRIPT_VARS, {
    PROBE_PING_GROUP_COUNT: 3,
    PROBE_PING_DEFAULT_TARGETS: '平均延迟，内地延迟，海外延迟',
    PROBE_PING_INTL_TARGETS: 'intl-web-cloudflare,intl-web-google,intl-tg-dc5',
  })
  assert.deepEqual(parsePingGroupConfig(), parsePingGroupConfig({
    count: PING_GROUP_SCRIPT_VARS.PROBE_PING_GROUP_COUNT,
    defaultTargets: PING_GROUP_SCRIPT_VARS.PROBE_PING_DEFAULT_TARGETS,
    intlTargets: PING_GROUP_SCRIPT_VARS.PROBE_PING_INTL_TARGETS,
  }))
})

test('script defaults are three groups and three international backups; explicit CF settings win', () => {
  assert.deepEqual(parsePingGroupConfig(), { count: 3, defaultTargets: ['__avg__', '__avg_cn__', '__avg_intl__'], intlTargets: defaultBackups })
  for (const count of [undefined, null, '', 'abc', 0, -1, 4, 2.5]) assert.equal(parsePingGroupConfig({ count }).count, 3)
  assert.equal(parsePingGroupConfig({ count: '1' }).count, 1)
  assert.equal(parsePingGroupConfig({ count: '2' }).count, 2)
  assert.deepEqual(parsePingGroupConfig({ count: '3', defaultTargets: ' 平均，国内平均, 国际平均 ', intlTargets: 'Cloudflare\nGoogle' }), {
    count: 3, defaultTargets: ['__avg__', '__avg_cn__', '__avg_intl__'], intlTargets: ['Cloudflare', 'Google'],
  })
  assert.deepEqual(parsePingGroupConfig({ defaultTargets: 'avg,avg-cn,avg-intl' }).defaultTargets, ['__avg__', '__avg_cn__', '__avg_intl__'])
  assert.deepEqual(parsePingGroupConfig({ defaultTargets: '平均延迟，内地延迟，海外延迟' }).defaultTargets, ['__avg__', '__avg_cn__', '__avg_intl__'])
  assert.deepEqual(parsePingGroupConfig({ defaultTargets: 'constructor,__proto__,toString' }).defaultTargets, ['constructor', '__proto__', 'toString'])
})

test('dropdown offers the exact three requested average labels', () => {
  assert.deepEqual(all.slice(0, 3).map(item => item.label), ['平均延迟', '内地延迟', '海外延迟'])
})

test('the three default international backups keep priority and do not use a fourth target', () => {
  const extra = line('intl-web-github', 'GitHub', 'intl')
  const groups = resolve('缺失一，缺失二，缺失三', '', pingTargetOptions([extra, telegram, google, cf, cn]))
  assert.deepEqual(keys(groups), defaultBackups)
  const missing = resolve('缺失一，缺失二，缺失三', '', pingTargetOptions([extra, cf, telegram]))
  assert.deepEqual(keys(missing), ['intl-web-cloudflare', 'intl-tg-dc5', undefined])
})

test('slot order and blank positions are retained', () => {
  assert.deepEqual(keys(resolve('上海电信，，海外平均')), ['sh-ct-v4', 'intl-web-cloudflare', '__avg_intl__'])
  assert.equal(resolve('平均，上海电信，Google', undefined, all, 2).length, 2)
})

test('reserve all default matches before choosing fallbacks', () => {
  assert.deepEqual(keys(resolve('不存在，Cloudflare，上海电信')), ['intl-web-google', 'intl-web-cloudflare', 'sh-ct-v4'])
})

test('missing domestic targets fall back to international without landing-server list', () => {
  const options = pingTargetOptions([cf, google])
  const groups = resolve('内地平均，Cloudflare，无匹配', undefined, options)
  assert.deepEqual(keys(groups), ['intl-web-google', 'intl-web-cloudflare', undefined])
  assert.equal(groups[0].fallback, true)
})

test('timeout and 100% loss do not trigger replacement, including domestic average', () => {
  const options = pingTargetOptions([{ ...cn, current_ms: -1, loss_pct: 100, buckets: [{ ms: -1, loss: 100 }] }, cf])
  const groups = resolve('内地平均，上海电信', undefined, options, 2)
  assert.deepEqual(keys(groups), ['__avg_cn__', 'sh-ct-v4'])
  for (const group of groups) {
    assert.equal(group.fallback, false)
    assert.equal(group.target.series.current_ms, -1)
    assert.equal(group.target.series.loss_pct, 100)
  }
})

test('duplicates and insufficient backups produce a placeholder, not duplicate targets', () => {
  assert.deepEqual(keys(resolve('Cloudflare，Cloudflare，Cloudflare')), ['intl-web-cloudflare', 'intl-web-google', undefined])
  assert.deepEqual(keys(resolve('不存在，没找到，缺失', 'Cloudflare，Cloudflare')), ['intl-web-cloudflare', undefined, undefined])
  assert.deepEqual(keys(resolve('不存在，不存在，不存在', '无效', all)), [undefined, undefined, undefined])
})

test('international-only backup ignores domestic and unknown entries', () => {
  const unknown = line('custom-1', '自定义目标', undefined)
  assert.equal(pingScope(unknown), 'unknown')
  assert.deepEqual(keys(resolve('缺失', '上海电信，自定义目标，Google', pingTargetOptions([cn, unknown, google]), 1)), ['intl-web-google'])
  assert.equal(pingScope(line('intl-custom', '国际电信', 'telecom')), 'intl')
  assert.equal(pingScope(line('custom-cn', '广东移动', undefined)), 'cn')
})

test('empty backup is stable across input reorder and never uses unknown/custom domestic lines', () => {
  const a = resolve('无匹配，无匹配，无匹配', '', all)
  const b = resolve('无匹配，无匹配，无匹配', '', pingTargetOptions([google, cn, cf]))
  assert.deepEqual(keys(a), keys(b))
  assert.deepEqual(keys(a), ['intl-web-cloudflare', 'intl-web-google', undefined])
})

test('full keys and unique names match; ambiguous names do not guess', () => {
  assert.deepEqual(keys(resolve('sh-ct-v4，Cloudflare，intl-web-google')), ['sh-ct-v4', 'intl-web-cloudflare', 'intl-web-google'])
  const options = pingTargetOptions([line('a', '同名', 'telecom'), line('b', '同名', 'telecom')])
  assert.equal(resolve('同名', 'missing', options, 1)[0].target, undefined)
  assert.equal(resolve('b', 'missing', options, 1)[0].target?.key, 'b')
})

test('manual choices win over defaults and reset returns defaults', () => {
  const config = parsePingGroupConfig({ count: 2, defaultTargets: '上海电信，Cloudflare', intlTargets: 'Cloudflare，Google' })
  assert.deepEqual(keys(resolvePingGroups(all, config, ['intl-web-cloudflare', null])), ['intl-web-cloudflare', 'intl-web-google'])
  assert.deepEqual(keys(resolvePingGroups(all, config, [])), ['sh-ct-v4', 'intl-web-cloudflare'])
})

test('averages exclude invalid values, include 100% loss and right-align history', () => {
  const series = [
    { ...cn, current_ms: -1, loss_pct: 100, buckets: [{ ms: 10, loss: 0 }, { ms: -1, loss: 100 }] },
    { ...cf, current_ms: 20, loss_pct: 0, buckets: [{ ms: 20, loss: 0 }] },
  ]
  const result = aggregatePingGroup(series, '__avg__', '全部平均')
  assert.equal(result.current_ms, 20)
  assert.equal(result.loss_pct, 50)
  assert.deepEqual(result.buckets, [{ ms: 10, loss: 0 }, { ms: 20, loss: 50 }])
  const invalid = aggregatePingGroup([{ ...cn, current_ms: NaN, loss_pct: -1, buckets: [{ ms: -1, loss: NaN }] }], '__avg__', '全部平均')
  assert.equal(invalid.current_ms, -1)
  assert.equal(invalid.loss_pct, -1)
  assert.deepEqual(invalid.buckets, [{ ms: -1, loss: -1 }])
})

test('average scope is shared by latency and loss; synthetic averages are not averaged again', () => {
  const options = pingTargetOptions([...all.flatMap(item => item.series ? [item.series] : [])])
  assert.equal(options.find(item => item.key === '__avg_cn__').series.current_ms, 50)
  assert.equal(options.find(item => item.key === '__avg_cn__').series.loss_pct, 0)
  assert.equal(options.find(item => item.key === '__avg_intl__').series.current_ms, 250)
  assert.equal(options.find(item => item.key === '__avg_intl__').series.loss_pct, 3)
  assert.equal(options.length, 6)
})

test('empty server has no fabricated averages or zero measurements', () => {
  const options = pingTargetOptions([])
  assert.equal(options.length, 3)
  assert.ok(options.every(item => !item.series))
  assert.deepEqual(keys(resolve('平均，内地平均，海外平均', '', options)), [undefined, undefined, undefined])
})

const v6 = line('sh-cu-v6', '上海联通 IPv6', 'unicom', 170, 4)

test('IPv6 延迟目标按 -v6 后缀或名称识别，整机汇总只取 IPv4，全是 IPv6 时退回全部', () => {
  assert.deepEqual([cn, v6, cf].map(isIpv6Ping), [false, true, false])
  assert.equal(isIpv6Ping({ key: 'custom', label: '杭州电信 IPv6' }), true)
  assert.deepEqual(primaryPing([cn, v6, cf]).map(item => item.key), ['sh-ct-v4', 'intl-web-cloudflare'])
  assert.deepEqual(primaryPing([v6]).map(item => item.key), ['sh-cu-v6'])
  assert.deepEqual(primaryPing(undefined), [])
  assert.equal(averagePing([cn, v6, cf]).current_ms, 125)
})

test('开了 IPv6 的服务器：平均和内地平均不含 IPv6，另有一项 IPv6 延迟；没开的服务器不出现这一项', () => {
  const options = pingTargetOptions([cn, v6, cf])
  const byKey = Object.fromEntries(options.map(option => [option.key, option]))
  assert.equal(byKey.__avg__.series.current_ms, 125)
  assert.equal(byKey.__avg_cn__.series.current_ms, 50)
  assert.equal(byKey.__avg_v6__.label, 'IPv6 延迟')
  assert.equal(byKey.__avg_v6__.series.current_ms, 170)
  assert.ok(byKey['sh-cu-v6'])
  assert.equal(all.some(option => option.key === '__avg_v6__'), false)
  const groups = resolvePingGroups(options, parsePingGroupConfig({ count: 1, defaultTargets: 'IPv6 延迟' }))
  assert.equal(groups[0].target.key, '__avg_v6__')
})

test('趋势图分组：内地、海外不含 IPv6 线路，IPv6 一组含 IPv6 平均和各条 IPv6 线路', () => {
  const series = historyPingSeries({ key: 'x', label: '主控平均', current_ms: 90, loss_pct: 2, buckets: [{ ms: 90, loss: 2 }] }, [cn, v6, cf])
  assert.deepEqual(series.map(item => item.key), ['__avg__', '__avg_v6__', 'sh-ct-v4', 'sh-cu-v6', 'intl-web-cloudflare'])
  assert.equal(series[0].current_ms, 125)
  assert.equal(series[0].label, '平均')
  const pick = group => series.filter(item => inPingChartGroup(item, group)).map(item => item.key)
  assert.deepEqual(pick('cn'), ['sh-ct-v4'])
  assert.deepEqual(pick('idc'), ['intl-web-cloudflare'])
  assert.deepEqual(pick('v6'), ['__avg_v6__', 'sh-cu-v6'])
  assert.equal(pick('all').length, 5)
  const plain = historyPingSeries({ key: 'x', label: '主控平均', current_ms: 90, loss_pct: 2, buckets: [] }, [cn, cf])
  assert.deepEqual(plain.map(item => [item.key, item.label, item.current_ms]), [['__avg__', '平均', 90], ['sh-ct-v4', '上海电信', 50], ['intl-web-cloudflare', 'Cloudflare', 200]])
})
