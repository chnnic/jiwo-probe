import assert from 'node:assert/strict'
import test from 'node:test'
import { aggregatePingGroup, parsePingGroupConfig, pingScope, pingTargetOptions, resolvePingGroups } from './ping-groups.ts'

const line = (key, label, isp, ms = 50, loss = 0) => ({ key, label, isp, current_ms: ms, loss_pct: loss, buckets: [{ ms, loss }] })
const cn = line('sh-ct-v4', '上海电信', 'telecom')
const cf = line('intl-web-cloudflare', 'Cloudflare', 'intl', 200, 2)
const google = line('intl-web-google', 'Google', 'intl', 300, 4)
const telegram = line('intl-tg-dc5', 'Telegram DC5', 'intl', 150, 1)
const defaultBackups = ['intl-web-cloudflare', 'intl-web-google', 'intl-tg-dc5']
const all = pingTargetOptions([cn, cf, google])
const resolve = (defaults, backup = 'Cloudflare，Google', options = all, count = 3, overrides) => resolvePingGroups(options, parsePingGroupConfig({ count, defaultTargets: defaults, intlTargets: backup }), overrides)
const keys = groups => groups.map(group => group.target?.key)

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
