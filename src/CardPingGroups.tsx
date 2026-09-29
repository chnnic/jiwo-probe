import { useMemo, useState } from 'react'
import { ChevronDown, RotateCcw, Unplug } from 'lucide-react'
import type { ProbeBucket, ProbePingSeries } from './types'
import { useProbe } from './use-probe'
import { pingTargetOptions, resolvePingGroups } from './ping-groups'
import { LuminaHealthBars, luminaHeatColor, TrendDialog } from './App'
import './card-ping-groups.css'

type Variant = 'classic' | 'lumina' | 'gm' | 'emerald'
type Mode = 'latency' | 'loss'

function readSelections(key: string): Array<string | null> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || 'null')
    return Array.isArray(value) ? value.slice(0, 3).map(item => typeof item === 'string' ? item : null) : []
  } catch { return [] }
}

function barLevel(variant: Variant, kind: Mode, value: number): string {
  if (!Number.isFinite(value) || value < 0) return variant === 'emerald' ? 'empty' : 'none'
  if (variant === 'emerald') {
    return kind === 'latency'
      ? value > 240 ? 'bad' : value > 180 ? 'warn' : value > 60 ? 'fair' : 'good'
      : value > 9 ? 'bad' : value > 6 ? 'warn' : value > 1 ? 'fair' : 'good'
  }
  if (kind === 'loss') return value >= 20 ? 'bad' : value > 0 ? 'warn' : 'good'
  return variant === 'gm' ? value >= 200 ? 'bad' : value >= 100 ? 'warn' : 'good' : value >= 200 ? 'warn' : 'good'
}

function luminaValueColor(kind: Mode, value: number): string {
  const root = document.documentElement
  if (root.classList.contains('gold')) return '#f2d28b'
  if (root.classList.contains('platinum')) return luminaHeatColor(kind, value)
  const level = kind === 'latency' ? value < 60 ? 'success' : value < 120 ? 'warning' : 'error' : value < 1 ? 'success' : value < 5 ? 'warning' : 'error'
  return `var(--status-${level})`
}

function Bars({ variant, kind, buckets }: { variant: Variant; kind: Mode; buckets: ProbeBucket[] }) {
  if (variant === 'lumina') return <LuminaHealthBars buckets={buckets} kind={kind} />
  const recent = buckets.slice(-12)
  const padded = [...Array.from({ length: 12 - recent.length }, () => ({ ms: -1, loss: -1 })), ...recent]
  return <span className="card-ping-bars" aria-hidden="true">
    {padded.map((bucket, index) => {
      const value = kind === 'latency' ? bucket.ms : bucket.loss
      return <i key={index} className={`is-${barLevel(variant, kind, value)}`} title={value < 0 ? '无数据' : kind === 'latency' ? `${value.toFixed(0)} ms` : `${value.toFixed(1)}%`} />
    })}
  </span>
}

/** 七个常规主题的卡片显示；Premium / Ran 不接入。仅复用快照，不新增轮询。 */
export function CardPingGroups({ ping = [], serverIndex, serverName, variant, averageOnly = false }: {
  ping?: ProbePingSeries[]
  serverIndex: number
  serverName?: string
  variant: Variant
  /** Lite 紧凑卡片只显示全目标平均，不覆盖其他视图的已保存选择。 */
  averageOnly?: boolean
}) {
  const { pingGroups: config } = useProbe()
  const options = useMemo(() => pingTargetOptions(ping), [ping])
  // 服务器改名或后台默认设置变化后不沿用旧选择；不同主题共用同一卡片选择。
  const storageKey = `jiwo-ping-groups-v1:${JSON.stringify([serverName || `#${serverIndex}`, config])}`
  const saved = useMemo(() => readSelections(storageKey), [storageKey])
  const [edited, setEdited] = useState<{ key: string; values: Array<string | null> }>()
  const overrides = edited?.key === storageKey ? edited.values : saved
  const groups = useMemo(() => averageOnly
    ? [{ requested: '__avg__', target: options.find(option => option.key === '__avg__' && option.series), fallback: false }]
    : resolvePingGroups(options, config, overrides), [options, config, overrides, averageOnly])
  const [trend, setTrend] = useState<{ key: string; label: string; mode: Mode } | null>(null)
  const update = (values: Array<string | null>) => {
    setEdited({ key: storageKey, values })
    try {
      if (values.some(Boolean)) localStorage.setItem(storageKey, JSON.stringify(values))
      else localStorage.removeItem(storageKey)
    } catch { /* 隐私模式仍允许本次会话选择。 */ }
  }
  const name = serverName || `服务器 ${serverIndex + 1}`
  return <div className={`card-ping-groups card-ping-${variant}`} data-group-count={groups.length}
    onClick={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
    {groups.map((group, index) => {
      const current = group.target?.series
      const targetKey = group.target?.key || ''
      return <section className="card-ping-group" key={index} aria-label={`${name} 第 ${index + 1} 组延迟与丢包`} data-target={targetKey} data-fallback={group.fallback}>
        <div className="card-ping-metrics">
          {(['latency', 'loss'] as const).map(kind => {
            const value = kind === 'latency' ? current?.current_ms : current?.loss_pct
            const valid = value !== undefined && Number.isFinite(value) && value >= 0
            const text = !current ? '—' : !valid ? kind === 'latency' ? '超时' : '—' : kind === 'latency' ? `${value.toFixed(0)} ms` : `${value.toFixed(1)}%`
            const label = kind === 'latency' ? '延迟' : '丢包率'
            const openTrend = () => group.target && setTrend({ key: targetKey, label: group.target.label, mode: kind })
            return <div key={kind} className={`card-ping-metric${!current ? ' is-unavailable' : ''}`} onClick={openTrend}>
              <div className="card-ping-head">
                {kind === 'latency' ? averageOnly ? <span>平均延迟</span> : <span className="card-ping-selector">
                  <select aria-label={`${name} 第 ${index + 1} 组测试目标`} value={targetKey}
                    title={group.fallback ? `${options.find(option => option.key === group.requested)?.label || group.requested || '默认目标'} 未命中，使用 ${group.target?.label}` : group.target?.label || '没有可用的默认或国际备用目标'}
                    onClick={event => event.stopPropagation()}
                    onChange={event => {
                      const next = Array.from({ length: config.count }, (_, slot) => overrides[slot] ?? null)
                      next[index] = event.target.value
                      update(next)
                    }}>
                    {!targetKey && <option value="" disabled>未配置</option>}
                    {options.map(option => <option key={option.key} value={option.key}
                      disabled={!option.series || groups.some((other, slot) => slot !== index && other.target?.key === option.key)}>{option.label}{!option.series ? '（无目标）' : ''}</option>)}
                  </select>
                  <ChevronDown size={10} aria-hidden="true" />
                </span> : <span>
                  {!averageOnly && index === 0 && overrides.some(Boolean)
                    ? <button type="button" className="card-ping-reset" title="恢复后台默认目标" aria-label={`${name} 恢复后台默认目标`} onClick={event => { event.stopPropagation(); update([]) }}><RotateCcw size={11} /></button>
                    : <Unplug size={11} />}
                  丢包率
                </span>}
                <strong className={kind === 'loss' && valid && value > 0 ? 'warning' : undefined} style={variant === 'lumina' && valid ? { color: luminaValueColor(kind, value) } : undefined}>{text}</strong>
              </div>
              <button type="button" className="card-ping-trend" disabled={!current}
                aria-label={`${name} 第 ${index + 1} 组 ${group.target?.label || '未配置'} ${label}趋势`}
                onClick={event => { event.stopPropagation(); openTrend() }}>
                <Bars variant={variant} kind={kind} buckets={current?.buckets || []} />
              </button>
            </div>
          })}
        </div>
      </section>
    })}
    {trend && <TrendDialog serverIndex={serverIndex} initial={ping} targetKey={trend.key} cardTarget={trend.key} title={trend.label} mode={trend.mode} close={() => setTrend(null)} />}
  </div>
}
