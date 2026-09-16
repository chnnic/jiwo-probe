import type { ProbeBucket, ProbePingSeries } from './types'

export interface PingGroupConfig {
  count: 1 | 2 | 3
  defaultTargets: string[]
  intlTargets: string[]
}

/**
 * 安装默认配置：直接部署即启用三组，无需在 CF 后台另外添加这些变量。
 * 需要修改脚本默认值时，只改下面三项；中文、英文逗号或换行均可分隔目标。
 * CF 后台的同名运行时变量仍可覆盖默认值，普通部署不会重置后台自定义设置。
 * Premium / Ran 不使用这套卡片配置。
 */
export const PING_GROUP_SCRIPT_VARS: {
  PROBE_PING_GROUP_COUNT: 1 | 2 | 3
  PROBE_PING_DEFAULT_TARGETS: string
  PROBE_PING_INTL_TARGETS: string
} = {
  PROBE_PING_GROUP_COUNT: 3,
  PROBE_PING_DEFAULT_TARGETS: '平均延迟，内地延迟，海外延迟',
  // 依次候补：Cloudflare、Google、Telegram DC5。
  PROBE_PING_INTL_TARGETS: 'intl-web-cloudflare,intl-web-google,intl-tg-dc5',
}

export const PING_GROUP_DEFAULTS: PingGroupConfig = {
  count: PING_GROUP_SCRIPT_VARS.PROBE_PING_GROUP_COUNT,
  defaultTargets: PING_GROUP_SCRIPT_VARS.PROBE_PING_DEFAULT_TARGETS.split(/[,，\n]/).map(value => value.trim()),
  intlTargets: PING_GROUP_SCRIPT_VARS.PROBE_PING_INTL_TARGETS.split(/[,，\n]/).map(value => value.trim()).filter(Boolean),
}

export const PING_AVERAGES = [
  { key: '__avg__', label: '平均延迟', scope: 'all' },
  { key: '__avg_cn__', label: '内地延迟', scope: 'cn' },
  { key: '__avg_intl__', label: '海外延迟', scope: 'intl' },
] as const

const aliases: Record<string, string> = {
  '平均': '__avg__', '平均延迟': '__avg__', '全部平均': '__avg__', avg: '__avg__',
  '内地延迟': '__avg_cn__', '国内延迟': '__avg_cn__', '内地平均': '__avg_cn__', '国内平均': '__avg_cn__', 'avg-cn': '__avg_cn__',
  '海外延迟': '__avg_intl__', '国际延迟': '__avg_intl__', '海外平均': '__avg_intl__', '国际平均': '__avg_intl__', 'avg-intl': '__avg_intl__',
}

export function normalizePingTarget(value: string): string {
  const trimmed = value.trim()
  const alias = trimmed.toLowerCase()
  return Object.hasOwn(aliases, alias) ? aliases[alias] : trimmed
}

function targetList(value: unknown): string[] | undefined {
  const list = typeof value === 'string' ? value.split(/[,，\n]/) : Array.isArray(value) ? value : []
  if (!list.some(item => typeof item === 'string' && item.trim())) return undefined
  // 默认目标保留空位置：例如“上海电信，，海外平均”的第二组走备用。
  return list.slice(0, 64).map(item => typeof item === 'string' ? normalizePingTarget(item) : '')
}

export function parsePingGroupConfig(input: { count?: unknown; defaultTargets?: unknown; intlTargets?: unknown } = {}): PingGroupConfig {
  const count = Number(input.count)
  return {
    count: count === 1 || count === 2 || count === 3 ? count : PING_GROUP_DEFAULTS.count,
    defaultTargets: (targetList(input.defaultTargets) || PING_GROUP_DEFAULTS.defaultTargets.map(normalizePingTarget)).slice(0, 3),
    // 留空使用上方的三项候补；填入名单后仅按该名单依次补位。
    intlTargets: targetList(input.intlTargets)?.filter(Boolean) || [...PING_GROUP_DEFAULTS.intlTargets],
  }
}

export const DEFAULT_PING_GROUP_CONFIG = parsePingGroupConfig()

export function pingScope(series: ProbePingSeries): 'cn' | 'intl' | 'unknown' {
  const isp = series.isp?.trim().toLowerCase()
  if (isp === 'intl' || /^intl[-_:]/i.test(series.key || '')) return 'intl'
  if (['telecom', 'unicom', 'mobile'].includes(isp || '') || /电信|联通|移动/.test(series.label)) return 'cn'
  // 不把无法分类的自定义目标当作国际目标，以免备用意外落回国内线路。
  return 'unknown'
}

export function pingTargetKey(series: ProbePingSeries): string {
  return series.key?.trim() || `${series.label.trim()}|${series.isp || ''}`
}

export function isPingAverage(key: string): boolean {
  return PING_AVERAGES.some(average => average.key === key)
}

const mean = (values: number[]) => {
  const valid = values.filter(value => Number.isFinite(value) && value >= 0)
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : -1
}

export function aggregatePingGroup(series: ProbePingSeries[], key: string, label: string): ProbePingSeries {
  const length = Math.max(0, ...series.map(item => item.buckets.length))
  const buckets: ProbeBucket[] = Array.from({ length }, (_, index) => {
    // 各线路可能只有部分历史；按最近一个桶对齐，不把缺失历史当作 0。
    const rows = series.flatMap(item => {
      const bucket = item.buckets[item.buckets.length - length + index]
      return bucket ? [bucket] : []
    })
    return { ms: mean(rows.map(row => row.ms)), loss: mean(rows.map(row => row.loss)) }
  })
  return { key, label, current_ms: mean(series.map(item => item.current_ms)), loss_pct: mean(series.map(item => item.loss_pct)), buckets }
}

export interface PingTargetOption {
  key: string
  label: string
  scope: 'all' | 'cn' | 'intl' | 'unknown'
  series?: ProbePingSeries
}

export function pingTargetOptions(ping: ProbePingSeries[]): PingTargetOption[] {
  const lines = [...new Map(ping.filter(item => !isPingAverage(item.key || '')).map(item => [pingTargetKey(item), item])).values()]
  return [
    ...PING_AVERAGES.map(average => {
      const selected = average.scope === 'all' ? lines : lines.filter(item => pingScope(item) === average.scope)
      return { ...average, series: selected.length ? aggregatePingGroup(selected, average.key, average.label) : undefined }
    }),
    ...lines.map(item => ({ key: pingTargetKey(item), label: item.label, scope: pingScope(item), series: { ...item, key: pingTargetKey(item) } })),
  ]
}

function matchTarget(value: string, options: PingTargetOption[]): PingTargetOption | undefined {
  const token = normalizePingTarget(value)
  const keyed = options.find(item => item.key === token)
  if (keyed) return keyed.series ? keyed : undefined
  const labels = options.filter(item => item.series && item.label.toLowerCase() === token.toLowerCase())
  // 同名自定义目标不猜，使用 key 即可消歧。
  return labels.length === 1 ? labels[0] : undefined
}

export interface ResolvedPingGroup {
  requested: string
  target?: PingTargetOption
  fallback: boolean
}

export function resolvePingGroups(options: PingTargetOption[], config: PingGroupConfig, overrides: Array<string | null> = []): ResolvedPingGroup[] {
  const used = new Set<string>()
  const groups = Array.from({ length: config.count }, (_, index): ResolvedPingGroup => ({
    requested: overrides[index] ?? config.defaultTargets[index] ?? '', fallback: false,
  }))
  // 先保留手动选择，再保留所有默认命中项，避免前一组备用占掉后一组的默认目标。
  const order = groups.map((_, index) => index).sort((a, b) => Number(!!overrides[b]) - Number(!!overrides[a]))
  for (const index of order) {
    const group = groups[index]
    const target = matchTarget(group.requested, options)
    if (target && !used.has(target.key)) {
      group.target = target
      used.add(target.key)
    }
  }
  const backups = (config.intlTargets.length ? config.intlTargets : PING_GROUP_DEFAULTS.intlTargets)
    .flatMap(value => {
      const item = matchTarget(value, options)
      return item?.scope === 'intl' ? [item] : []
    })
  for (const group of groups) {
    if (group.target) continue
    const target = backups.find(item => !used.has(item.key))
    if (target) {
      group.target = target
      group.fallback = true
      used.add(target.key)
    }
  }
  return groups
}
