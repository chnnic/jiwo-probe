/**
 * v2 hooks — data layer for the v2.0 redesign.
 *
 * All hooks here are *pure derivations* on top of useKomari() output.
 * Components import from '@/hooks/v2' as a single entrypoint.
 */

export { useAggregateStats, isRecordDegraded } from './useAggregateStats'
export type { AggregateStats, UseAggregateStatsOptions } from './useAggregateStats'

export { useClusterHealth, gradeFor } from './useClusterHealth'
export type { ClusterHealth, HealthGrade } from './useClusterHealth'

export { useDegradedDetection } from './useDegradedDetection'
export type { DegradedInfo, UseDegradedDetectionOptions } from './useDegradedDetection'

export { useAttentionNeeded } from './useAttentionNeeded'
export type {
  AttentionItem,
  AttentionSeverity,
  UseAttentionNeededOptions,
} from './useAttentionNeeded'

export { useHealthTrend } from './useHealthTrend'
export type { TrendPoint, UseHealthTrendOptions } from './useHealthTrend'

export { useRecentEvents } from './useRecentEvents'
export type { NodeEvent, EventKind, UseRecentEventsOptions } from './useRecentEvents'

export { useRegionDistribution } from './useRegionDistribution'
export type { RegionSlice, UseRegionDistributionOptions } from './useRegionDistribution'

export { useAlertSummary } from './useAlertSummary'
export type {
  AlertItem,
  AlertLevel,
  AlertSummary,
  UseAlertSummaryOptions,
} from './useAlertSummary'

export { useAlertHistory } from './useAlertHistory'
export type { UseAlertHistoryOptions } from './useAlertHistory'

export { useMetricHistory } from './useMetricHistory'
export type {
  MetricHistoryResult,
  UseMetricHistoryOptions,
} from './useMetricHistory'
