'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FiAlertTriangle,
  FiCalendar,
  FiCheck,
  FiCheckCircle,
  FiCopy,
  FiSearch,
  FiSlash,
  FiUserPlus,
  FiUsers,
  FiX,
} from 'react-icons/fi';
import axios from '@/lib/utils/axios';
import coursesApi, { extractCourseApiError } from '@/lib/api/courses';
import type {
  AdminCourseEnrollmentItemDto,
  ApiPaginationDto,
  GrantCourseEnrollmentResultDto,
} from '@/lib/types/courses';

type StudentCandidate = {
  id: number;
  fullName: string;
  email: string;
  username?: string | null;
};

type DurationPreset = 30 | 90 | 180 | 365 | 'lifetime' | 'custom';

const DURATION_PRESETS: Array<{ value: DurationPreset; label: string }> = [
  { value: 30, label: '30 ngày' },
  { value: 90, label: '90 ngày (3 tháng)' },
  { value: 180, label: '180 ngày (6 tháng)' },
  { value: 365, label: '365 ngày (1 năm)' },
  { value: 'lifetime', label: '♾️ Trọn đời' },
  { value: 'custom', label: '📅 Chọn ngày cụ thể' },
];

const REASON_SUGGESTIONS = [
  'Đăng ký khóa học',
  'Học viên lớp Video khóa mới',
  'Học bổng / Tặng kèm khóa học',
  'Gia hạn thời gian học tập',
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmailBatch(raw: string): { validEmails: string[]; invalidTokens: string[] } {
  const tokens = raw
    .split(/[\n,;|\t\s]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const validSet = new Set<string>();
  const invalidTokens: string[] = [];
  for (const token of tokens) {
    if (EMAIL_REGEX.test(token)) {
      validSet.add(token);
    } else {
      invalidTokens.push(token);
    }
  }
  return { validEmails: Array.from(validSet), invalidTokens };
}

function sourceBadge(source: string): { label: string; style: string } {
  switch (source) {
    case 'admin':
    case 'manual':
      return {
        label: 'Admin cấp quyền',
        style: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800/60',
      };
    case 'video':
    case 'video_package':
    case 'payment':
      return {
        label: 'Gói Video',
        style: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800/60',
      };
    case 'package':
    case 'vip':
    case 'premium':
      return {
        label: 'Gói VIP',
        style: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800/60',
      };
    case 'free':
      return {
        label: 'Tự đăng ký (Miễn phí)',
        style: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800/60',
      };
    default:
      return {
        label: source || 'Khác',
        style: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      };
  }
}

function enrollmentStatusBadge(status: string, expiresAt: string | null): { label: string; style: string } {
  if (status === 'revoked') {
    return {
      label: 'Đã thu hồi',
      style: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60',
    };
  }
  if (status === 'expired' || (expiresAt && new Date(expiresAt) <= new Date())) {
    return {
      label: 'Hết hạn',
      style: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
    };
  }
  if (status === 'completed') {
    return {
      label: 'Đã hoàn thành',
      style: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800/60',
    };
  }
  return {
    label: 'Đang học',
    style: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60',
  };
}

export function CourseStudentAccessPanel({
  courseId,
  onEnrollmentChanged,
}: {
  courseId: number;
  onEnrollmentChanged?: () => void;
}) {
  // Grant form states
  const [grantMode, setGrantMode] = useState<'search' | 'bulk_emails'>('search');
  const [userQuery, setUserQuery] = useState('');
  const [candidates, setCandidates] = useState<StudentCandidate[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [searchUsersHint, setSearchUsersHint] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<StudentCandidate[]>([]);

  const [bulkEmailsRaw, setBulkEmailsRaw] = useState('');
  const parsedBatch = useMemo(() => parseEmailBatch(bulkEmailsRaw), [bulkEmailsRaw]);

  const [durationPreset, setDurationPreset] = useState<DurationPreset>(180);
  const [customExpiresAt, setCustomExpiresAt] = useState('');
  const [reason, setReason] = useState('Đăng ký khóa học');
  const [granting, setGranting] = useState(false);
  const [grantError, setGrantError] = useState('');
  const [grantResult, setGrantResult] = useState<GrantCourseEnrollmentResultDto | null>(null);
  const [copiedMissing, setCopiedMissing] = useState(false);

  // Enrollments list states
  const [enrollments, setEnrollments] = useState<AdminCourseEnrollmentItemDto[]>([]);
  const [pagination, setPagination] = useState<ApiPaginationDto>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [listSearch, setListSearch] = useState('');
  const [debouncedListSearch, setDebouncedListSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState('');

  // Revoke modal state
  const [revokeTarget, setRevokeTarget] = useState<AdminCourseEnrollmentItemDto | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revoking, setRevoking] = useState(false);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce enrollment list search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedListSearch(listSearch.trim());
    }, 350);
    return () => clearTimeout(t);
  }, [listSearch]);

  const loadEnrollments = useCallback(
    async (page = 1) => {
      try {
        setLoadingList(true);
        setListError('');
        const res = await coursesApi.getCourseEnrollments(courseId, {
          page,
          limit: 20,
          search: debouncedListSearch || undefined,
          status: statusFilter || undefined,
        });
        setEnrollments(res.items);
        setPagination(res.pagination);
      } catch (err) {
        setListError(extractCourseApiError(err, 'Không thể tải danh sách học viên của khóa học này.'));
      } finally {
        setLoadingList(false);
      }
    },
    [courseId, debouncedListSearch, statusFilter],
  );

  useEffect(() => {
    void loadEnrollments(1);
  }, [loadEnrollments]);

  // Search users for Mode 1
  useEffect(() => {
    if (grantMode !== 'search') return;
    const q = userQuery.trim();
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (q.length < 2) {
      setCandidates([]);
      setSearchUsersHint('Gõ ít nhất 2 ký tự (tên, email hoặc username) để tìm học viên.');
      return;
    }

    searchTimerRef.current = setTimeout(async () => {
      try {
        setSearchingUsers(true);
        setSearchUsersHint('');
        const response = await axios.get('/admin/users', { params: { search: q, limit: 15 } });
        const rawUsers: Array<Record<string, unknown>> =
          response.data?.users ?? response.data?.data?.users ?? response.data?.data?.items ?? [];
        const mapped: StudentCandidate[] = rawUsers.map((u) => ({
          id: Number(u.id),
          fullName: String(u.full_name ?? u.fullName ?? u.name ?? ''),
          email: String(u.email ?? ''),
          username: u.username ? String(u.username) : null,
        }));
        setCandidates(mapped);
        if (mapped.length === 0) {
          setSearchUsersHint('Không tìm thấy tài khoản nào khớp từ khóa.');
        }
      } catch {
        try {
          const fallback = await axios.get('/video-commerce/manage/lookup/users', {
            params: { search: q, page: 1 },
          });
          const rawItems: Array<Record<string, unknown>> = fallback.data?.data?.items ?? [];
          const mapped: StudentCandidate[] = rawItems.map((u) => ({
            id: Number(u.id),
            fullName: String(u.name ?? u.fullName ?? ''),
            email: String(u.email ?? ''),
            username: u.username ? String(u.username) : null,
          }));
          setCandidates(mapped);
          if (mapped.length === 0) setSearchUsersHint('Không tìm thấy tài khoản nào khớp từ khóa.');
        } catch {
          setCandidates([]);
          setSearchUsersHint(
            'Tài khoản của bạn không có quyền tra cứu danh bạ toàn hệ thống — hãy chuyển sang tab "Dán danh sách Email hàng loạt" bên cạnh để cấp quyền bằng Email!',
          );
        }
      } finally {
        setSearchingUsers(false);
      }
    }, 300);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [userQuery, grantMode]);

  const toggleSelectUser = (candidate: StudentCandidate) => {
    setSelectedUsers((prev) =>
      prev.some((u) => u.id === candidate.id)
        ? prev.filter((u) => u.id !== candidate.id)
        : [...prev, candidate],
    );
  };

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (granting) return;

    if (grantMode === 'search' && selectedUsers.length === 0) {
      setGrantError('Vui lòng tìm và chọn ít nhất 1 học viên.');
      return;
    }
    if (grantMode === 'bulk_emails' && parsedBatch.validEmails.length === 0) {
      setGrantError('Vui lòng dán ít nhất 1 địa chỉ email hợp lệ.');
      return;
    }
    if (durationPreset === 'custom' && !customExpiresAt) {
      setGrantError('Vui lòng chọn ngày giờ hết hạn cụ thể.');
      return;
    }

    try {
      setGranting(true);
      setGrantError('');
      setGrantResult(null);

      const payload = {
        ...(grantMode === 'search'
          ? { userIds: selectedUsers.map((u) => u.id) }
          : { emails: parsedBatch.validEmails }),
        durationDays: typeof durationPreset === 'number' ? durationPreset : null,
        expiresAt:
          durationPreset === 'custom' && customExpiresAt
            ? new Date(customExpiresAt).toISOString()
            : null,
        reason: reason.trim() || 'Đăng ký khóa học',
      };

      const res = await coursesApi.grantCourseEnrollments(courseId, payload);
      setGrantResult(res);
      if (grantMode === 'search') {
        setSelectedUsers([]);
        setUserQuery('');
        setCandidates([]);
      } else if (res.notFoundEmails.length === 0) {
        setBulkEmailsRaw('');
      }
      await loadEnrollments(1);
      onEnrollmentChanged?.();
    } catch (err) {
      setGrantError(
        extractCourseApiError(err, 'Chưa thể cấp quyền học viên. Vui lòng kiểm tra lại thông tin và thử lại.'),
      );
    } finally {
      setGranting(false);
    }
  };

  const handleRevokeConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokeTarget || revoking) return;
    try {
      setRevoking(true);
      await coursesApi.revokeCourseEnrollment(
        courseId,
        revokeTarget.id,
        revokeReason.trim() || 'Thu hồi bởi Admin',
      );
      setRevokeTarget(null);
      setRevokeReason('');
      await loadEnrollments(pagination.page);
      onEnrollmentChanged?.();
    } catch (err) {
      alert(extractCourseApiError(err, 'Không thể thu hồi quyền học lúc này.'));
    } finally {
      setRevoking(false);
    }
  };

  const recipientCount =
    grantMode === 'search' ? selectedUsers.length : parsedBatch.validEmails.length;

  return (
    <div className="space-y-6">
      {/* GRANT PANEL */}
      <form
        onSubmit={handleGrant}
        className="space-y-6 rounded-3xl border border-indigo-200/80 bg-white p-6 shadow-sm dark:border-indigo-900/50 dark:bg-slate-900"
      >
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
              <FiUserPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                ➕ Cấp quyền vào khóa học này
              </h3>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                Mở khóa trực tiếp cho học viên (từng người hoặc cả danh sách lớp từ Excel/Zalo) mà không cần bật thanh toán tự động.
              </p>
            </div>
          </div>

          {/* 2 Mode Tabs */}
          <div className="inline-flex self-start rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => {
                setGrantMode('search');
                setGrantError('');
              }}
              className={`rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                grantMode === 'search'
                  ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-950 dark:text-indigo-300'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
              }`}
            >
              🔍 Tìm & chọn học viên
            </button>
            <button
              type="button"
              onClick={() => {
                setGrantMode('bulk_emails');
                setGrantError('');
              }}
              className={`rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                grantMode === 'bulk_emails'
                  ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-950 dark:text-indigo-300'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
              }`}
            >
              📋 Dán danh sách Email (Excel / Zalo)
            </button>
          </div>
        </div>

        {/* Mode 1: Search & Pick Users */}
        {grantMode === 'search' ? (
          <div className="space-y-3">
            {selectedUsers.length > 0 ? (
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-3.5 dark:border-indigo-800/60 dark:bg-indigo-950/20">
                <div className="mb-2 flex items-center justify-between text-xs font-bold text-indigo-900 dark:text-indigo-200">
                  <span>Đã chọn {selectedUsers.length} học viên nhận quyền:</span>
                  <button
                    type="button"
                    onClick={() => setSelectedUsers([])}
                    className="text-rose-600 hover:underline dark:text-rose-400"
                  >
                    Bỏ chọn tất cả
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map((u) => (
                    <span
                      key={u.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm dark:border-indigo-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <span className="font-bold">{u.fullName || 'Học viên'}</span>
                      <span className="text-slate-500 dark:text-slate-400">· {u.email}</span>
                      <button
                        type="button"
                        aria-label={`Bỏ chọn ${u.email}`}
                        onClick={() => toggleSelectUser(u)}
                        className="ml-0.5 rounded-full p-0.5 text-slate-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950"
                      >
                        <FiX className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="relative">
              <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Nhập tên học viên, email hoặc username để tìm..."
                className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            {searchingUsers ? (
              <p className="text-xs font-medium text-slate-500">Đang tìm kiếm tài khoản...</p>
            ) : candidates.length > 0 ? (
              <div className="grid max-h-60 gap-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-2">
                {candidates.map((c) => {
                  const picked = selectedUsers.some((u) => u.id === c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleSelectUser(c)}
                      className={`flex items-center justify-between gap-2 rounded-xl border p-3 text-left text-xs transition ${
                        picked
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-950 dark:bg-indigo-950/40 dark:text-indigo-100'
                          : 'border-slate-200 bg-white hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-900'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-900 dark:text-slate-100">
                          {c.fullName || 'Chưa cập nhật tên'}
                        </p>
                        <p className="truncate text-slate-500 dark:text-slate-400">{c.email}</p>
                      </div>
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                          picked
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {picked ? <FiCheck className="h-4 w-4" /> : '+'}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : searchUsersHint ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">{searchUsersHint}</p>
            ) : null}
          </div>
        ) : (
          /* Mode 2: Bulk Paste Emails */
          <div className="space-y-2.5">
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
              Dán danh sách Email học viên (mỗi dòng 1 email, hoặc cách nhau bởi dấu phẩy / khoảng trắng)
              <textarea
                rows={5}
                value={bulkEmailsRaw}
                onChange={(e) => setBulkEmailsRaw(e.target.value)}
                placeholder={'hocvien1@gmail.com\nhocvien2@gmail.com\nhocvien3@edu.vn'}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3.5 font-mono text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                ✅ Nhận diện được {parsedBatch.validEmails.length} email hợp lệ
              </span>
              {parsedBatch.invalidTokens.length > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                  ⚠️ Bỏ qua {parsedBatch.invalidTokens.length} chuỗi không phải email ({parsedBatch.invalidTokens.slice(0, 3).join(', ')})
                </span>
              ) : null}
            </div>
          </div>
        )}

        {/* 1-Touch Duration Selector + Reason */}
        <div className="grid gap-5 border-t border-slate-100 pt-5 dark:border-slate-800 lg:grid-cols-2">
          <div>
            <span className="block text-sm font-bold text-slate-700 dark:text-slate-200">
              Thời hạn quyền học (chọn nhanh 1 chạm)
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {DURATION_PRESETS.map((preset) => {
                const active = durationPreset === preset.value;
                return (
                  <button
                    key={String(preset.value)}
                    type="button"
                    onClick={() => setDurationPreset(preset.value)}
                    className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                      active
                        ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            {durationPreset === 'custom' ? (
              <label className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                <FiCalendar className="h-4 w-4 text-indigo-500" />
                <span>Hết hạn vào:</span>
                <input
                  type="datetime-local"
                  required
                  value={customExpiresAt}
                  onChange={(e) => setCustomExpiresAt(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
            ) : null}
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
              Ghi chú / Lý do cấp quyền
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="VD: Đăng ký khóa học qua Zalo"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {REASON_SUGGESTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setReason(item)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>

        {grantError ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300"
          >
            {grantError}
          </div>
        ) : null}

        {/* Grant Result Summary */}
        {grantResult ? (
          <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-800/60 dark:bg-emerald-950/30">
            <div className="flex items-center gap-2 text-sm font-black text-emerald-900 dark:text-emerald-200">
              <FiCheckCircle className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>Đã cấp quyền học thành công cho {grantResult.grantedCount} học viên!</span>
            </div>

            {grantResult.notFoundEmails.length > 0 ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-bold">
                    <FiAlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                    Có {grantResult.notFoundEmails.length} email chưa đăng ký tài khoản trên hệ thống (chưa thể cấp):
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(grantResult.notFoundEmails.join('\n'));
                      setCopiedMissing(true);
                      setTimeout(() => setCopiedMissing(false), 2500);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-amber-700 px-3 py-1.5 font-bold text-white hover:bg-amber-800"
                  >
                    <FiCopy className="h-3.5 w-3.5" />
                    {copiedMissing ? 'Đã sao chép!' : 'Copy email chưa đăng ký'}
                  </button>
                </div>
                <p className="mt-2 break-all font-mono text-[11px]">
                  {grantResult.notFoundEmails.join(', ')}
                </p>
                <p className="mt-1.5 text-[11px] opacity-85">
                  💡 Hãy nhắn các bạn trên đăng ký tài khoản bằng đúng email này, sau đó bấm Cấp quyền lại.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={granting || recipientCount === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-black text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiUserPlus className="h-4 w-4" />
            {granting
              ? 'Đang cấp quyền...'
              : recipientCount > 0
                ? `Cấp quyền ngay cho ${recipientCount} học viên`
                : 'Chọn học viên để cấp quyền'}
          </button>
        </div>
      </form>

      {/* ENROLLED STUDENTS TABLE */}
      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <FiUsers className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
              Danh sách học viên của khóa này ({pagination.total})
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { value: '', label: 'Tất cả' },
                { value: 'active', label: 'Đang học' },
                { value: 'completed', label: 'Đã hoàn thành' },
                { value: 'expired', label: 'Hết hạn' },
                { value: 'revoked', label: 'Đã thu hồi' },
              ] as const
            ).map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatusFilter(f.value)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  statusFilter === f.value
                    ? 'bg-slate-900 text-white dark:bg-indigo-600'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative max-w-md">
          <FiSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
            placeholder="Tìm học viên trong khóa theo tên hoặc email..."
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        {loadingList ? (
          <div className="h-48 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
        ) : listError ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            {listError}{' '}
            <button
              type="button"
              onClick={() => void loadEnrollments(pagination.page)}
              className="ml-2 font-bold underline"
            >
              Thử lại
            </button>
          </div>
        ) : enrollments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Chưa có học viên nào khớp bộ lọc. Hãy dùng khung phía trên để cấp quyền cho học viên đầu tiên!
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500 dark:bg-slate-800/80 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3.5">Học viên</th>
                  <th className="px-4 py-3.5">Nguồn cấp</th>
                  <th className="px-4 py-3.5">Trạng thái</th>
                  <th className="px-4 py-3.5">Tiến độ học</th>
                  <th className="px-4 py-3.5">Thời hạn</th>
                  <th className="px-4 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {enrollments.map((item) => {
                  const src = sourceBadge(item.source);
                  const st = enrollmentStatusBadge(item.status, item.expiresAt);
                  const pct = Math.min(100, Math.max(0, Math.round(item.progressPercent || 0)));
                  return (
                    <tr
                      key={item.id}
                      className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-4 py-3.5">
                        <p className="font-bold text-slate-900 dark:text-slate-100">
                          {item.fullName || item.username || 'Học viên'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{item.email}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${src.style}`}
                        >
                          {src.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${st.style}`}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="w-36 space-y-1">
                          <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
                            <span>{pct}%</span>
                            <span>{item.completedLessonsCount ?? 0} bài</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                        <p className="font-semibold">
                          {item.expiresAt
                            ? `Đến ${new Date(item.expiresAt).toLocaleDateString('vi-VN')}`
                            : '♾️ Trọn đời'}
                        </p>
                        <p className="text-slate-400">
                          Cấp: {new Date(item.enrolledAt).toLocaleDateString('vi-VN')}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {item.status !== 'revoked' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setRevokeTarget(item);
                              setRevokeReason('');
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-300"
                          >
                            <FiSlash className="h-3.5 w-3.5" />
                            Thu hồi
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">Đã thu hồi</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 ? (
          <div className="flex items-center justify-between pt-2 text-xs font-bold text-slate-600 dark:text-slate-300">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => void loadEnrollments(pagination.page - 1)}
              className="rounded-xl border border-slate-300 px-4 py-2 disabled:opacity-40 dark:border-slate-700"
            >
              ← Trang trước
            </button>
            <span>
              Trang {pagination.page} / {pagination.totalPages}
            </span>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => void loadEnrollments(pagination.page + 1)}
              className="rounded-xl border border-slate-300 px-4 py-2 disabled:opacity-40 dark:border-slate-700"
            >
              Trang sau →
            </button>
          </div>
        ) : null}
      </section>

      {/* Safe Revoke Confirmation Modal */}
      {revokeTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleRevokeConfirm}
            className="w-full max-w-md space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <h4 className="text-lg font-black text-slate-900 dark:text-slate-100">
              Xác nhận thu hồi quyền học?
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Học viên <strong>{revokeTarget.fullName || revokeTarget.email}</strong> ({revokeTarget.email}) sẽ không còn vào học được khóa này nữa. Tiến độ học cũ vẫn được lưu nếu cấp lại sau này.
            </p>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
              Lý do thu hồi (tùy chọn)
              <input
                type="text"
                autoFocus
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="VD: Hoàn học phí / Chuyển lớp / Nhập nhầm email..."
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-rose-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={revoking}
                onClick={() => setRevokeTarget(null)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                Giữ lại
              </button>
              <button
                type="submit"
                disabled={revoking}
                className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {revoking ? 'Đang thu hồi...' : 'Xác nhận thu hồi'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
