/**
 * V2DemoPage — preview of the v2.0 redesign at #/v2.
 *
 * Includes every v2 atomic component wired against real Komari data:
 *  - StatusStripe (top)
 *  - HealthScoreCard + RegionDistributionDonut (row 1)
 *  - GlobalThroughput24hChart (full width)
 *  - AlertSummaryPanel + RecentEventsPanel (row 3)
 *  - AttentionNeededTable + HealthTrend7DChart (row 4)
 *  - AggregateBar + MultiFilterRow + NodeDetailDrawer (Nodes preview)
 *
 * Clicking a row in AttentionNeededTable opens NodeDetailDrawer for that
 * node. This validates the drawer end-to-end before the real Nodes page
 * is built.
 *
 * This page will be deleted once the real v2 pages land.
 */

import { useMemo, useState } from 'react'
import type { PingHistory } from '@/api/client'
import { Sidebar } from '@/components/panels/Sidebar'
import { Topbar } from '@/components/panels/Topbar'
import { Footer } from '@/components/panels/Footer'
import type { Theme } from '@/components/atoms/ThemePicker'
import type { KomariNode, KomariRecord, KomariPublicConfig } from '@/types/komari'
import { useMobileDrawer } from '@/hooks/useMediaQuery'
import { useGlobalHistory } from '@/hooks/useGlobalHistory'

import {
  useAggregateStats,
  useClusterHealth,
  useDegradedDetection,
  useAttentionNeeded,
  useAlertSummary,
  useRegionDistribution,
  useHealthTrend,
  useRecentEvents,
} from '@/hooks/v2'

import {
  StatusStripe,
  HealthScoreCard,
  AggregateBar,
  CardStyleSwitcher,
  useNodeCardStyle,
  MultiFilterRow,
  type FilterSpec,
  NodeDetailDrawer,
  RegionDistributionDonut,
  AttentionNeededTable,
  GlobalThroughput24hChart,
  HealthTrend7DChart,
  AlertSummaryPanel,
  RecentEventsPanel,
} from '@/components/v2'
import { Etch } from '@/components/atoms/Etch'
import { contentFs } from '@/utils/fontScale'

type Conn = 'connecting' | 'open' | 'closed' | 'error' | 'idle'

interface Props {
  nodes: KomariNode[]
  records: Record<string, KomariRecord>
  theme: Theme
  onTheme: (t: Theme) => void
  siteName?: string
  conn?: Conn
  lastUpdate?: number | null
  ping?: PingHistory
  config?: KomariPublicConfig
  hubTargetUuid?: string
}

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000

export function V2DemoPage({
  nodes,
  records,
  theme,
  onTheme,
  siteName = '岚',
  conn = 'idle',
  lastUpdate,
  hubTargetUuid,
}: Props) {
  // ── Data layer ──
  const stats = useAggregateStats(nodes, records, { expiringWithinDays: 30 })
  const health = useClusterHealth(stats)
  const _degraded = useDegradedDetection(nodes, records)
  const attention = useAttentionNeeded(nodes, records, { topN: 5 })
  const alertSummary = useAlertSummary(nodes, records, { topN: 5 })
  const regions = useRegionDistribution(nodes)
  const trend = useHealthTrend(health.score)
  const events = useRecentEvents(nodes, records)
  const [cardStyle, setCardStyle] = useNodeCardStyle()
  const drawer = useMobileDrawer()

  // 24h history for the throughput chart
  const uuids = useMemo(() => nodes.map((n) => n.uuid), [nodes])
  const history24 = useGlobalHistory(uuids, 24, 60_000)

  // High-load node count for AggregateBar
  const highLoadCount = useMemo(
    () =>
      nodes.filter((n) => {
        const r = records[n.uuid]
        return r?.online && typeof r.load1 === 'number' && r.load1 > 4
      }).length,
    [nodes, records],
  )

  // Yesterday score derived from trend
  const yesterdayScore = useMemo(() => {
    const target = Date.now() - TWENTY_FOUR_HOURS
    let best: { dt: number; score: number } | undefined
    for (const p of trend) {
      const dt = Math.abs(p.t - target)
      if (!best || dt < best.dt) best = { dt, score: p.score }
    }
    return best && best.dt < 6 * 60 * 60 * 1000 ? best.score : undefined
  }, [trend])

  // ── NodeDetailDrawer state ──
  const [drawerUuid, setDrawerUuid] = useState<string | null>(null)
  const drawerNode = drawerUuid ? nodes.find((n) => n.uuid === drawerUuid) ?? null : null
  const drawerRecord = drawerUuid ? records[drawerUuid] : undefined

  // ── MultiFilterRow state ──
  const [filterSearch, setFilterSearch] = useState('')
  const [filterRegion, setFilterRegion] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterGroup, setFilterGroup] = useState('all')

  // Build dropdown option sets from current node set
  const regionOptions = useMemo(() => {
    const set: Record<string, number> = {}
    for (const n of nodes) {
      const k = (n.region ?? '').trim() || 'Unassigned'
      set[k] = (set[k] ?? 0) + 1
    }
    return [
      { value: 'all', label: 'All' },
      ...Object.entries(set)
        .sort((a, b) => b[1] - a[1])
        .map(([k, c]) => ({ value: k, label: k, count: c })),
    ]
  }, [nodes])

  const groupOptions = useMemo(() => {
    const set: Record<string, number> = {}
    for (const n of nodes) {
      const k = (n.group ?? '').trim() || 'Ungrouped'
      set[k] = (set[k] ?? 0) + 1
    }
    return [
      { value: 'all', label: 'All' },
      ...Object.entries(set)
        .sort((a, b) => b[1] - a[1])
        .map(([k, c]) => ({ value: k, label: k, count: c })),
    ]
  }, [nodes])

  const statusOptions = [
    { value: 'all', label: 'All', count: stats.total },
    { value: 'online', label: 'Online', count: stats.online },
    { value: 'degraded', label: 'Degraded', count: stats.degraded },
    { value: 'offline', label: 'Offline', count: stats.offline },
  ]

  const filterSpecs: FilterSpec[] = [
    {
      key: 'region',
      label: 'REGION',
      options: regionOptions,
      value: filterRegion,
      onChange: setFilterRegion,
    },
    {
      key: 'status',
      label: 'STATUS',
      options: statusOptions,
      value: filterStatus,
      onChange: setFilterStatus,
    },
    {
      key: 'group',
      label: 'GROUP',
      options: groupOptions,
      value: filterGroup,
      onChange: setFilterGroup,
    },
  ]

  const isLive = conn === 'open'

  return (
    <div
      style={{
        display: 'flex',
        background: 'var(--bg-0)',
        color: 'var(--fg-0)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <Sidebar
        active="overview"
        version="v2.0-preview"
        mobileOpen={drawer.open}
        onMobileClose={drawer.onClose}
        hubTargetUuid={hubTargetUuid}
      />
      <div
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}
      >
        <Topbar
          title={siteName}
          subtitle={`V2 PREVIEW · ${stats.total} NODES · ${regions.length} REGIONS`}
          theme={theme}
          onTheme={onTheme}
          online={stats.online}
          total={stats.total}
          conn={conn}
          lastUpdate={lastUpdate}
          onMobileMenu={drawer.onOpen}
          nodes={nodes}
          records={records}
        />
        <main
          className="app-main"
          style={{
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* ── Banner ── */}
          <div
            style={{
              padding: '8px 12px',
              border: '1px dashed var(--accent)',
              background: 'rgba(160,104,32,0.04)',
              borderRadius: 4,
              fontFamily: 'var(--font-mono)',
              fontSize: contentFs(10),
              letterSpacing: '0.1em',
              color: 'var(--accent-bright)',
            }}
          >
            ⚙ V2.0 PREVIEW · all atomic components on real WS data. Click
            attention rows to open NodeDetailDrawer. Card style switcher
            persists to localStorage.
          </div>

          {/* ── Section: Overview redesign ── */}
          <SectionHeader>OVERVIEW REDESIGN</SectionHeader>

          <StatusStripe
            stats={stats}
            alertCount={alertSummary.counts.total}
            regionCount={regions.length}
            isLive={isLive}
            lastUpdate={lastUpdate}
          />

          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
          >
            <HealthScoreCard health={health} yesterdayScore={yesterdayScore} />
            <RegionDistributionDonut slices={regions} />
          </div>

          <GlobalThroughput24hChart
            netIn={history24.aggregate.netIn}
            netOut={history24.aggregate.netOut}
            totalIn={stats.totalNetDown}
            totalOut={stats.totalNetUp}
            windowLabel="Last 24h"
          />

          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
          >
            <AlertSummaryPanel
              summary={alertSummary}
              onAlertClick={(uuid) => setDrawerUuid(uuid)}
            />
            <RecentEventsPanel
              events={events}
              onEventClick={(uuid) => setDrawerUuid(uuid)}
            />
          </div>

          <div
            style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}
          >
            <AttentionNeededTable
              items={attention}
              onNodeClick={(uuid) => setDrawerUuid(uuid)}
            />
            <HealthTrend7DChart points={trend} currentScore={health.score} />
          </div>

          {/* ── Section: Nodes redesign ── */}
          <SectionHeader>NODES REDESIGN</SectionHeader>

          <AggregateBar stats={stats} highLoadCount={highLoadCount} />

          <MultiFilterRow
            searchQuery={filterSearch}
            onSearchChange={setFilterSearch}
            filters={filterSpecs}
            meta={`SHOWN ${stats.total}/${stats.total}`}
            onRefresh={() => {
              /* placeholder */
            }}
          />

          <div
            style={{
              padding: '14px 18px',
              fontFamily: 'var(--font-mono)',
              fontSize: contentFs(11),
              color: 'var(--fg-2)',
              border: '1px dashed var(--edge-engrave)',
              borderRadius: 4,
              textAlign: 'center',
            }}
          >
            <span style={{ color: 'var(--fg-3)' }}>NODE CARDS WILL RENDER HERE — </span>
            current style:{' '}
            <span style={{ color: 'var(--accent-bright)', fontWeight: 500 }}>
              {cardStyle.toUpperCase()}
            </span>
            <span style={{ marginLeft: 12 }}>
              <CardStyleSwitcher value={cardStyle} onChange={setCardStyle} />
            </span>
          </div>

          {/* ── Debug ── */}
          <details className="precision-card" style={{ padding: '12px 16px' }}>
            <summary
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: contentFs(10),
                letterSpacing: '0.14em',
                color: 'var(--fg-2)',
                cursor: 'pointer',
              }}
            >
              ▸ DEBUG · v2 DERIVED STATE
            </summary>
            <pre
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: contentFs(10),
                color: 'var(--fg-2)',
                whiteSpace: 'pre-wrap',
                margin: '10px 0 0',
                overflowX: 'auto',
              }}
            >
{JSON.stringify(
  {
    stats: {
      ...stats,
      avgCpu: stats.avgCpu?.toFixed(1),
      avgMem: stats.avgMem?.toFixed(1),
      avgDisk: stats.avgDisk?.toFixed(1),
      avgLoad: stats.avgLoad?.toFixed(2),
      avgPing: stats.avgPing?.toFixed(0),
      avgLoss: stats.avgLoss?.toFixed(4),
    },
    health,
    attentionCount: attention.length,
    trendPoints: trend.length,
    eventCount: events.length,
    highLoadCount,
    cardStyle,
    yesterdayScore,
    history24Loading: history24.loading,
  },
  null,
  2,
)}
            </pre>
          </details>
        </main>
        <Footer version="v2.0-preview" />
      </div>

      {/* NodeDetailDrawer */}
      <NodeDetailDrawer
        node={drawerNode}
        record={drawerRecord}
        onClose={() => setDrawerUuid(null)}
      />
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginTop: 8,
        marginBottom: -2,
      }}
    >
      <Etch>{children}</Etch>
      <div
        style={{
          flex: 1,
          height: 1,
          background:
            'linear-gradient(to right, var(--edge-engrave), transparent)',
        }}
      />
    </div>
  )
}
