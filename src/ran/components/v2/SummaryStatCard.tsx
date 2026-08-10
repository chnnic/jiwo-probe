/**
 * SummaryStatCard — top-row summary tile, used on Overview header.
 *
 * Layout:
 *   LABEL                                   [SERIAL]
 *   ┌────────────────────────────┐
 *   │  BIG NUMBER  unit          │  inline visual (right)
 *   │  optional subline          │
 *   └────────────────────────────┘
 *   ↑12.4% vs yesterday | optional CTA
 *
 * Designed to render 5-up across the top of Overview. Self-contained so a
 * subclass-style "specific" component (ActiveAlertsCard, ExpiringSoonCard,
 * etc) can just compose it without re-implementing layout.
 */

import type { ReactNode } from 'react'
import { Etch } from '@/components/atoms/Etch'
import { SerialPlate } from '@/components/atoms/SerialPlate'
import { contentFs } from '@/utils/fontScale'

interface Props {
  label: string
  serial: string
  /** Primary value — usually a big number */
  value: ReactNode
  unit?: string
  /** Inline visual on the right side of the value (sparkline / donut / mini bar) */
  visual?: ReactNode
  /** Subline below the value — secondary description */
  subline?: ReactNode
  /** Footer: delta string, vs-yesterday text, or CTA button */
  footer?: ReactNode
  /** Color override for the big number */
  valueColor?: string
}

export function SummaryStatCard({
  label,
  serial,
  value,
  unit,
  visual,
  subline,
  footer,
  valueColor,
}: Props) {
  return (
    <div
      className="precision-card"
      style={{
        padding: '13px 16px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Etch>{label}</Etch>
        <SerialPlate>{serial}</SerialPlate>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          minHeight: 38,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontVariantNumeric: 'tabular-nums',
                fontSize: contentFs(30),
                fontWeight: 500,
                color: valueColor ?? 'var(--fg-0)',
                letterSpacing: '-0.02em',
                lineHeight: 1,
              }}
            >
              {value}
            </span>
            {unit && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: contentFs(12),
                  color: 'var(--fg-2)',
                }}
              >
                {unit}
              </span>
            )}
          </div>
          {subline && (
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: contentFs(10),
                color: 'var(--fg-3)',
                letterSpacing: '0.04em',
                marginTop: 2,
              }}
            >
              {subline}
            </div>
          )}
        </div>

        {visual && <div style={{ flexShrink: 0 }}>{visual}</div>}
      </div>

      {footer && (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: contentFs(10),
            color: 'var(--fg-3)',
            letterSpacing: '0.04em',
            marginTop: 'auto',
            paddingTop: 4,
          }}
        >
          {footer}
        </div>
      )}
    </div>
  )
}
