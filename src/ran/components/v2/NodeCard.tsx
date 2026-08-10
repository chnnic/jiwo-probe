import { memo } from 'react'
/**
 * NodeCard — style-aware node card dispatcher.
 *
 * Renders either NodeCardClassic or NodeCardCompactV2 depending on the
 * card style preference. Callers pass props once; this component picks
 * the right component to render.
 *
 *   <NodeCard style="compact" node={n} record={r} onClick={openDrawer} />
 *
 * For the classic style, click-to-open-drawer is wired by wrapping the
 * classic card in a clickable div (the classic card itself doesn't take
 * onClick — it's a pure visual). This keeps both styles consistent for
 * the consumer.
 */

import { useCallback } from 'react'
import type { KomariNode, KomariRecord } from '@/types/komari'
import type { NodeCardStyle } from './CardStyleSwitcher'
import { NodeCardClassic } from './NodeCardClassic'
import { NodeCardCompactV2 } from './NodeCardCompactV2'

interface Props {
  style: NodeCardStyle
  node: KomariNode
  record?: KomariRecord
  /** Net throughput sparkline data — passed through to compact variant.
   *  Classic variant uses its own internal sparkline via pingSpark. */
  netSpark?: number[]
  pingSpark?: number[]
  pingLoss?: number[]
  pingStats?: { avg?: number; loss: number; taskName?: string }
  onClick?: (uuid: string) => void
  selected?: boolean
}

function NodeCard_({
  style,
  node,
  record,
  netSpark,
  pingSpark,
  pingLoss,
  pingStats,
  onClick,
  selected,
}: Props) {
  const handleClick = useCallback(() => {
    if (onClick) onClick(node.uuid)
  }, [onClick, node.uuid])

  if (style === 'compact') {
    return (
      <NodeCardCompactV2
        node={node}
        record={record}
        netSpark={netSpark}
        onClick={onClick}
        selected={selected}
      />
    )
  }

  // Classic: wrap in clickable div since the legacy card is a pure visual
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : -1}
      onClick={onClick ? handleClick : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleClick()
              }
            }
          : undefined
      }
      style={{
        cursor: onClick ? 'pointer' : 'default',
        outline: selected ? '1px solid var(--accent)' : 'none',
        outlineOffset: selected ? -1 : 0,
        borderRadius: 4,
      }}
    >
      <NodeCardClassic
        node={node}
        record={record}
        pingSpark={pingSpark}
        pingLoss={pingLoss}
        pingStats={pingStats}
      />
    </div>
  )
}

export const NodeCard = memo(NodeCard_)
