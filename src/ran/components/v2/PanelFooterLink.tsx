/**
 * PanelFooterLink — quiet "View All X →" link anchored to a panel's bottom.
 *
 * Visual (matching the reference design):
 *   - Subtle muted-fg color, monospace small
 *   - NO top border or divider — sits directly under content
 *   - Inline-flex, left-aligned, small gap to the arrow
 *   - Tiny top margin to breathe but no full-width frame
 *
 * The arrow follows the label with a single space; on hover it nudges
 * right for a small affordance.
 */

import type { CSSProperties } from 'react'
import { contentFs } from '@/utils/fontScale'

interface Props {
  label: string
  href?: string
  onClick?: () => void
}

export function PanelFooterLink({ label, href, onClick }: Props) {
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    // Push to bottom of flex-column parent. If parent isn't flex, falls
    // back to "as far below as the surrounding content lets it" which is
    // still right under the last item.
    marginTop: 'auto',
    paddingTop: 10,
    background: 'transparent',
    border: 'none',
    fontFamily: 'var(--font-mono)',
    fontSize: contentFs(10),
    letterSpacing: '0.02em',
    color: 'var(--fg-2)',
    textDecoration: 'none',
    cursor: 'pointer',
    transition: 'color 0.12s ease, transform 0.12s ease',
    alignSelf: 'flex-start',
  }

  const onEnter = (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget as HTMLElement
    el.style.color = 'var(--accent-bright)'
    const arrow = el.querySelector('[data-arrow]') as HTMLElement | null
    if (arrow) arrow.style.transform = 'translateX(2px)'
  }
  const onLeave = (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget as HTMLElement
    el.style.color = 'var(--fg-2)'
    const arrow = el.querySelector('[data-arrow]') as HTMLElement | null
    if (arrow) arrow.style.transform = 'translateX(0)'
  }

  const inner = (
    <>
      <span>{label}</span>
      <span
        data-arrow
        style={{
          fontSize: contentFs(11),
          transition: 'transform 0.12s ease',
        }}
      >
        →
      </span>
    </>
  )

  if (onClick && !href) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={base}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        {inner}
      </button>
    )
  }
  return (
    <a
      href={href ?? '#'}
      style={base}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {inner}
    </a>
  )
}
