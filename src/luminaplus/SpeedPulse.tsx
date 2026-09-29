import { memo, type CSSProperties } from 'react'
import { PULSE_POINTS, pulseStrength, speedTone } from './luminaplus-model'

/** Real recent snapshots, not generated animation or a replacement for controller history. */
export const SpeedPulse = memo(function SpeedPulse({ samples, value, online }: { samples: Array<number | undefined>; value?: number; online: boolean }) {
  const values = [...Array<undefined>(Math.max(0, PULSE_POINTS - samples.length)).fill(undefined), ...samples.slice(-PULSE_POINTS)]
  const live = online && value !== undefined && Number.isFinite(value) && value >= 0
  return <div className="lp-pulse" data-live={live} title="速度脉冲：本次页面收到的真实快照；未采集的点留空，不代表主控历史。">
    <span className="lp-pulse-trail" aria-hidden="true">{values.map((sample, index) => <i key={index} data-tone={speedTone(sample)} data-active={pulseStrength(sample) > 0} style={{ '--pulse-strength': pulseStrength(sample) } as CSSProperties} />)}</span>
    <span className="lp-pulse-live"><i data-tone={live ? speedTone(value) : 'unknown'} />{live ? '实时' : online ? '未上报' : '离线'}</span>
  </div>
})
