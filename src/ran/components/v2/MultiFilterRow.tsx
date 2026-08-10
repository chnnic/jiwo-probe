/**
 * MultiFilterRow — composable filter bar for the Nodes page.
 *
 * Layout (one row, wraps on mobile):
 *   [search]  [region ▾]  [status ▾]  [group ▾]  [os ▾]  [more ▾]  [refresh]
 *
 * Each dropdown is a controlled component with a label and a list of options.
 * Options are passed in — this component is purely presentational so callers
 * can decide what's filter-worthy based on the actual node set.
 *
 * Selection model:
 *   - One value per filter (no multi-select for v2.0 — keeps the UI simple)
 *   - 'all' is the default "no filter" value
 *
 * Designed to work alongside (not replace) the AggregateBar above it.
 */

import { useEffect, useRef, useState } from 'react'
import { contentFs } from '@/utils/fontScale'
import { Etch } from '@/components/atoms/Etch'

export interface FilterOption {
  value: string
  label: string
  /** Optional count to show in the menu (e.g. "China · 12") */
  count?: number
}

export interface FilterSpec {
  /** Stable id used for state keys */
  key: string
  /** Visible label (e.g. "REGION") */
  label: string
  /** Options including the leading 'all' entry */
  options: FilterOption[]
  /** Currently selected value (default 'all') */
  value: string
  onChange: (v: string) => void
}

interface Props {
  /** Free-text search query */
  searchQuery: string
  onSearchChange: (v: string) => void
  searchPlaceholder?: string
  /** Filters to render (typically: Region, Status, Group, OS) */
  filters: FilterSpec[]
  /** Right-side meta info, e.g. "SHOWN 18/18" */
  meta?: string
  /** Optional refresh handler — shows a refresh button if provided */
  onRefresh?: () => void
}

export function MultiFilterRow({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search nodes by name, tag, ip…',
  filters,
  meta,
  onRefresh,
}: Props) {
  return (
    <div
      className="precision-card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        flexWrap: 'wrap',
      }}
    >
      {/* Search */}
      <div
        style={{
          position: 'relative',
          flex: '1 1 220px',
          minWidth: 180,
          maxWidth: 320,
        }}
      >
        <span
          style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: contentFs(13),
            color: 'var(--fg-3)',
            pointerEvents: 'none',
          }}
        >
          ⌕
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          style={{
            width: '100%',
            padding: '6px 10px 6px 28px',
            background: 'var(--bg-1)',
            border: '1px solid var(--edge-engrave)',
            borderRadius: 3,
            boxShadow: 'inset 0 1px 0 var(--edge-deep)',
            fontFamily: 'var(--font-mono)',
            fontSize: contentFs(11),
            color: 'var(--fg-1)',
            outline: 'none',
          }}
        />
      </div>

      {filters.map((f) => (
        <FilterDropdown key={f.key} spec={f} />
      ))}

      <div style={{ flex: 1 }} />

      {meta && (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: contentFs(10),
            color: 'var(--fg-2)',
            letterSpacing: '0.08em',
          }}
        >
          {meta}
        </span>
      )}

      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          style={{
            padding: '4px 10px',
            background: 'var(--bg-1)',
            border: '1px solid var(--edge-engrave)',
            borderRadius: 3,
            boxShadow: 'inset 0 1px 0 var(--edge-deep)',
            fontFamily: 'var(--font-mono)',
            fontSize: contentFs(9),
            letterSpacing: '0.14em',
            color: 'var(--fg-1)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span>↻</span>
          <span>REFRESH</span>
        </button>
      )}
    </div>
  )
}

/** Single dropdown filter — opens on click, closes on outside-click. */
function FilterDropdown({ spec }: { spec: FilterSpec }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', handler)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('mousedown', handler)
      window.removeEventListener('keydown', esc)
    }
  }, [open])

  const current = spec.options.find((o) => o.value === spec.value)
  const isAll = spec.value === 'all'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 9px',
          background: isAll ? 'var(--bg-1)' : 'rgba(160,104,32,0.08)',
          border: `1px solid ${isAll ? 'var(--edge-engrave)' : 'var(--accent)'}`,
          borderRadius: 3,
          boxShadow: 'inset 0 1px 0 var(--edge-deep)',
          fontFamily: 'var(--font-mono)',
          fontSize: contentFs(10),
          color: isAll ? 'var(--fg-2)' : 'var(--accent-bright)',
          letterSpacing: '0.08em',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <Etch>{spec.label}</Etch>
        <span
          style={{
            color: isAll ? 'var(--fg-1)' : 'var(--accent-bright)',
            fontWeight: 500,
          }}
        >
          {current?.label ?? 'All'}
        </span>
        <span style={{ fontSize: contentFs(8), opacity: 0.6 }}>▼</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            minWidth: 180,
            maxHeight: 320,
            overflowY: 'auto',
            background: 'var(--bg-1)',
            border: '1px solid var(--edge-engrave)',
            borderRadius: 4,
            boxShadow: '0 4px 12px rgba(50,40,25,0.18)',
            zIndex: 50,
            padding: 3,
          }}
        >
          {spec.options.map((opt) => {
            const active = opt.value === spec.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  spec.onChange(opt.value)
                  setOpen(false)
                }}
                style={{
                  display: 'flex',
                  width: '100%',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '5px 8px',
                  background: active ? 'rgba(160,104,32,0.1)' : 'transparent',
                  border: 'none',
                  borderRadius: 2,
                  fontFamily: 'var(--font-mono)',
                  fontSize: contentFs(11),
                  color: active ? 'var(--accent-bright)' : 'var(--fg-1)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  letterSpacing: '0.04em',
                }}
                onMouseEnter={(e) => {
                  if (!active)
                    (e.currentTarget as HTMLButtonElement).style.background =
                      'var(--bg-2)'
                }}
                onMouseLeave={(e) => {
                  if (!active)
                    (e.currentTarget as HTMLButtonElement).style.background =
                      'transparent'
                }}
              >
                <span>{opt.label}</span>
                {typeof opt.count === 'number' && (
                  <span style={{ color: 'var(--fg-3)', fontSize: contentFs(10) }}>
                    {opt.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
