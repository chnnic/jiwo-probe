/**
 * TimeWindowSwitcher — [24h | 3d | 7d | 30d] segmented switcher used in
 * the GLOBAL THROUGHPUT chart header to let users zoom the time window.
 *
 * Stateless — caller owns the current value and the change handler.
 * Stays small (~140px wide) so it can sit next to the IN/OUT/BOTH
 * legend toggle without crowding the chart card.
 */

import { contentFs } from '@/utils/fontScale'

export interface TimeWindowOption {
  hours: number
  label: string
}

export const DEFAULT_TIME_WINDOWS: TimeWindowOption[] = [
  { hours: 24, label: '24H' },
  { hours: 72, label: '3D' },
  { hours: 168, label: '7D' },
  { hours: 720, label: '30D' },
]

interface Props {
  value: number
  onChange: (hours: number) => void
  options?: TimeWindowOption[]
}

export function TimeWindowSwitcher({
  value,
  onChange,
  options = DEFAULT_TIME_WINDOWS,
}: Props) {
  return (
    <div
      style={{
        display: 'inline-flex',
        background: 'var(--bg-inset)',
        border: '1px solid var(--edge-engrave)',
        borderRadius: 4,
        padding: 2,
        boxShadow: 'inset 0 1px 0 var(--edge-deep)',
      }}
    >
      {options.map((opt) => {
        const active = opt.hours === value
        return (
          <button
            key={opt.hours}
            type="button"
            onClick={() => onChange(opt.hours)}
            style={{
              padding: '3px 9px',
              background: active ? 'var(--bg-2)' : 'transparent',
              border: 'none',
              borderRadius: 2,
              fontFamily: 'var(--font-mono)',
              fontSize: contentFs(9.5),
              letterSpacing: '0.14em',
              color: active ? 'var(--accent-bright)' : 'var(--fg-3)',
              fontWeight: active ? 500 : 400,
              cursor: 'pointer',
              boxShadow: active ? 'inset 0 1px 0 var(--bg-1)' : 'none',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
