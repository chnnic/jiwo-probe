/**
 * ViewModeSwitcher — 3-way view toggle for the Nodes page.
 *
 *   [⊞ GRID | ☰ TABLE | ▤ COMPACT]
 *
 *   GRID    — the existing rich card layout (classic), one card per node
 *   TABLE   — true tabular row layout (NodeRowTable)
 *   COMPACT — dense small cards (NodeCardCompactV2)
 *
 * Preference is persisted to localStorage under `ran.v2.nodeViewMode`.
 *
 * Replaces the previous CardStyleSwitcher (which only had Classic/Compact).
 */

import { useCallback, useEffect, useState } from 'react'
import { contentFs } from '@/utils/fontScale'

export type NodeViewMode = 'grid' | 'table' | 'compact'

const STORAGE_KEY = 'ran.v2.nodeViewMode'
const DEFAULT_VIEW: NodeViewMode = 'grid'

function loadView(): NodeViewMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'grid' || raw === 'table' || raw === 'compact') return raw
    // Migration: legacy 'classic' → 'grid'
    const legacy = localStorage.getItem('ran.v2.nodeCardStyle')
    if (legacy === 'classic') return 'grid'
    if (legacy === 'compact') return 'compact'
  } catch {
    /* ignore */
  }
  return DEFAULT_VIEW
}

function saveView(v: NodeViewMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, v)
  } catch {
    /* ignore */
  }
}

export function useNodeViewMode(): [NodeViewMode, (v: NodeViewMode) => void] {
  const [view, setView] = useState<NodeViewMode>(() => loadView())

  // Cross-tab sync
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      const v = e.newValue
      if (v === 'grid' || v === 'table' || v === 'compact') setView(v)
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const set = useCallback((v: NodeViewMode) => {
    setView(v)
    saveView(v)
  }, [])

  return [view, set]
}

interface Props {
  value: NodeViewMode
  onChange: (v: NodeViewMode) => void
}

const OPTIONS: { value: NodeViewMode; label: string; icon: string }[] = [
  { value: 'grid', label: 'GRID', icon: '⊞' },
  { value: 'table', label: 'TABLE', icon: '☰' },
  { value: 'compact', label: 'COMPACT', icon: '▤' },
]

export function ViewModeSwitcher({ value, onChange }: Props) {
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
      {OPTIONS.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              background: active ? 'var(--bg-2)' : 'transparent',
              border: 'none',
              borderRadius: 2,
              fontFamily: 'var(--font-mono)',
              fontSize: contentFs(10),
              letterSpacing: '0.12em',
              color: active ? 'var(--accent-bright)' : 'var(--fg-3)',
              fontWeight: active ? 500 : 400,
              cursor: 'pointer',
              boxShadow: active ? 'inset 0 1px 0 var(--bg-1)' : 'none',
            }}
          >
            <span style={{ fontSize: contentFs(11) }}>{opt.icon}</span>
            <span>{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
