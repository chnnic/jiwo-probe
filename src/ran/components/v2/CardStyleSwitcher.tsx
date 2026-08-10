/**
 * CardStyleSwitcher — toggle between two node card styles on the Nodes page.
 *
 *   [CLASSIC | COMPACT]
 *
 *  - CLASSIC  = the existing NodeCardCompact (full info, 9 rows, HP bar, tags)
 *  - COMPACT  = new dense card (5 rows, inline progress bars, sparkline)
 *
 * Selection persists to localStorage under the key `ran.v2.nodeCardStyle`.
 *
 * Use:
 *   const [style, setStyle] = useNodeCardStyle()
 *   return <CardStyleSwitcher value={style} onChange={setStyle} />
 *
 * The Segmented atom is reused for visual consistency.
 */

import { useCallback, useEffect, useState } from 'react'
import { Segmented } from '@/components/atoms/Segmented'

export type NodeCardStyle = 'classic' | 'compact'

const STORAGE_KEY = 'ran.v2.nodeCardStyle'
const DEFAULT_STYLE: NodeCardStyle = 'classic'

function loadStyle(): NodeCardStyle {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'classic' || raw === 'compact') return raw
  } catch {
    /* ignore */
  }
  return DEFAULT_STYLE
}

function saveStyle(s: NodeCardStyle): void {
  try {
    localStorage.setItem(STORAGE_KEY, s)
  } catch {
    /* ignore */
  }
}

/** Hook: get/set the persisted card style. */
export function useNodeCardStyle(): [NodeCardStyle, (s: NodeCardStyle) => void] {
  const [style, setStyle] = useState<NodeCardStyle>(() => loadStyle())

  // Listen for cross-tab changes so a switch in one tab updates others
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      const v = e.newValue
      if (v === 'classic' || v === 'compact') setStyle(v)
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const set = useCallback((s: NodeCardStyle) => {
    setStyle(s)
    saveStyle(s)
  }, [])

  return [style, set]
}

interface Props {
  value: NodeCardStyle
  onChange: (s: NodeCardStyle) => void
}

export function CardStyleSwitcher({ value, onChange }: Props) {
  return (
    <Segmented
      value={value}
      onChange={(v) => onChange(v as NodeCardStyle)}
      options={[
        { value: 'classic', label: 'CLASSIC' },
        { value: 'compact', label: 'COMPACT' },
      ]}
    />
  )
}
