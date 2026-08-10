/**
 * NodeCardClassic — re-export of the original NodeCardCompact, surfaced
 * under the v2 namespace so consumers can pick a card style by import.
 *
 *   import { NodeCardClassic, NodeCardCompactV2 } from '@/components/v2'
 *
 * No behavior change — the existing card is the "classic" v1 design,
 * preserved verbatim for users who prefer the higher-information cards.
 */

export { NodeCardCompact as NodeCardClassic } from '@/components/cards/NodeCardCompact'
