/**
 * useRecentEvents — derive "RECENT EVENTS" from node status transitions.
 *
 * Komari has no native event log, so we derive events by diffing snapshots:
 *   - online → offline    = '节点离线'
 *   - offline → online    = '节点恢复在线'
 *   - good → degraded     = '节点进入降级'
 *   - degraded → good     = '节点恢复正常'
 *
 * Events are kept in localStorage (so they survive page reload) and capped
 * at `maxEvents` per session.
 *
 * Storage shape:
 *   ran.v2.recentEvents = [{ t, uuid, name, kind, message }, ...]
 *
 * The hook returns the list sorted newest-first.
 */

import { useEffect, useState } from 'react'
import type { KomariNode, KomariRecord } from '@/types/komari'
import { isRecordDegraded } from './useAggregateStats'

export type EventKind = 'down' | 'up' | 'degraded' | 'recovered'

export interface NodeEvent {
  t: number          // epoch ms
  uuid: string
  name: string
  kind: EventKind
  message: string    // human-readable, e.g. "节点恢复在线"
}

const STORAGE_KEY = 'ran.v2.recentEvents'
const DEFAULT_MAX_EVENTS = 50
const DEFAULT_RETENTION_MS = 24 * 60 * 60 * 1000  // 24h

interface PerNodeState {
  online: boolean
  degraded: boolean
}

function loadEvents(): NodeEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.filter(
      (e) =>
        e &&
        typeof e.t === 'number' &&
        typeof e.uuid === 'string' &&
        typeof e.kind === 'string' &&
        typeof e.message === 'string',
    )
  } catch {
    return []
  }
}

function saveEvents(events: NodeEvent[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  } catch {
    // ignore
  }
}

function describe(kind: EventKind): string {
  switch (kind) {
    case 'down': return '节点离线'
    case 'up': return '节点恢复在线'
    case 'degraded': return '节点进入降级'
    case 'recovered': return '节点恢复正常'
  }
}

export interface UseRecentEventsOptions {
  maxEvents?: number
  retentionMs?: number
}

export function useRecentEvents(
  nodes: KomariNode[],
  records: Record<string, KomariRecord>,
  options: UseRecentEventsOptions = {},
): NodeEvent[] {
  const maxEvents = options.maxEvents ?? DEFAULT_MAX_EVENTS
  const retentionMs = options.retentionMs ?? DEFAULT_RETENTION_MS
  const [events, setEvents] = useState<NodeEvent[]>(() => loadEvents())

  // Per-node prior state, retained across renders
  const [priorState] = useState<Record<string, PerNodeState>>({})

  useEffect(() => {
    const now = Date.now()
    const cutoff = now - retentionMs
    const newEvents: NodeEvent[] = []

    for (const node of nodes) {
      const r = records[node.uuid]
      const isOnline = !!r?.online
      const isDegraded = isOnline && isRecordDegraded(r)
      const prior = priorState[node.uuid]
      const name = node.name ?? node.uuid.slice(0, 8)

      // First time seeing this node — just record state, don't emit event
      if (!prior) {
        priorState[node.uuid] = { online: isOnline, degraded: isDegraded }
        continue
      }

      // Online state transition
      if (prior.online !== isOnline) {
        const kind: EventKind = isOnline ? 'up' : 'down'
        newEvents.push({
          t: now,
          uuid: node.uuid,
          name,
          kind,
          message: describe(kind),
        })
      } else if (isOnline) {
        // Online both before and after — check degraded transition
        if (prior.degraded !== isDegraded) {
          const kind: EventKind = isDegraded ? 'degraded' : 'recovered'
          newEvents.push({
            t: now,
            uuid: node.uuid,
            name,
            kind,
            message: describe(kind),
          })
        }
      }

      priorState[node.uuid] = { online: isOnline, degraded: isDegraded }
    }

    if (newEvents.length === 0) {
      // Even if no new events, evict expired from storage occasionally
      const filtered = events.filter((e) => e.t >= cutoff)
      if (filtered.length !== events.length) {
        setEvents(filtered)
        saveEvents(filtered)
      }
      return
    }

    // Merge new events (newest first) and trim
    const merged = [...newEvents, ...events]
      .filter((e) => e.t >= cutoff)
      .sort((a, b) => b.t - a.t)
      .slice(0, maxEvents)

    setEvents(merged)
    saveEvents(merged)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, records, maxEvents, retentionMs])

  return events
}
