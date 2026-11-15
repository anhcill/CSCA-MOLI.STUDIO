'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiActivity,
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiLink,
  FiPlay,
  FiRefreshCw,
  FiShield,
} from 'react-icons/fi';
import AdminLayout from '@/components/layout/AdminLayout';
import {
  courseIntegrationOpsApi,
  type ConflictOpsItem,
  type IntegrationOpsOverview,
  type OutboxOpsItem,
  type ReconciliationRunItem,
} from '@/lib/api/courseIntegration';

type OpsTab = 'outbox' | 'conflicts' | 'mappings' | 'reconciliation';

function extractErrMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { message?: string } }; message?: string };
  return anyErr?.response?.data?.message || anyErr?.message || fallback;
}

export default function AdminCourseIntegrationOps() {
  const [overview, setOverview] = useState<IntegrationOpsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [tab, setTab] = useState<OpsTab>('outbox');
  const [outboxFilter, setOutboxFilter] = useState<string>('all');
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [extCourseId, setExtCourseId] = useState('');
  const [localCourseId, setLocalCourseId] = useState('');
  const [mappingNotes, setMappingNotes] = useState('');
  const [targetUserByConflict, setTargetUserByConflict] = useState<Record<number, string>>({});

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

  const filteredOutbox = useMemo(() => {
    const rows = overview?.outboxItems || [];
    if (outboxFilter === 'all') return rows;
    return rows.filter((r) => r.status === outboxFilter);
  }, [overview, outboxFilter]);

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

  const pendingOrFailedCount = (overview?.outboxCounts?.pending || 0)
    + (overview?.outboxCounts?.processing || 0)
    + (overview?.outboxCounts?.failed || 0);
  const deadLetterCount = overview?.outboxCounts?.dead_letter || 0;
  const openConflictCount = (overview?.conflictCounts?.open || 0) + (overview?.conflictCounts?.in_review || 0);
  const unmappedCount = overview?.unmappedCourses?.length || 0;

  return (
    <AdminLayout
      title="Vận hành Đồng bộ Moly ↔ CSCA-Course"
      description="Theo dõi hàng đợi Outbox, Dead-Letter, xung đột danh tính, course mapping thủ công và đối soát hai chiều."
    >
      <div className="space-y-6">
        {overview?.killSwitchActive && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 flex items-center gap-3 text-rose-700 dark:text-rose-300">
            <FiAlertTriangle className="w-5 h-5 shrink-0" />
            <div className="text-sm font-medium">
              <strong>EMERGENCY KILL SWITCH ĐANG BẬT:</strong> Mọi thao tác đồng bộ Outbox, S2S client, thử lại thủ công và đối soát đều đang bị khóa an toàn bởi biến môi trường.
            </div>
          </div>
        )}

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
                  () => courseIntegrationOpsApi.runReconciliation(true).then(() => undefined),
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
                  () => courseIntegrationOpsApi.runReconciliation(false).then(() => undefined),
                  'Đã chạy đối soát & tự động sửa lệch rõ ràng.',
                )
              }
              disabled={busyKey !== null || Boolean(overview?.killSwitchActive)}
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
              disabled={busyKey !== null || Boolean(overview?.killSwitchActive)}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              <FiCheckCircle className="w-4 h-4" />
              Đẩy Outbox ngay
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
            ['outbox', `Hàng đợi Outbox (${overview?.outboxItems?.length || 0})`, FiClock],
            ['conflicts', `Xung đột Danh tính (${openConflictCount})`, FiShield],
            ['mappings', `Course Mapping & Thiếu Map (${unmappedCount})`, FiLink],
            ['reconciliation', `Lịch sử Đối soát (${overview?.reconciliationRuns?.length || 0})`, FiActivity],
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
                {(overview?.conflicts || []).map((c: ConflictOpsItem) => (
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
                {(overview?.conflicts || []).length === 0 && (
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

        {/* Tab Content: Reconciliation History */}
        {tab === 'reconciliation' && (
          <div className="space-y-4">
            {(overview?.reconciliationRuns || []).map((run: ReconciliationRunItem) => (
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
                  {JSON.stringify(run.summary_counts || {}, null, 2)}
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
            ))}
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
