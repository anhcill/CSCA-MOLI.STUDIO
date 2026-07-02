'use client';

import { FiAward, FiClock, FiMonitor, FiStar, FiTrendingUp, FiUsers } from 'react-icons/fi';
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
        className="shrink-0 rounded-full object-cover border-2 border-white shadow-sm"
        style={{ width: size, height: size }}
      />
    );
  }

  const initials = String(entry.full_name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 font-extrabold text-white border-2 border-white shadow-sm"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  );
}

function getEntryMeta(entry: OfficialExamLeaderboardEntry, noRoomLabel: string) {
  return entry.room_name
    ? `${entry.room_name}${entry.seat_number ? ` - ghế ${entry.seat_number}` : ''}`
    : noRoomLabel;
}

function Crown() {
  return (
    <svg className="w-8 h-8 absolute -top-[21px] left-1/2 -translate-x-1/2 z-10 drop-shadow-md" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 5L6 14L12 7L18 14L22 5L17 20H7L2 5Z" fill="#FBBF24" />
      <path d="M17 20H7V22H17V20Z" fill="#F59E0B" />
      <circle cx="2" cy="4" r="1.5" fill="#FBBF24" />
      <circle cx="12" cy="5" r="1.5" fill="#FBBF24" />
      <circle cx="22" cy="4" r="1.5" fill="#FBBF24" />
    </svg>
  );
}

function LaurelWreath({ color }: { color: 'gold' | 'blue' | 'pink' }) {
  const colorMap = {
    gold: 'text-amber-400/20',
    blue: 'text-blue-400/20',
    pink: 'text-rose-400/20',
  };
  const activeColor = colorMap[color];
  return (
    <div className="absolute inset-x-2 top-20 bottom-16 pointer-events-none flex items-center justify-between z-0">
      {/* Left Wreath */}
      <svg className={`w-10 h-24 ${activeColor}`} viewBox="0 0 24 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22 42C14 38 6 28 6 16C6 10 8 4 8 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M7 6C5 7.5 3 10 3 13C3 15 4.5 16 7 14C9.5 12 10 8 7 6Z" fill="currentColor"/>
        <path d="M6 15C4 17 2 20 2 23C2 25 3.5 26 6 24C8.5 22 9 18 6 15Z" fill="currentColor"/>
        <path d="M7 25C5 27 3 30 3 33C3 35 4.5 36 7 34C9.5 32 9 28 7 25Z" fill="currentColor"/>
        <path d="M10 33C8 35 7 37 7 40C7 42 8.5 43 11 41C13.5 39 13 35 10 33Z" fill="currentColor"/>
        <path d="M15 39C13 41 12 43 12 45C12 46.5 13.5 47 16 45C18.5 43 18 39 15 39Z" fill="currentColor"/>
      </svg>
      {/* Right Wreath */}
      <svg className={`w-10 h-24 ${activeColor}`} viewBox="0 0 24 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 42C10 38 18 28 18 16C18 10 16 4 16 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M17 6C19 7.5 21 10 21 13C21 15 19.5 16 17 14C14.5 12 14 8 17 6Z" fill="currentColor"/>
        <path d="M18 15C20 17 22 20 22 23C22 25 20.5 26 18 24C15.5 22 15 18 18 15Z" fill="currentColor"/>
        <path d="M17 25C19 27 21 30 21 33C21 35 19.5 36 17 34C14.5 32 15 28 17 25Z" fill="currentColor"/>
        <path d="M14 33C16 35 17 37 17 40C17 42 15.5 43 13 41C10.5 39 11 35 14 33Z" fill="currentColor"/>
        <path d="M9 39C11 41 12 43 12 45C12 46.5 10.5 47 8 45C5.5 43 6 39 9 39Z" fill="currentColor"/>
      </svg>
    </div>
  );
}

function Ribbon({ rank, colorClass }: { rank: number; colorClass: string }) {
  return (
    <div
      className={`absolute top-0 left-4 w-8 h-12 ${colorClass} flex items-center justify-center font-extrabold text-white shadow-sm z-10`}
      style={{
        clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 50% 85%, 0% 100%)',
      }}
    >
      <span className="text-sm font-black -translate-y-0.5">{rank}</span>
    </div>
  );
}

function getRankTone(rank: number) {
  if (rank === 1) {
    return {
      badgeColor: 'bg-[#FFC524]',
      shell: 'border-[#FFE899] bg-gradient-to-b from-[#FFFDF3] via-white to-[#FFF9E6] shadow-md shadow-amber-100/50',
      score: 'bg-[#FFB800] text-white',
      wreathColor: 'gold' as const,
    };
  }
  if (rank === 2) {
    return {
      badgeColor: 'bg-[#4FA2FF]',
      shell: 'border-[#D0E7FF] bg-gradient-to-b from-[#F5FAFF] via-white to-[#EBF5FF] shadow-sm shadow-blue-100/40',
      score: 'bg-[#3B82F6] text-white',
      wreathColor: 'blue' as const,
    };
  }
  return {
    badgeColor: 'bg-[#FF7894]',
    shell: 'border-[#FFE4E6] bg-gradient-to-b from-[#FFF5F6] via-white to-[#FFEBEF] shadow-sm shadow-rose-100/40',
    score: 'bg-[#EC4899] text-white',
    wreathColor: 'pink' as const,
  };
}

function PodiumCard({ entry, noRoomLabel, compact = false }: { entry: OfficialExamLeaderboardEntry; noRoomLabel: string; compact?: boolean }) {
  const tone = getRankTone(entry.rank);
  const cardHeight = compact
    ? entry.rank === 1 ? 'h-[290px]' : entry.rank === 2 ? 'h-[260px]' : 'h-[240px]'
    : entry.rank === 1 ? 'h-[350px]' : entry.rank === 2 ? 'h-[310px]' : 'h-[280px]';
  const avatarSize = compact
    ? entry.rank === 1 ? 58 : entry.rank === 2 ? 50 : 44
    : entry.rank === 1 ? 72 : entry.rank === 2 ? 64 : 58;

  return (
    <div className={`relative flex flex-col items-center justify-between rounded-[24px] border px-4 pb-6 pt-8 ${tone.shell} ${cardHeight} ${
      entry.rank === 1 ? 'order-1 md:order-2' : entry.rank === 2 ? 'order-2 md:order-1' : 'order-3 md:order-3'
    }`}>
      {/* Laurel Wreath */}
      <LaurelWreath color={tone.wreathColor} />

      {/* Ribbon Badge */}
      <Ribbon rank={entry.rank} colorClass={tone.badgeColor} />

      {/* Avatar & Crown */}
      <div className="relative flex flex-col items-center z-10 w-full">
        <div className="relative mb-2 mt-2">
          {entry.rank === 1 && <Crown />}
          <Avatar entry={entry} size={avatarSize} />
        </div>

        <h3 className={`font-extrabold text-slate-900 text-center line-clamp-1 max-w-[90%] mt-2 ${compact ? 'text-sm' : 'text-base'}`}>
          {entry.full_name}
        </h3>
        
        <p className="mt-1 text-[11px] font-bold text-slate-500 text-center truncate max-w-full px-2">
          {getEntryMeta(entry, noRoomLabel)}
        </p>
      </div>

      {/* Score Box & Duration */}
      <div className="relative flex flex-col items-center w-full z-10">
        <div className={`w-32 py-2 rounded-xl text-center shadow-sm font-black ${tone.score}`}>
          <p className={`${compact ? 'text-xl' : 'text-2xl'} leading-none`}>{formatScore(entry.total_score)}</p>
          <p className="text-[10px] font-bold opacity-90 mt-0.5">điểm</p>
        </div>

        <p className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-slate-500">
          <FiClock size={12} className="text-slate-400" /> {formatDuration(entry.duration_seconds)}
        </p>
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
    <section className={`overflow-hidden ${compact ? 'rounded-2xl' : 'rounded-[2rem]'} border border-slate-100 bg-[#F8FAFC] shadow-sm ${className}`}>
      <div className={`border-b border-slate-100 bg-white ${compact ? 'p-4' : 'p-5 md:p-6'}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-[11px] font-extrabold uppercase text-violet-700">
              <FiMonitor size={14} /> {badgeLabel}
            </div>
            <h2 className={`${compact ? 'text-xl' : 'text-2xl'} flex items-center gap-2 font-black text-slate-900`}>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                <FiStar size={16} />
              </span>
              Bảng vàng thành tích
            </h2>
            <p className="mt-1 max-w-2xl text-xs font-bold text-slate-400">
              {description || `Vinh danh những bài làm nổi bật nhất của ${examTitle || 'đề hiện tại'}.`}
            </p>
          </div>
          
          <div className="flex gap-2 self-start md:self-auto">
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-center min-w-[90px]">
              <p className="flex items-center justify-center gap-1 text-[9px] font-black text-slate-400 uppercase"><FiUsers size={10} /> Thí sinh</p>
              <p className="text-lg font-black text-slate-800 mt-0.5">{entries.length}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-center min-w-[90px]">
              <p className="flex items-center justify-center gap-1 text-[9px] font-black text-slate-400 uppercase"><FiAward size={10} /> Phạm vi</p>
              <p className="text-xs font-black text-slate-700 mt-1.5 truncate max-w-[80px]" title={scopeLabel}>{scopeLabel}</p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className={`flex items-center justify-center ${compact ? 'min-h-[200px] p-6' : 'min-h-[260px] p-8'}`}>
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-violet-600" />
        </div>
      ) : entries.length === 0 ? (
        <div className={`flex flex-col items-center justify-center text-center bg-white ${compact ? 'min-h-[200px] p-6' : 'min-h-[260px] p-8'}`}>
          <FiTrendingUp size={36} className="mb-2 text-slate-300" />
          <p className="text-base font-black text-slate-600">{emptyTitle}</p>
          <p className="mt-1 max-w-md text-xs font-bold text-slate-400">
            {emptyDescription}
          </p>
        </div>
      ) : (
        <div className={`${compact ? 'space-y-6 p-4' : 'space-y-8 p-6'}`}>
          {/* Podium */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end max-w-4xl mx-auto py-4">
            {podiumEntries.map((entry) => (
              <PodiumCard key={entry.user_id} entry={entry} noRoomLabel={noRoomLabel} compact={compact} />
            ))}
          </div>

          {/* Table list for 4+ */}
          {restEntries.length > 0 && (
            <div className="overflow-x-auto rounded-[24px] border border-slate-100 bg-white shadow-sm">
              <table className="w-full text-left border-collapse min-w-[650px]">
                <thead>
                  <tr className="border-b border-slate-50 text-[11px] font-black text-slate-400 uppercase tracking-wider bg-slate-50/40">
                    <th className="py-4 px-6 text-center w-20">HANG</th>
                    <th className="py-4 px-6">THÍ SINH</th>
                    <th className="py-4 px-6">PHÒNG THI</th>
                    <th className="py-4 px-6 text-center">SỐ LẦN THI</th>
                    <th className="py-4 px-6 text-center">ĐIỂM CAO NHẤT</th>
                    <th className="py-4 px-6 text-center">THỜI GIAN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {restEntries.map((entry) => {
                    const initials = String(entry.full_name || '?')
                      .trim()
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part.charAt(0).toUpperCase())
                      .join('') || '?';

                    const getAvatarBg = (name: string) => {
                      const char = name.charCodeAt(0) % 5;
                      const colors = [
                        'bg-emerald-500', 
                        'bg-orange-500',  
                        'bg-sky-500',     
                        'bg-purple-500',  
                        'bg-rose-500',    
                      ];
                      return colors[char];
                    };

                    return (
                      <tr key={entry.user_id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-4 px-6 text-center font-bold text-slate-800">
                          {entry.rank}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            {entry.avatar_url ? (
                              <img
                                src={entry.avatar_url}
                                alt={entry.full_name}
                                className="w-9 h-9 rounded-full object-cover border border-slate-100 shadow-sm"
                              />
                            ) : (
                              <div className={`w-9 h-9 rounded-full ${getAvatarBg(entry.full_name)} text-white font-extrabold flex items-center justify-center text-xs border border-white shadow-sm`}>
                                {initials}
                              </div>
                            )}
                            <span className="font-extrabold text-slate-900">{entry.full_name}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 font-bold text-slate-600">
                          {getEntryMeta(entry, noRoomLabel)}
                        </td>
                        <td className="py-4 px-6 text-center font-bold text-slate-600">
                          {entry.total_attempts}
                        </td>
                        <td className="py-4 px-6 text-center font-black text-emerald-600">
                          {formatScore(entry.total_score)}/100
                        </td>
                        <td className="py-4 px-6 text-center font-bold text-slate-500">
                          <div className="inline-flex items-center gap-1.5 justify-center">
                            <FiClock className="text-slate-400" size={13} />
                            <span>{formatDuration(entry.duration_seconds)}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          
          <div className="text-center text-xs font-bold text-slate-400 mt-4 flex items-center justify-center gap-1">
            <span>ⓘ</span>
            <span>Bảng xếp hạng được cập nhật liên tục sau mỗi lượt thi</span>
          </div>
        </div>
      )}
    </section>
  );
}
