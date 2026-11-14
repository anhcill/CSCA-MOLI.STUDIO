'use client';

export type CourseOwnershipUiStatus =
  | 'owned'
  | 'partially_owned'
  | 'pending_sync'
  | 'verification_required'
  | 'expired'
  | 'grant_blocked'
  | 'not_owned';

const STATUS_STYLE_MAP: Record<CourseOwnershipUiStatus, { label: string; badgeClass: string }> = {
  owned: {
    label: 'Đã sở hữu',
    badgeClass: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700/60 dark:bg-emerald-950/50 dark:text-emerald-200',
  },
  partially_owned: {
    label: 'Đã sở hữu',
    badgeClass: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700/60 dark:bg-emerald-950/50 dark:text-emerald-200',
  },
  pending_sync: {
    label: 'Đang đồng bộ quyền',
    badgeClass: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/50 dark:text-amber-200',
  },
  verification_required: {
    label: 'Cần xác minh tài khoản',
    badgeClass: 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-700/60 dark:bg-rose-950/50 dark:text-rose-200',
  },
  expired: {
    label: 'Quyền đã hết hạn',
    badgeClass: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  grant_blocked: {
    label: 'Đang tạm khóa quyền',
    badgeClass: 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200',
  },
  not_owned: {
    label: 'Mua khóa học',
    badgeClass: 'border-teal-300 bg-teal-50 text-teal-800 dark:border-teal-700/60 dark:bg-teal-950/50 dark:text-teal-200',
  },
};

export function resolveOwnershipMeta(status?: string | null, customLabel?: string | null) {
  const key = (status && status in STATUS_STYLE_MAP ? status : 'not_owned') as CourseOwnershipUiStatus;
  const fallback = STATUS_STYLE_MAP[key];
  return {
    key,
    label: customLabel?.trim() || fallback.label,
    badgeClass: fallback.badgeClass,
  };
}

export function CourseOwnershipBadge({
  status,
  label,
  className = '',
}: {
  status?: string | null;
  label?: string | null;
  className?: string;
}) {
  const meta = resolveOwnershipMeta(status, label);
  return (
    <span
      data-ownership-status={meta.key}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-black tracking-wide ${meta.badgeClass} ${className}`}
    >
      {meta.label}
    </span>
  );
}
