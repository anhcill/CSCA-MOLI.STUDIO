import axios from '@/lib/utils/axios';

export interface OutboxOpsItem {
  id: number;
  event_id: string;
  idempotency_key: string;
  correlation_id: string | null;
  event_type: string;
  aggregate_id: string;
  status: string;
  remote_status: string | null;
  remote_inbox_id: number | null;
  attempt_count: number;
  max_attempts: number;
  next_retry_at: string | null;
  sent_at: string | null;
  remote_processed_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  user_id: number | null;
  transaction_id: number | null;
  entitlement_id: number | null;
  external_grant_id: string | null;
  external_course_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConflictOpsItem {
  id: number;
  source_system: string;
  conflict_type: string;
  status: string;
  external_user_id: string | null;
  external_course_id: string | null;
  external_grant_id: string | null;
  candidate_user_id: number | null;
  existing_user_id: number | null;
  local_course_id: number | null;
  email_hint: string | null;
  correlation_id: string | null;
  reason: string;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface CourseMappingItem {
  id: number;
  sourceSystem: string;
  externalCourseId: string;
  localCourseId: number;
  localCourseTitle: string | null;
  localCourseSlug: string | null;
  localVideoPackageId: number | null;
  status: string;
  notes: string | null;
  metadata: Record<string, unknown>;
  updatedAt: string;
}

export interface UnmappedCourseItem {
  local_course_id: number;
  local_course_title: string | null;
  local_course_slug: string | null;
  video_package_id: number;
  video_package_name: string | null;
}

export interface ReconciliationActionItem {
  id: number;
  category: string;
  action_taken: string;
  source_system: string;
  user_id: number | null;
  local_course_id: number | null;
  external_user_id: string | null;
  external_course_id: string | null;
  external_grant_id: string | null;
  outbox_id: number | null;
  conflict_id: number | null;
  details: Record<string, unknown>;
}

export interface ReconciliationRunItem {
  id: number;
  correlation_id: string;
  trigger_mode: string;
  dry_run: boolean;
  status: string;
  summary_counts: Record<string, unknown>;
  last_error_code: string | null;
  last_error_message: string | null;
  started_at: string;
  completed_at: string | null;
  actions?: ReconciliationActionItem[];
}

export type ReconciliationDomain = 'entitlement' | 'content' | 'progress';

export interface KillSwitchesOverview {
  global?: boolean;
  contentSync?: boolean;
  delegatedLearning?: boolean;
  mutationsRepair?: boolean;
  globalKillSwitchActive?: boolean;
  contentSyncKillSwitchActive?: boolean;
  delegatedLearningKillSwitchActive?: boolean;
  mutationsRepairKillSwitchActive?: boolean;
}

export interface V2InboxAttentionItem {
  id: number;
  event_id: string;
  event_type: string;
  aggregate_type?: string | null;
  aggregate_id?: string | null;
  aggregate_revision?: number | string | null;
  status: string;
  attempt_count: number;
  last_error_code?: string | null;
  last_error_message?: string | null;
  received_at?: string | null;
  created_at?: string | null;
  next_retry_at?: string | null;
}

export interface SyncCheckpointItem {
  stream_name: string;
  source_system?: string;
  high_water_revision?: number | string | null;
  last_cursor?: string | null;
  last_synced_at?: string | null;
  sync_status?: string;
  last_error_code?: string | null;
  last_error_message?: string | null;
}

export interface ReconcileOptions {
  dryRun?: boolean;
  dispatchRepairs?: boolean;
  domains?: ReconciliationDomain[];
  userIds?: number[];
  courseIds?: number[];
  profileIds?: string[];
  limit?: number;
}

export interface RetrySubjectPayload {
  userId?: number;
  externalUserId?: string;
  courseId?: number;
  profileId?: string;
  domains?: ReconciliationDomain[];
  dryRun?: boolean;
}

export interface ContractProbeResult {
  healthy?: boolean;
  ok?: boolean;
  ready?: boolean;
  status?: string;
  correlationId?: string;
  checkedAt?: string;
  contractVersion?: string;
  local?: Record<string, unknown>;
  remote?: Record<string, unknown>;
  courseService?: Record<string, unknown>;
  molyService?: Record<string, unknown>;
  handshake?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface IntegrationOpsOverview {
  killSwitchActive: boolean;
  killSwitches?: KillSwitchesOverview;
  rolloutFlags?: Record<string, boolean | string | number>;
  metrics: {
    killSwitchActive: boolean;
    counters: Record<string, number>;
    latencies: Record<string, { count: number; avgMs: number; maxMs: number; lastMs: number }>;
  };
  outboxCounts: Record<string, number>;
  stalePendingCount: number;
  conflictCounts: Record<string, number>;
  v2InboxCounts?: Record<string, number>;
  v2InboxAttentionItems?: V2InboxAttentionItem[];
  checkpoints?: SyncCheckpointItem[];
  outboxItems: OutboxOpsItem[];
  recentOutbox?: OutboxOpsItem[];
  conflicts: ConflictOpsItem[];
  recentConflicts?: ConflictOpsItem[];
  courseMappings: CourseMappingItem[];
  unmappedCourses: UnmappedCourseItem[];
  reconciliationRuns: ReconciliationRunItem[];
  latestReconciliationRun?: ReconciliationRunItem | null;
}

export const courseIntegrationOpsApi = {
  getOverview: async (limit = 50): Promise<IntegrationOpsOverview> =>
    (await axios.get<{ data: IntegrationOpsOverview }>('/admin/course-integrations/ops/overview', { params: { limit } })).data.data,

  retryOutbox: async (outboxId: number, dispatchNow = true) =>
    (await axios.post(`/admin/course-integrations/outbox/${outboxId}/retry`, { dispatchNow })).data.data,

  syncOutbox: async (limit = 25) =>
    (await axios.post('/admin/course-integrations/outbox/sync', { limit })).data.data,

  runReconciliation: async (options: boolean | ReconcileOptions = true) => {
    const opts: ReconcileOptions = typeof options === 'boolean'
      ? { dryRun: options, dispatchRepairs: !options }
      : {
          dryRun: options.dryRun ?? true,
          dispatchRepairs: options.dispatchRepairs ?? !(options.dryRun ?? true),
          ...(options.domains && options.domains.length > 0 ? { domains: options.domains } : {}),
          ...(options.userIds && options.userIds.length > 0 ? { userIds: options.userIds } : {}),
          ...(options.courseIds && options.courseIds.length > 0 ? { courseIds: options.courseIds } : {}),
          ...(options.profileIds && options.profileIds.length > 0 ? { profileIds: options.profileIds } : {}),
          ...(options.limit ? { limit: options.limit } : {}),
        };
    return (await axios.post('/admin/course-integrations/reconcile', opts)).data.data;
  },

  retryV2InboxItem: async (id: number) =>
    (await axios.post(`/admin/course-integrations/catalog/inbox/${id}/retry`)).data.data,

  runCatalogBackfill: async (payload: { full?: boolean; reset?: boolean; limit?: number } = {}) =>
    (await axios.post('/admin/course-integrations/catalog/backfill', {
      full: Boolean(payload.full),
      reset: payload.reset ?? Boolean(payload.full),
      ...(payload.limit ? { limit: payload.limit } : {}),
    })).data.data,

  runCurriculumBackfill: async (
    courseId: number | string,
    payload: { remote?: boolean; remoteCourseId?: string | null; profileId?: string | null; limit?: number } = {},
  ) =>
    (
      await axios.post(
        `/admin/course-integrations/catalog/courses/${encodeURIComponent(String(courseId))}/curriculum/backfill`,
        payload,
      )
    ).data.data,

  retrySubject: async (payload: RetrySubjectPayload) =>
    (await axios.post('/admin/course-integrations/ops/retry-subject', payload)).data.data,

  probeContract: async (): Promise<ContractProbeResult> =>
    (await axios.get<{ data: ContractProbeResult }>('/admin/course-integrations/ops/contract-probe')).data.data,

  resolveConflict: async (
    conflictId: number,
    payload: { action: 'resolved' | 'dismissed' | 'ignored' | 'link_existing'; targetUserId?: number | null; resolutionNote?: string },
  ) => (await axios.post(`/admin/course-integrations/conflicts/${conflictId}/resolve`, payload)).data.data,

  upsertMapping: async (payload: {
    sourceSystem: string;
    externalCourseId: string;
    localCourseId: number;
    status?: string;
    notes?: string;
    metadata?: Record<string, unknown>;
  }) => (await axios.post('/admin/course-integrations/course-mappings', payload)).data.data,

  updateMappingStatus: async (id: number, status: 'active' | 'inactive' | 'archived') =>
    (await axios.patch(`/admin/course-integrations/course-mappings/${id}/status`, { status })).data.data,
};
