'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiActivity,
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiDatabase,
  FiLink,
  FiPlay,
  FiRefreshCw,
  FiServer,
  FiShield,
} from 'react-icons/fi';
import AdminLayout from '@/components/layout/AdminLayout';
import {
  courseIntegrationOpsApi,
  type ConflictOpsItem,
  type ContractProbeResult,
  type IntegrationOpsOverview,
  type OutboxOpsItem,
  type ReconciliationDomain,
  type ReconciliationRunItem,
  type SyncCheckpointItem,
  type V2InboxAttentionItem,
} from '@/lib/api/courseIntegration';

type OpsTab = 'outbox' | 'inbox_sync' | 'conflicts' | 'mappings' | 'reconciliation';

const RECON_DOMAINS: ReconciliationDomain[] = ['entitlement', 'content', 'progress'];

function extractErrMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { message?: string } }; message?: string };
  return anyErr?.response?.data?.message || anyErr?.message || fallback;
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toLocaleString('vi-VN');
}

function toggleDomainItem(list: ReconciliationDomain[], domain: ReconciliationDomain): ReconciliationDomain[] {
  return list.includes(domain) ? list.filter((d) => d !== domain) : [...list, domain];
}

function sanitizeProbePayload(value: unknown, depth = 0): unknown {
  if (depth > 5 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeProbePayload(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (/secret|token|password|apikey|private_?key|signature|authorization/i.test(k)) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = sanitizeProbePayload(v, depth + 1);
    }
  }
  return out;
}

export default function AdminCourseIntegrationOps() {
  const [overview, setOverview] = useState<IntegrationOpsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [tab, setTab] = useState<OpsTab>('outbox');
  const [outboxFilter, setOutboxFilter] = useState<string>('all');
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [probeResult, setProbeResult] = useState<ContractProbeResult | null>(null);

  const [extCourseId, setExtCourseId] = useState('');
  const [localCourseId, setLocalCourseId] = useState('');
  const [mappingNotes, setMappingNotes] = useState('');
  const [targetUserByConflict, setTargetUserByConflict] = useState<Record<number, string>>({});

  const [backfillFull, setBackfillFull] = useState(false);
  const [curriculumCourseId, setCurriculumCourseId] = useState('');
  const [curriculumRemoteCourseId, setCurriculumRemoteCourseId] = useState('');
  const [curriculumProfileId, setCurriculumProfileId] = useState('');

  const [reconDomains, setReconDomains] = useState<ReconciliationDomain[]>([]);
  const [subjectUserId, setSubjectUserId] = useState('');
  const [subjectExternalUserId, setSubjectExternalUserId] = useState('');
  const [subjectCourseId, setSubjectCourseId] = useState('');
  const [subjectProfileId, setSubjectProfileId] = useState('');
  const [subjectDomains, setSubjectDomains] = useState<ReconciliationDomain[]>([]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const data = await courseIntegrationOpsApi.getOverview(80);
      setOverview(data);
    } catch (err) {
      setBanner({ type: 'err', text: extractErrMessage(err, 'Không tải được dữ liệu vận hành tích hợp.') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const outboxRows = useMemo(
    () => overview?.outboxItems ?? overview?.recentOutbox ?? [],
    [overview],
  );

  const conflictRows = useMemo(
    () => overview?.conflicts ?? overview?.recentConflicts ?? [],
    [overview],
  );

  const v2InboxItems = useMemo(
    () => overview?.v2InboxAttentionItems ?? [],
    [overview],
  );

  const checkpoints = useMemo(
    () => overview?.checkpoints ?? [],
    [overview],
  );

  const filteredOutbox = useMemo(() => {
    if (outboxFilter === 'all') return outboxRows;
    return outboxRows.filter((r) => r.status === outboxFilter);
  }, [outboxRows, outboxFilter]);

  const handleAction = async (key: string, fn: () => Promise<void>, successMsg: string) => {
    setBusyKey(key);
    setBanner(null);
    try {
      await fn();
      setBanner({ type: 'ok', text: successMsg });
      await loadOverview();
    } catch (err) {
      setBanner({ type: 'err', text: extractErrMessage(err, 'Thao tác thất bại.') });
    } finally {
      setBusyKey(null);
    }
  };

  const handleProbeContract = async () => {
    setBusyKey('probe-contract');
    setBanner(null);
    try {
      const res = await courseIntegrationOpsApi.probeContract();
      setProbeResult(sanitizeProbePayload(res) as ContractProbeResult);
      const remoteContract = (res?.remote as { contract?: { contractVersion?: string } } | undefined)?.contract;
      const version = res?.contractVersion ?? remoteContract?.contractVersion;
      const healthy = Boolean(res?.healthy ?? res?.ok ?? res?.ready ?? (res?.status === 'ok' || res?.status === 'healthy'));
      setBanner({
        type: healthy ? 'ok' : 'err',
        text: healthy
          ? `Contract handshake sẵn sàng${version ? ` (version: ${version})` : ''}.`
          : 'Contract handshake chưa sẵn sàng hoặc Course/Moly health không đạt.',
      });
    } catch (err) {
      setBanner({ type: 'err', text: extractErrMessage(err, 'Không thực hiện được Contract Handshake Probe.') });
    } finally {
      setBusyKey(null);
    }
  };

  const handleRetrySubject = async (dryRun: boolean) => {
    const userId = subjectUserId.trim() ? Number(subjectUserId.trim()) : undefined;
    const courseId = subjectCourseId.trim() ? Number(subjectCourseId.trim()) : undefined;
    const externalUserId = subjectExternalUserId.trim() || undefined;
    const profileId = subjectProfileId.trim() || undefined;

    if (!userId && !externalUserId && !courseId && !profileId) {
      setBanner({ type: 'err', text: 'Vui lòng nhập ít nhất một định danh (userId, externalUserId, courseId hoặc profileId).' });
      return;
    }

    await handleAction(
      `retry-subject-${dryRun ? 'dry' : 'run'}`,
      () =>
        courseIntegrationOpsApi
          .retrySubject({
            ...(userId && Number.isFinite(userId) ? { userId } : {}),
            ...(externalUserId ? { externalUserId } : {}),
            ...(courseId && Number.isFinite(courseId) ? { courseId } : {}),
            ...(profileId ? { profileId } : {}),
            ...(subjectDomains.length > 0 ? { domains: subjectDomains } : {}),
            dryRun,
          })
          .then(() => undefined),
      dryRun
        ? 'Đã hoàn tất Dry-Run kiểm tra theo subject.'
        : 'Đã kích hoạt sửa lỗi / đồng bộ lại theo subject.',
    );
  };

  const globalKill = Boolean(
    overview?.killSwitches?.global
    ?? overview?.killSwitches?.globalKillSwitchActive
    ?? overview?.killSwitchActive,
  );
  const contentSyncKill = Boolean(
    overview?.killSwitches?.contentSync
    ?? overview?.killSwitches?.contentSyncKillSwitchActive,
  );
  const delegatedLearningKill = Boolean(
    overview?.killSwitches?.delegatedLearning
    ?? overview?.killSwitches?.delegatedLearningKillSwitchActive,
  );
  const mutationsRepairKill = Boolean(
    overview?.killSwitches?.mutationsRepair
    ?? overview?.killSwitches?.mutationsRepairKillSwitchActive,
  );
  const anyKillSwitchActive = globalKill || contentSyncKill || delegatedLearningKill || mutationsRepairKill;

  const pendingOrFailedCount = (overview?.outboxCounts?.pending || 0)
    + (overview?.outboxCounts?.processing || 0)
    + (overview?.outboxCounts?.failed || 0);
  const deadLetterCount = overview?.outboxCounts?.dead_letter || 0;
  const openConflictCount = (overview?.conflictCounts?.open || 0) + (overview?.conflictCounts?.in_review || 0);
  const unmappedCount = overview?.unmappedCourses?.length || 0;
  const v2InboxPendingCount = (overview?.v2InboxCounts?.pending || 0)
    + (overview?.v2InboxCounts?.failed || 0)
    + (overview?.v2InboxCounts?.dead_letter || 0);
  const v2InboxAttentionCount = Math.max(v2InboxItems.length, v2InboxPendingCount);

  const rolloutEntries = Object.entries(overview?.rolloutFlags || {});
  const latestRun = overview?.latestReconciliationRun ?? overview?.reconciliationRuns?.[0] ?? null;

  return (
    <AdminLayout
      title="Vận hành Đồng bộ Moly ↔ CSCA-Course"
      description="Theo dõi hàng đợi Outbox, v2 Sync Inbox, Checkpoints, xung đột danh tính, course mapping và đối soát đa chiều."
    >
      <div className="space-y-6">
        {anyKillSwitchActive && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 flex items-start gap-3 text-rose-700 dark:text-rose-300">
            <FiAlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-sm font-medium space-y-1">
              <div>
                <strong>EMERGENCY KILL SWITCH ĐANG BẬT:</strong> Một hoặc nhiều nhánh tích hợp đang được khóa an toàn (fail-closed) bởi biến môi trường.
              </div>
              <div className="text-xs font-mono">
                global={String(globalKill)} · content_sync={String(contentSyncKill)} · delegated_learning={String(delegatedLearningKill)} · mutations_repair={String(mutationsRepairKill)}
              </div>
            </div>
          </div>
        )}

        {/* Split Kill Switches & Rollout Flags Posture */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Kill Switches & Rollout Flags (Fail-Closed Consumer Posture)
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
              {[
                { label: 'Global', active: globalKill },
                { label: 'Content Sync', active: contentSyncKill },
                { label: 'Delegated Learning', active: delegatedLearningKill },
                { label: 'Mutations / Repair', active: mutationsRepairKill },
              ].map((sw) => (
                <span
                  key={sw.label}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 border ${
                    sw.active
                      ? 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                      : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  }`}
                >
                  {sw.label}: {sw.active ? 'LOCKED' : 'OPEN'}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-gray-500 font-semibold">Rollout Flags:</span>
            {rolloutEntries.length > 0 ? (
              rolloutEntries.map(([flag, val]) => (
                <span
                  key={flag}
                  className={`rounded-md border px-2 py-0.5 font-mono ${
                    val === true || val === 'true'
                      ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                      : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {flag}={String(val)}
                </span>
              ))
            ) : (
              <span className="text-gray-400">Chưa có rolloutFlags chi tiết từ backend (mặc định fail-closed).</span>
            )}
          </div>

          {probeResult && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60 p-3 space-y-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold flex items-center gap-2">
                  <FiServer className="w-4 h-4 text-indigo-500" />
                  <span>Contract Handshake Probe:</span>
                  <span
                    className={
                      Boolean(probeResult.healthy ?? probeResult.ok ?? probeResult.ready ?? (probeResult.status === 'ok' || probeResult.status === 'healthy'))
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }
                  >
                    {probeResult.status || (probeResult.healthy || probeResult.ok || probeResult.ready ? 'READY' : 'DEGRADED')}
                  </span>
                  {(probeResult.contractVersion ?? (probeResult.remote as { contract?: { contractVersion?: string } } | undefined)?.contract?.contractVersion) && (
                    <span className="font-mono text-[11px] text-gray-500">
                      v={String(probeResult.contractVersion ?? (probeResult.remote as { contract?: { contractVersion?: string } } | undefined)?.contract?.contractVersion)}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setProbeResult(null)}
                  className="text-[11px] font-semibold text-gray-500 hover:underline"
                >
                  Ẩn kết quả
                </button>
              </div>
              <pre className="font-mono text-[11px] overflow-x-auto max-h-48">
                {JSON.stringify(probeResult, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {banner && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm font-medium ${
              banner.type === 'ok'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
            }`}
          >
            {banner.text}
          </div>
        )}

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                handleAction(
                  'recon-dry',
                  () =>
                    courseIntegrationOpsApi
                      .runReconciliation({ dryRun: true, ...(reconDomains.length > 0 ? { domains: reconDomains } : {}) })
                      .then(() => undefined),
                  'Đã hoàn tất chạy đối soát kiểm tra (Dry-Run).',
                )
              }
              disabled={busyKey !== null}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              <FiActivity className="w-4 h-4" />
              Chạy Đối soát Dry-Run
            </button>

            <button
              type="button"
              onClick={() =>
                handleAction(
                  'recon-repair',
                  () =>
                    courseIntegrationOpsApi
                      .runReconciliation({ dryRun: false, ...(reconDomains.length > 0 ? { domains: reconDomains } : {}) })
                      .then(() => undefined),
                  'Đã chạy đối soát & tự động sửa lệch rõ ràng.',
                )
              }
              disabled={busyKey !== null || globalKill || mutationsRepairKill}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              <FiPlay className="w-4 h-4" />
              Đối soát & Tự sửa lệch
            </button>

            <button
              type="button"
              onClick={() =>
                handleAction(
                  'sync-outbox',
                  () => courseIntegrationOpsApi.syncOutbox(25).then(() => undefined),
                  'Đã kích hoạt xử lý hàng đợi Outbox.',
                )
              }
              disabled={busyKey !== null || globalKill || mutationsRepairKill}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              <FiCheckCircle className="w-4 h-4" />
              Đẩy Outbox ngay
            </button>

            <button
              type="button"
              onClick={handleProbeContract}
              disabled={busyKey !== null}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3.5 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20 disabled:opacity-50"
            >
              <FiServer className="w-4 h-4" />
              Contract Handshake Probe
            </button>
          </div>

          <button
            type="button"
            onClick={loadOverview}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 px-3.5 py-2 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase">Hàng đợi Chờ / Lỗi</div>
            <div className="text-2xl font-bold mt-2">{pendingOrFailedCount}</div>
            <div className="text-xs text-gray-400 mt-1">Stale &gt; 10 phút: {overview?.stalePendingCount ?? 0}</div>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase">Dead-Letter (DLQ)</div>
            <div className="text-2xl font-bold text-rose-500 mt-2">{deadLetterCount}</div>
            <div className="text-xs text-gray-400 mt-1">Cần rà soát & thử lại thủ công</div>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase">v2 Inbox / Checkpoints</div>
            <div className="text-2xl font-bold text-indigo-500 mt-2">{v2InboxAttentionCount}</div>
            <div className="text-xs text-gray-400 mt-1">{checkpoints.length} stream checkpoints</div>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase">Xung đột Danh tính</div>
            <div className="text-2xl font-bold text-amber-500 mt-2">{openConflictCount}</div>
            <div className="text-xs text-gray-400 mt-1">Không bao giờ tự động gộp</div>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase">Khóa học chưa Map</div>
            <div className="text-2xl font-bold mt-2">{unmappedCount}</div>
            <div className="text-xs text-gray-400 mt-1">Mapping thủ công 1-1</div>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase">S2S HTTP Latency</div>
            <div className="text-2xl font-bold mt-2">
              {overview?.metrics?.latencies?.['moly.client.http_ms']?.avgMs ?? 0} ms
            </div>
            <div className="text-xs text-gray-400 mt-1">
              OK: {overview?.metrics?.counters?.['moly.client.http_ok'] ?? 0} · Err: {overview?.metrics?.counters?.['moly.client.http_error'] ?? 0}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-800 pb-2">
          {([
            ['outbox', `Hàng đợi Outbox (${outboxRows.length})`, FiClock],
            ['inbox_sync', `v2 Sync Inbox & Checkpoints (${v2InboxAttentionCount})`, FiDatabase],
            ['conflicts', `Xung đột Danh tính (${openConflictCount})`, FiShield],
            ['mappings', `Course Mapping & Thiếu Map (${unmappedCount})`, FiLink],
            ['reconciliation', `Đối soát & Khôi phục (${overview?.reconciliationRuns?.length || 0})`, FiActivity],
          ] as Array<[OpsTab, string, typeof FiClock]>).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                tab === id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content: Outbox */}
        {tab === 'outbox' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {['all', 'pending', 'failed', 'dead_letter', 'sent'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setOutboxFilter(st)}
                  className={`px-3 py-1 rounded-md text-xs font-medium ${
                    outboxFilter === st
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {st.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800/60 text-left uppercase text-gray-500">
                  <tr>
                    <th className="p-3">ID / Event</th>
                    <th className="p-3">Trạng thái</th>
                    <th className="p-3">Thử</th>
                    <th className="p-3">Correlation ID</th>
                    <th className="p-3">Lỗi cuối</th>
                    <th className="p-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {filteredOutbox.map((item: OutboxOpsItem) => {
                    const retryable = ['failed', 'dead_letter', 'pending', 'sent'].includes(item.status)
                      && !(item.status === 'sent' && item.remote_status === 'processed');
                    return (
                      <tr key={item.id}>
                        <td className="p-3">
                          <div className="font-semibold">#{item.id} · {item.event_type}</div>
                          <div className="font-mono text-[11px] text-gray-500">
                            user:{item.user_id ?? '-'} · grant:{item.external_grant_id ?? '-'}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="font-semibold">{item.status}</span>
                          {item.remote_status && (
                            <span className="ml-1 text-gray-500">({item.remote_status})</span>
                          )}
                        </td>
                        <td className="p-3 font-mono">{item.attempt_count}/{item.max_attempts}</td>
                        <td className="p-3 font-mono text-[11px] max-w-[200px] truncate">{item.correlation_id || '-'}</td>
                        <td className="p-3 max-w-[260px]">
                          {item.last_error_code ? (
                            <span className="text-rose-500 font-mono">
                              {item.last_error_code}: {item.last_error_message}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="p-3 text-right">
                          {retryable && (
                            <button
                              type="button"
                              onClick={() =>
                                handleAction(
                                  `retry-${item.id}`,
                                  () => courseIntegrationOpsApi.retryOutbox(item.id, true).then(() => undefined),
                                  `Đã kích hoạt thử lại Outbox #${item.id}.`,
                                )
                              }
                              disabled={busyKey !== null || Boolean(overview?.killSwitchActive)}
                              className="rounded-md bg-indigo-600 px-2.5 py-1 text-white font-semibold hover:bg-indigo-500 disabled:opacity-50"
                            >
                              Thử lại
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredOutbox.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-gray-500">
                        Không có sự kiện outbox phù hợp bộ lọc.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab Content: Conflicts */}
        {tab === 'conflicts' && (
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800/60 text-left uppercase text-gray-500">
                <tr>
                  <th className="p-3">Conflict</th>
                  <th className="p-3">Đối tượng / Email</th>
                  <th className="p-3">Lý do & Correlation ID</th>
                  <th className="p-3 text-right">Xử lý thủ công</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {conflictRows.map((c: ConflictOpsItem) => (
                  <tr key={c.id}>
                    <td className="p-3">
                      <div className="font-semibold text-amber-600 dark:text-amber-400">#{c.id} · {c.conflict_type}</div>
                      <div className="text-gray-500">Status: {c.status} · {c.source_system}</div>
                    </td>
                    <td className="p-3 font-mono text-[11px]">
                      <div>extUser: {c.external_user_id || '-'}</div>
                      <div>candUser: {c.candidate_user_id ?? '-'} / exist: {c.existing_user_id ?? '-'}</div>
                      {c.email_hint && <div>hint: {c.email_hint}</div>}
                    </td>
                    <td className="p-3 max-w-[280px]">
                      <div>{c.reason}</div>
                      <div className="font-mono text-[11px] text-gray-400">{c.correlation_id || '-'}</div>
                    </td>
                    <td className="p-3 text-right">
                      {c.status === 'open' || c.status === 'in_review' ? (
                        <div className="inline-flex items-center gap-1.5">
                          <input
                            type="number"
                            placeholder="User ID"
                            value={targetUserByConflict[c.id] ?? (c.candidate_user_id ? String(c.candidate_user_id) : '')}
                            onChange={(e) => setTargetUserByConflict((prev) => ({ ...prev, [c.id]: e.target.value }))}
                            className="w-20 rounded border border-gray-300 dark:border-gray-700 bg-transparent px-2 py-1 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleAction(
                                `link-${c.id}`,
                                () =>
                                  courseIntegrationOpsApi
                                    .resolveConflict(c.id, {
                                      action: 'link_existing',
                                      targetUserId: Number(targetUserByConflict[c.id] || c.candidate_user_id),
                                      resolutionNote: 'Manual admin link verification',
                                    })
                                    .then(() => undefined),
                                `Đã liên kết danh tính và giải quyết conflict #${c.id}.`,
                              )
                            }
                            disabled={busyKey !== null}
                            className="rounded bg-indigo-600 px-2 py-1 text-white font-semibold hover:bg-indigo-500"
                          >
                            Link User
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleAction(
                                `dismiss-${c.id}`,
                                () =>
                                  courseIntegrationOpsApi
                                    .resolveConflict(c.id, { action: 'dismissed', resolutionNote: 'Admin dismissed' })
                                    .then(() => undefined),
                                `Đã đóng conflict #${c.id}.`,
                              )
                            }
                            disabled={busyKey !== null}
                            className="rounded border border-gray-300 dark:border-gray-700 px-2 py-1 font-semibold"
                          >
                            Đóng
                          </button>
                        </div>
                      ) : (
                        <span className="text-emerald-600 font-semibold">{c.status}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {conflictRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-gray-500">Không có xung đột nào được ghi nhận.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab Content: Mappings & Unmapped */}
        {tab === 'mappings' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
              <div className="text-sm font-bold">Thêm / Cập nhật Course Mapping Thủ công (Cấm auto-match theo tên/slug)</div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="External Course ID (vd: moly:course:10)"
                  value={extCourseId}
                  onChange={(e) => setExtCourseId(e.target.value)}
                  className="rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-xs"
                />
                <input
                  type="number"
                  placeholder="Local Course ID (Moly)"
                  value={localCourseId}
                  onChange={(e) => setLocalCourseId(e.target.value)}
                  className="rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  placeholder="Ghi chú xác minh"
                  value={mappingNotes}
                  onChange={(e) => setMappingNotes(e.target.value)}
                  className="rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-xs"
                />
                <button
                  type="button"
                  disabled={!extCourseId.trim() || !localCourseId.trim() || busyKey !== null}
                  onClick={() =>
                    handleAction(
                      'save-mapping',
                      () =>
                        courseIntegrationOpsApi
                          .upsertMapping({
                            sourceSystem: 'moly',
                            externalCourseId: extCourseId.trim(),
                            localCourseId: Number(localCourseId),
                            status: 'active',
                            notes: mappingNotes.trim() || 'Mapped via Day 5 Admin UI',
                          })
                          .then(() => {
                            setExtCourseId('');
                            setLocalCourseId('');
                            setMappingNotes('');
                          }),
                      'Đã lưu course mapping thủ công.',
                    )
                  }
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  Lưu Mapping Thủ công
                </button>
              </div>
            </div>

            {unmappedCount > 0 && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-2">
                <div className="text-xs font-bold uppercase text-amber-600 dark:text-amber-400">
                  Khóa học thuộc Gói Video chưa có Course Mapping Active ({unmappedCount})
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {(overview?.unmappedCourses || []).map((u) => (
                    <div key={`${u.local_course_id}-${u.video_package_id}`} className="rounded-lg border border-amber-500/20 bg-white dark:bg-gray-900 p-2.5 flex justify-between items-center">
                      <div>
                        <div className="font-semibold">Course #{u.local_course_id}: {u.local_course_title || u.local_course_slug}</div>
                        <div className="text-gray-500">Gói #{u.video_package_id}: {u.video_package_name}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setLocalCourseId(String(u.local_course_id));
                          setExtCourseId(`moly:course:${u.local_course_id}`);
                        }}
                        className="rounded bg-amber-500/20 px-2 py-1 font-semibold text-amber-700 dark:text-amber-300"
                      >
                        Điền form
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800/60 text-left uppercase text-gray-500">
                  <tr>
                    <th className="p-3">Source / External ID</th>
                    <th className="p-3">Local Course (Moly)</th>
                    <th className="p-3">Trạng thái</th>
                    <th className="p-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {(overview?.courseMappings || []).map((m) => (
                    <tr key={m.id}>
                      <td className="p-3 font-mono">
                        <div>{m.externalCourseId}</div>
                        <div className="text-gray-400">{m.sourceSystem}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold">#{m.localCourseId} · {m.localCourseTitle || m.localCourseSlug || '-'}</div>
                        <div className="text-gray-400">{m.notes || '—'}</div>
                      </td>
                      <td className="p-3 font-semibold">{m.status}</td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            handleAction(
                              `toggle-map-${m.id}`,
                              () =>
                                courseIntegrationOpsApi
                                  .updateMappingStatus(m.id, m.status === 'active' ? 'inactive' : 'active')
                                  .then(() => undefined),
                              `Đã đổi trạng thái mapping #${m.id}.`,
                            )
                          }
                          disabled={busyKey !== null}
                          className="rounded border border-gray-300 dark:border-gray-700 px-2.5 py-1 font-semibold"
                        >
                          {m.status === 'active' ? 'Tạm tắt' : 'Kích hoạt'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab Content: v2 Sync Inbox & Checkpoints */}
        {tab === 'inbox_sync' && (
          <div className="space-y-6">
            {/* Manual Backfill Triggers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
                <h3 className="text-sm font-bold">Catalog Backfill (CSCA-Course → Moly)</h3>
                <p className="text-xs text-gray-500">
                  Đồng bộ metadata khóa học từ v2 catalog pull. Chọn Full Backfill khi cần reset cursor và kéo lại toàn bộ catalog.
                </p>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={backfillFull}
                    onChange={(e) => setBackfillFull(e.target.checked)}
                    className="h-4 w-4 accent-indigo-600"
                  />
                  <span>Full Catalog Backfill (full=true / reset cursor)</span>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    handleAction(
                      'catalog-backfill',
                      () => courseIntegrationOpsApi.runCatalogBackfill({ full: backfillFull }).then(() => undefined),
                      backfillFull ? 'Đã hoàn tất Full Catalog Backfill.' : 'Đã hoàn tất Incremental Catalog Backfill.',
                    )
                  }
                  disabled={busyKey !== null || globalKill || contentSyncKill}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  <FiDatabase className="w-4 h-4" />
                  Trigger Catalog Backfill
                </button>
              </div>

              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
                <h3 className="text-sm font-bold">Curriculum Backfill theo Course ID</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="number"
                    placeholder="Local Course ID *"
                    value={curriculumCourseId}
                    onChange={(e) => setCurriculumCourseId(e.target.value)}
                    className="rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Remote Course ID (tùy chọn)"
                    value={curriculumRemoteCourseId}
                    onChange={(e) => setCurriculumRemoteCourseId(e.target.value)}
                    className="rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Profile ID (tùy chọn)"
                    value={curriculumProfileId}
                    onChange={(e) => setCurriculumProfileId(e.target.value)}
                    className="rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-1.5 text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const parsedId = Number(curriculumCourseId.trim());
                    if (!Number.isFinite(parsedId) || parsedId <= 0) {
                      setBanner({ type: 'err', text: 'Vui lòng nhập Local Course ID hợp lệ (> 0) trước khi backfill curriculum.' });
                      return;
                    }
                    void handleAction(
                      `curriculum-backfill-${parsedId}`,
                      () =>
                        courseIntegrationOpsApi
                          .runCurriculumBackfill(parsedId, {
                            ...(curriculumRemoteCourseId.trim() ? { remoteCourseId: curriculumRemoteCourseId.trim() } : {}),
                            ...(curriculumProfileId.trim() ? { profileId: curriculumProfileId.trim() } : {}),
                          })
                          .then(() => undefined),
                      `Đã kích hoạt Curriculum Backfill cho khóa học #${parsedId}.`,
                    );
                  }}
                  disabled={busyKey !== null || globalKill || contentSyncKill}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  <FiPlay className="w-4 h-4" />
                  Trigger Curriculum Backfill
                </button>
              </div>
            </div>

            {/* Checkpoints Table */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-x-auto">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <h3 className="text-sm font-bold">Course Sync Checkpoints (course_sync_checkpoints)</h3>
                <span className="text-xs text-gray-500">{checkpoints.length} stream(s)</span>
              </div>
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800/60 text-left uppercase text-gray-500">
                  <tr>
                    <th className="p-3">Stream</th>
                    <th className="p-3">Trạng thái</th>
                    <th className="p-3">High-Water Revision</th>
                    <th className="p-3">Last Cursor</th>
                    <th className="p-3">Last Synced At</th>
                    <th className="p-3">Lỗi cuối</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {checkpoints.map((cp: SyncCheckpointItem) => (
                    <tr key={`${cp.source_system || 'csca_course'}-${cp.stream_name}`}>
                      <td className="p-3 font-mono font-semibold">
                        <div>{cp.stream_name}</div>
                        <div className="text-[11px] font-normal text-gray-400">{cp.source_system || 'csca_course'}</div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`font-semibold ${
                            cp.sync_status === 'error' || cp.sync_status === 'failed'
                              ? 'text-rose-500'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {cp.sync_status || 'unknown'}
                        </span>
                      </td>
                      <td className="p-3 font-mono">{cp.high_water_revision ?? '—'}</td>
                      <td className="p-3 font-mono text-[11px] max-w-[180px] truncate">{cp.last_cursor || '—'}</td>
                      <td className="p-3 text-gray-500">{formatDateTime(cp.last_synced_at)}</td>
                      <td className="p-3 max-w-[260px]">
                        {cp.last_error_code || cp.last_error_message ? (
                          <div className="text-rose-500">
                            {cp.last_error_code ? `[${cp.last_error_code}] ` : ''}
                            {cp.last_error_message || ''}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                  {checkpoints.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-gray-500">
                        Chưa có checkpoint đồng bộ nào được ghi nhận.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* v2 Inbox Counts & Attention Queue */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-x-auto">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold">v2 Sync Inbox Attention Queue</h3>
                <div className="flex flex-wrap gap-2 text-[11px] font-mono">
                  {Object.entries(overview?.v2InboxCounts || {}).length > 0 ? (
                    Object.entries(overview?.v2InboxCounts || {}).map(([st, cnt]) => (
                      <span
                        key={st}
                        className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-0.5"
                      >
                        {st}: {cnt}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-400">Chưa có thống kê v2InboxCounts</span>
                  )}
                </div>
              </div>
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800/60 text-left uppercase text-gray-500">
                  <tr>
                    <th className="p-3">ID / Event</th>
                    <th className="p-3">Aggregate</th>
                    <th className="p-3">Trạng thái</th>
                    <th className="p-3">Thử / Retry</th>
                    <th className="p-3">Lỗi cuối</th>
                    <th className="p-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {v2InboxItems.map((item: V2InboxAttentionItem) => (
                    <tr key={item.id}>
                      <td className="p-3">
                        <div className="font-semibold">#{item.id} · {item.event_type}</div>
                        <div className="font-mono text-[11px] text-gray-500">{item.event_id}</div>
                      </td>
                      <td className="p-3 font-mono text-[11px]">
                        <div>{item.aggregate_type || '-'} : {item.aggregate_id || '-'}</div>
                        <div className="text-gray-400">rev: {item.aggregate_revision ?? '-'}</div>
                      </td>
                      <td className="p-3 font-semibold">{item.status}</td>
                      <td className="p-3 text-[11px]">
                        <div>attempts: {item.attempt_count}</div>
                        <div className="text-gray-400">next: {formatDateTime(item.next_retry_at)}</div>
                      </td>
                      <td className="p-3 max-w-[260px]">
                        <div className="text-rose-500">
                          {item.last_error_code ? `[${item.last_error_code}] ` : ''}
                          {item.last_error_message || '—'}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          recv: {formatDateTime(item.received_at ?? item.created_at)}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            handleAction(
                              `retry-v2-inbox-${item.id}`,
                              () => courseIntegrationOpsApi.retryV2InboxItem(item.id).then(() => undefined),
                              `Đã thử lại sự kiện v2 Inbox #${item.id}.`,
                            )
                          }
                          disabled={busyKey !== null || globalKill || contentSyncKill}
                          className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                        >
                          Retry
                        </button>
                      </td>
                    </tr>
                  ))}
                  {v2InboxItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-gray-500">
                        Không có sự kiện v2 Inbox nào cần xử lý (failed / pending / dead_letter).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab Content: Reconciliation & Subject Recovery */}
        {tab === 'reconciliation' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Domain Selector & Run Controls */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
                <h3 className="text-sm font-bold">Đối soát theo Miền Dữ liệu (Reconciliation Domains)</h3>
                <p className="text-xs text-gray-500">
                  Chọn miền cần đối soát (mặc định Tất cả). Dry-Run chỉ thống kê drift; Repair sẽ thực hiện đồng bộ sửa lệch.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setReconDomains([])}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold border ${
                      reconDomains.length === 0
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    All Domains
                  </button>
                  {RECON_DOMAINS.map((domain) => {
                    const active = reconDomains.includes(domain);
                    return (
                      <button
                        key={domain}
                        type="button"
                        onClick={() => setReconDomains((prev) => toggleDomainItem(prev, domain))}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold border ${
                          active
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        {domain}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      handleAction(
                        'tab-recon-dry',
                        () =>
                          courseIntegrationOpsApi
                            .runReconciliation({ dryRun: true, ...(reconDomains.length > 0 ? { domains: reconDomains } : {}) })
                            .then(() => undefined),
                        'Đã hoàn tất chạy đối soát Dry-Run theo miền đã chọn.',
                      )
                    }
                    disabled={busyKey !== null}
                    className="rounded-lg bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    Chạy Dry-Run ({reconDomains.length ? reconDomains.join(', ') : 'All'})
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleAction(
                        'tab-recon-repair',
                        () =>
                          courseIntegrationOpsApi
                            .runReconciliation({ dryRun: false, ...(reconDomains.length > 0 ? { domains: reconDomains } : {}) })
                            .then(() => undefined),
                        'Đã chạy đối soát & Auto-Repair theo miền đã chọn.',
                      )
                    }
                    disabled={busyKey !== null || globalKill || mutationsRepairKill}
                    className="rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    Chạy Repair ({reconDomains.length ? reconDomains.join(', ') : 'All'})
                  </button>
                </div>
              </div>

              {/* Per-Subject Recovery */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
                <h3 className="text-sm font-bold">Khôi phục theo Đối tượng (Per-Subject Recovery)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="Moly User ID (userId)"
                    value={subjectUserId}
                    onChange={(e) => setSubjectUserId(e.target.value)}
                    className="rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="External User ID (externalUserId)"
                    value={subjectExternalUserId}
                    onChange={(e) => setSubjectExternalUserId(e.target.value)}
                    className="rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-1.5 text-xs"
                  />
                  <input
                    type="number"
                    placeholder="Course ID (courseId)"
                    value={subjectCourseId}
                    onChange={(e) => setSubjectCourseId(e.target.value)}
                    className="rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Profile ID (profileId)"
                    value={subjectProfileId}
                    onChange={(e) => setSubjectProfileId(e.target.value)}
                    className="rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-1.5 text-xs"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {RECON_DOMAINS.map((domain) => {
                    const active = subjectDomains.includes(domain);
                    return (
                      <button
                        key={domain}
                        type="button"
                        onClick={() => setSubjectDomains((prev) => toggleDomainItem(prev, domain))}
                        className={`rounded-md px-2 py-0.5 text-[11px] font-semibold border ${
                          active
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        {domain}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleRetrySubject(true)}
                    disabled={busyKey !== null}
                    className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                  >
                    Dry-Run Subject
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRetrySubject(false)}
                    disabled={busyKey !== null || globalKill || mutationsRepairKill}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Retry / Repair Subject
                  </button>
                </div>
              </div>
            </div>

            {latestRun && (
              <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4 space-y-2 text-xs">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-bold">Lần đối soát gần nhất · Run #{latestRun.id} ({latestRun.dry_run ? 'DRY-RUN' : 'AUTO-REPAIR'})</span>
                  <span className="text-gray-500">{formatDateTime(latestRun.started_at)}</span>
                </div>
                {(() => {
                  const summaryObj = (latestRun.summary_counts || (latestRun as unknown as { summary?: Record<string, unknown> }).summary || {}) as Record<string, unknown>;
                  const driftKeys = ['entitlementDrift', 'contentDrift', 'progressDrift'].filter((k) => k in summaryObj);
                  if (driftKeys.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-2">
                      {driftKeys.map((dk) => (
                        <span
                          key={dk}
                          className="rounded border border-indigo-400/30 bg-white dark:bg-gray-900 px-2.5 py-1 font-mono text-[11px]"
                        >
                          {dk}: {typeof summaryObj[dk] === 'object' ? JSON.stringify(summaryObj[dk]) : String(summaryObj[dk])}
                        </span>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {(overview?.reconciliationRuns || []).map((run: ReconciliationRunItem) => {
              const runSummary = run.summary_counts || (run as unknown as { summary?: Record<string, unknown> }).summary || {};
              return (
                <div key={run.id} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-2 text-xs">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <span className="font-bold">Run #{run.id}</span> · {run.trigger_mode} ·{' '}
                      <span className="font-semibold">{run.dry_run ? 'DRY-RUN' : 'AUTO-REPAIR'}</span> ·{' '}
                      <span className="font-semibold uppercase">{run.status}</span>
                    </div>
                    <div className="font-mono text-gray-500">corr: {run.correlation_id}</div>
                  </div>
                  <pre className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-2 font-mono text-[11px] overflow-x-auto">
                    {JSON.stringify(runSummary, null, 2)}
                  </pre>
                  {run.actions && run.actions.length > 0 && (
                    <div className="divide-y divide-gray-200 dark:divide-gray-800 border-t border-gray-200 dark:border-gray-800 pt-2">
                      {run.actions.slice(0, 20).map((act) => (
                        <div key={act.id} className="py-1.5 flex flex-wrap justify-between gap-2">
                          <span>
                            <strong>{act.category}</strong> → {act.action_taken}
                          </span>
                          <span className="font-mono text-gray-500">
                            {act.external_user_id || ''} {act.external_grant_id || ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {(overview?.reconciliationRuns || []).length === 0 && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-6 text-center text-xs text-gray-500">
                Chưa có lượt chạy đối soát nào được lưu.
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
