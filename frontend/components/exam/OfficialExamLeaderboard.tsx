'use client';

import { FiAward, FiClock, FiHash, FiMonitor, FiStar, FiTrendingUp, FiUsers } from 'react-icons/fi';
import { OfficialExamLeaderboardEntry } from '@/lib/api/officialExams';

type OfficialExamLeaderboardProps = {
  entries: OfficialExamLeaderboardEntry[];
  examTitle?: string;
  loading?: boolean;
  className?: string;
  compact?: boolean;
  badgeLabel?: string;
  scopeLabel?: string;
  description?: string;
  noRoomLabel?: string;
  emptyTitle?: string;
  emptyDescription?: string;
};

function formatScore(value?: number | null) {
  const score = Number(value ?? 0);
  if (!Number.isFinite(score)) return '0';
  return Number.isInteger(score) ? `${score}` : score.toFixed(1);
}

function formatDuration(seconds?: number | null) {
  if (!seconds || seconds <= 0) return '--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins <= 0) return `${secs}s`;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function Avatar({ entry, size = 48 }: { entry: OfficialExamLeaderboardEntry; size?: number }) {
  if (entry.avatar_url) {
    return (
      <img
        src={entry.avatar_url}
        alt={entry.full_name}
        className="shrink-0 rounded-full object-cover ring-4 ring-white"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 font-black text-white ring-4 ring-white"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {entry.full_name?.charAt(0)?.toUpperCase() || '?'}
    </div>
  );
}

function getEntryMeta(entry: OfficialExamLeaderboardEntry, noRoomLabel: string) {
  return entry.room_name
    ? `${entry.room_name}${entry.seat_number ? ` - ghế ${entry.seat_number}` : ''}`
    : noRoomLabel;
}

function PodiumCard({ entry, noRoomLabel, compact = false }: { entry: OfficialExamLeaderboardEntry; noRoomLabel: string; compact?: boolean }) {
  const tone =
    entry.rank === 1
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : entry.rank === 2
        ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
        : 'border-rose-200 bg-rose-50 text-rose-700';
  const shellClass =
    entry.rank === 1
      ? 'order-1 border-amber-200 shadow-xl shadow-amber-100/80 ring-1 ring-amber-100 md:order-2 md:w-full'
      : entry.rank === 2
        ? 'order-2 border-cyan-200 shadow-lg shadow-cyan-100/80 md:order-1 md:mx-auto md:w-[96%]'
        : 'order-3 border-rose-200 shadow-md shadow-rose-100/80 md:order-3 md:mx-auto md:w-[92%]';
  const heightClass = compact
    ? entry.rank === 1 ? 'min-h-[292px] md:min-h-[310px]' : entry.rank === 2 ? 'min-h-[252px] md:min-h-[266px]' : 'min-h-[232px] md:min-h-[244px]'
    : entry.rank === 1 ? 'min-h-[350px] md:min-h-[370px]' : entry.rank === 2 ? 'min-h-[306px] md:min-h-[324px]' : 'min-h-[282px] md:min-h-[298px]';
  const accentClass =
    entry.rank === 1
      ? 'from-amber-300 via-amber-400 to-orange-400'
      : entry.rank === 2
        ? 'from-cyan-300 via-sky-400 to-teal-400'
        : 'from-rose-300 via-pink-400 to-red-400';
  const scoreClass =
    entry.rank === 1
      ? 'bg-slate-950 shadow-lg shadow-amber-200/70'
      : entry.rank === 2
        ? 'bg-slate-900 shadow-md shadow-cyan-100/80'
        : 'bg-slate-900 shadow-sm shadow-rose-100/80';
  const avatarSize = compact
    ? entry.rank === 1 ? 60 : entry.rank === 2 ? 52 : 46
    : entry.rank === 1 ? 76 : entry.rank === 2 ? 66 : 58;

  return (
    <div className={`relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border bg-gradient-to-b from-white via-white to-slate-50/80 text-center transition-all ${compact ? 'p-3' : 'p-5'} ${heightClass} ${shellClass}`}>
      <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${accentClass}`} />
      <div className="absolute inset-x-5 top-6 h-px bg-gradient-to-r from-transparent via-slate-100 to-transparent" />
      <div className="relative z-10 flex flex-col items-center">
        <div className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${compact ? 'mb-2' : 'mb-3'} ${tone}`}>
          <FiAward size={14} /> #{entry.rank}
        </div>
        <Avatar entry={entry} size={avatarSize} />
        <h3 className={`${compact ? 'mt-2 min-h-[36px] text-sm' : 'mt-3 min-h-[44px] text-base'} line-clamp-2 font-black text-slate-950`}>{entry.full_name}</h3>
        <p className="mt-1 text-xs font-bold text-slate-500">
          {getEntryMeta(entry, noRoomLabel)}
        </p>
        <div className={`${compact ? 'mt-3 px-4 py-2' : 'mt-4 px-5 py-3'} rounded-2xl text-white ${scoreClass}`}>
          <p className={`${compact ? 'text-xl' : 'text-2xl'} font-black`}>{formatScore(entry.total_score)}</p>
          <p className="text-[11px] font-bold text-slate-300">điểm</p>
        </div>
        <p className={`${compact ? 'mt-2' : 'mt-3'} inline-flex items-center gap-1 text-xs font-bold text-slate-500`}>
          <FiClock size={13} /> {formatDuration(entry.duration_seconds)}
        </p>
      </div>
    </div>
  );
}

function RankingRow({ entry, noRoomLabel, compact = false }: { entry: OfficialExamLeaderboardEntry; noRoomLabel: string; compact?: boolean }) {
  return (
    <div className={`grid grid-cols-[44px_1fr_auto] items-center gap-3 rounded-2xl border border-slate-100 bg-white shadow-sm ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-sm font-black text-slate-500">
        #{entry.rank}
      </div>
      <div className="flex min-w-0 items-center gap-3">
        <Avatar entry={entry} size={compact ? 36 : 42} />
        <div className="min-w-0">
          <p className="truncate font-black text-slate-950">{entry.full_name}</p>
          <p className="truncate text-xs font-bold text-slate-500">
            {getEntryMeta(entry, noRoomLabel)} · {formatDuration(entry.duration_seconds)}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-lg font-black text-emerald-600">{formatScore(entry.total_score)}</p>
        <p className="text-xs font-bold text-slate-400">điểm</p>
      </div>
    </div>
  );
}

export default function OfficialExamLeaderboard({
  entries,
  examTitle,
  loading,
  className = '',
  compact = false,
  badgeLabel = 'Bảng xếp hạng phòng thi',
  scopeLabel = 'Đề/phòng thi',
  description,
  noRoomLabel = 'Chưa phân phòng',
  emptyTitle = 'Chưa có dữ liệu phòng thi',
  emptyDescription = 'Khi có thí sinh nộp bài của đề này, bảng xếp hạng riêng sẽ hiện ở đây.',
}: OfficialExamLeaderboardProps) {
  const podiumEntries = [entries[1], entries[0], entries[2]].filter(Boolean);
  const restEntries = entries.slice(3);

  return (
    <section className={`overflow-hidden ${compact ? 'rounded-3xl' : 'rounded-[2rem]'} border border-emerald-100 bg-gradient-to-b from-white to-emerald-50/40 shadow-sm ${className}`}>
      <div className={`border-b border-emerald-100 bg-white ${compact ? 'p-4' : 'p-5 md:p-6'}`}>
        <div className={`flex flex-col ${compact ? 'gap-3' : 'gap-4'} md:flex-row md:items-start md:justify-between`}>
          <div>
            <div className={`${compact ? 'mb-2' : 'mb-3'} inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black uppercase text-emerald-700`}>
              <FiMonitor size={14} /> {badgeLabel}
            </div>
            <h2 className={`${compact ? 'text-xl md:text-2xl' : 'text-2xl md:text-3xl'} flex items-center gap-2 font-black text-slate-950`}>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                <FiStar size={18} />
              </span>
              Bảng vàng thành tích
            </h2>
            <p className={`${compact ? 'mt-1 line-clamp-2' : 'mt-2'} max-w-2xl text-sm font-semibold text-slate-600`}>
              {description || `Vinh danh những bài làm nổi bật nhất của ${examTitle || 'đề hiện tại'}.`}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className={`rounded-2xl border border-slate-100 bg-slate-50 ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
              <p className="flex items-center gap-2 text-xs font-bold text-slate-500"><FiUsers /> Người đã xếp hạng</p>
              <p className={`${compact ? 'text-xl' : 'mt-1 text-2xl'} font-black text-slate-950`}>{entries.length}</p>
            </div>
            <div className={`rounded-2xl border border-slate-100 bg-slate-50 ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
              <p className="flex items-center gap-2 text-xs font-bold text-slate-500"><FiHash /> Phạm vi</p>
              <p className="mt-1 text-sm font-black text-slate-950">{scopeLabel}</p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className={`flex items-center justify-center ${compact ? 'min-h-[220px] p-6' : 'min-h-[260px] p-8'}`}>
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" />
        </div>
      ) : entries.length === 0 ? (
        <div className={`flex flex-col items-center justify-center text-center ${compact ? 'min-h-[220px] p-6' : 'min-h-[260px] p-8'}`}>
          <FiTrendingUp size={44} className="mb-3 text-slate-300" />
          <p className="text-lg font-black text-slate-600">{emptyTitle}</p>
          <p className="mt-1 max-w-md text-sm font-semibold text-slate-400">
            {emptyDescription}
          </p>
        </div>
      ) : (
        <div className={`${compact ? 'space-y-4 p-4' : 'space-y-5 p-5 md:p-6'}`}>
          <div className="grid gap-4 md:grid-cols-3 md:items-end">
            {podiumEntries.map((entry) => (
              <PodiumCard key={entry.user_id} entry={entry} noRoomLabel={noRoomLabel} compact={compact} />
            ))}
          </div>

          {restEntries.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="font-black text-slate-900">Từ hạng 4 trở xuống</h3>
                <span className="text-xs font-bold text-slate-400">{restEntries.length} thí sinh</span>
              </div>
              {restEntries.map((entry) => (
                <RankingRow key={entry.user_id} entry={entry} noRoomLabel={noRoomLabel} compact={compact} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
