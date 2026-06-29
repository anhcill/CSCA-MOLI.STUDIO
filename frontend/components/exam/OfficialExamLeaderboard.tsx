'use client';

import { FiAward, FiClock, FiHash, FiMonitor, FiTrendingUp, FiUsers } from 'react-icons/fi';
import { OfficialExamLeaderboardEntry } from '@/lib/api/officialExams';

type OfficialExamLeaderboardProps = {
  entries: OfficialExamLeaderboardEntry[];
  examTitle?: string;
  loading?: boolean;
  className?: string;
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

function PodiumCard({ entry }: { entry: OfficialExamLeaderboardEntry }) {
  const isFirst = entry.rank === 1;
  const tone =
    entry.rank === 1
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : entry.rank === 2
        ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
        : 'border-rose-200 bg-rose-50 text-rose-700';
  const heightClass = isFirst ? 'md:min-h-[250px]' : 'md:min-h-[210px]';

  return (
    <div className={`flex flex-col items-center justify-end rounded-3xl border bg-white p-5 text-center shadow-sm ${heightClass}`}>
      <div className={`mb-3 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${tone}`}>
        <FiAward size={14} /> #{entry.rank}
      </div>
      <Avatar entry={entry} size={isFirst ? 72 : 60} />
      <h3 className="mt-3 line-clamp-2 min-h-[44px] text-base font-black text-slate-950">{entry.full_name}</h3>
      <p className="mt-1 text-xs font-bold text-slate-500">
        {entry.room_name ? `${entry.room_name}${entry.seat_number ? ` - ghế ${entry.seat_number}` : ''}` : 'Chưa phân phòng'}
      </p>
      <div className="mt-4 rounded-2xl bg-slate-950 px-5 py-3 text-white">
        <p className="text-2xl font-black">{formatScore(entry.total_score)}</p>
        <p className="text-[11px] font-bold text-slate-300">điểm</p>
      </div>
      <p className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-slate-500">
        <FiClock size={13} /> {formatDuration(entry.duration_seconds)}
      </p>
    </div>
  );
}

function RankingRow({ entry }: { entry: OfficialExamLeaderboardEntry }) {
  return (
    <div className="grid grid-cols-[44px_1fr_auto] items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-sm font-black text-slate-500">
        #{entry.rank}
      </div>
      <div className="flex min-w-0 items-center gap-3">
        <Avatar entry={entry} size={42} />
        <div className="min-w-0">
          <p className="truncate font-black text-slate-950">{entry.full_name}</p>
          <p className="truncate text-xs font-bold text-slate-500">
            {entry.room_name ? `${entry.room_name}${entry.seat_number ? ` - ghế ${entry.seat_number}` : ''}` : 'Chưa phân phòng'} · {formatDuration(entry.duration_seconds)}
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
}: OfficialExamLeaderboardProps) {
  const podiumEntries = [entries[1], entries[0], entries[2]].filter(Boolean);
  const restEntries = entries.slice(3);

  return (
    <section className={`overflow-hidden rounded-[2rem] border border-emerald-100 bg-gradient-to-b from-white to-emerald-50/40 shadow-sm ${className}`}>
      <div className="border-b border-emerald-100 bg-white p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black uppercase text-emerald-700">
              <FiMonitor size={14} /> Bảng xếp hạng phòng thi
            </div>
            <h2 className="text-2xl font-black text-slate-950 md:text-3xl">Top kết quả của đề này</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-600">
              Chỉ tính lượt nộp bài của {examTitle || 'kỳ thi/phòng thi hiện tại'}. Không lấy dữ liệu từ bảng xếp hạng toàn hệ thống.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="flex items-center gap-2 text-xs font-bold text-slate-500"><FiUsers /> Người đã xếp hạng</p>
              <p className="mt-1 text-2xl font-black text-slate-950">{entries.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="flex items-center gap-2 text-xs font-bold text-slate-500"><FiHash /> Phạm vi</p>
              <p className="mt-1 text-sm font-black text-slate-950">Đề/phòng thi</p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[260px] items-center justify-center p-8">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" />
        </div>
      ) : entries.length === 0 ? (
        <div className="flex min-h-[260px] flex-col items-center justify-center p-8 text-center">
          <FiTrendingUp size={44} className="mb-3 text-slate-300" />
          <p className="text-lg font-black text-slate-600">Chưa có dữ liệu phòng thi</p>
          <p className="mt-1 max-w-md text-sm font-semibold text-slate-400">
            Khi có thí sinh nộp bài của đề này, bảng xếp hạng riêng sẽ hiện ở đây.
          </p>
        </div>
      ) : (
        <div className="space-y-5 p-5 md:p-6">
          <div className="grid gap-4 md:grid-cols-3 md:items-end">
            {podiumEntries.map((entry) => (
              <PodiumCard key={entry.user_id} entry={entry} />
            ))}
          </div>

          {restEntries.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="font-black text-slate-900">Từ hạng 4 trở xuống</h3>
                <span className="text-xs font-bold text-slate-400">{restEntries.length} thí sinh</span>
              </div>
              {restEntries.map((entry) => (
                <RankingRow key={entry.user_id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
