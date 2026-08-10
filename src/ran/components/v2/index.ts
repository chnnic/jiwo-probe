/**
 * v2 components — atomic building blocks for the v2.0 redesign.
 *
 * Each component here is a small, self-contained piece. Pages compose them.
 */

export { StatusStripe } from './StatusStripe'
export { HealthScoreCard } from './HealthScoreCard'
export { AggregateBar } from './AggregateBar'
export { CardStyleSwitcher, useNodeCardStyle } from './CardStyleSwitcher'
export type { NodeCardStyle } from './CardStyleSwitcher'
export { MultiFilterRow } from './MultiFilterRow'
export type { FilterOption, FilterSpec } from './MultiFilterRow'
export { NodeDetailDrawer } from './NodeDetailDrawer'
export { RegionDistributionDonut } from './RegionDistributionDonut'
export { AttentionNeededTable } from './AttentionNeededTable'
export { GlobalThroughput24hChart } from './GlobalThroughput24hChart'
export type { ThroughputView } from './GlobalThroughput24hChart'
export { HealthTrend7DChart } from './HealthTrend7DChart'
export { AlertSummaryPanel } from './AlertSummaryPanel'
export { RecentEventsPanel } from './RecentEventsPanel'
export { NodeCardCompactV2 } from './NodeCardCompactV2'
export { NodeCardClassic } from './NodeCardClassic'
export { NodeCard } from './NodeCard'
export { SummaryStatCard } from './SummaryStatCard'
export {
  ActiveAlertsCard,
  ThroughputSummaryCard,
  AvgPacketLossCard,
  ExpiringSoonCard,
} from './SummaryCards'
export { SystemHealthPanel } from './SystemHealthPanel'
export { NetworkLossHeatmap } from './NetworkLossHeatmap'
export { SystemStatusFooter } from './SystemStatusFooter'
export { PanelFooterLink } from './PanelFooterLink'
export { NodeRowTable } from './NodeRowTable'
export { ViewModeSwitcher, useNodeViewMode } from './ViewModeSwitcher'
export type { NodeViewMode } from './ViewModeSwitcher'
export { NodesPageActionBar } from './NodesPageActionBar'
export { NodeDetailSidePanel } from './NodeDetailSidePanel'
export { TimeWindowSwitcher, DEFAULT_TIME_WINDOWS } from './TimeWindowSwitcher'
export type { TimeWindowOption } from './TimeWindowSwitcher'
