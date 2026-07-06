'use client';

import { FiAward, FiClock, FiMonitor, FiStar, FiTrendingUp, FiUsers } from 'react-icons/fi';
import { OfficialExamLeaderboardEntry } from '@/lib/api/officialExams';
import { inkResultMuted, inkResultSoftPanel, inkResultTitle } from '@/components/layout/InkResultBackground';

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
        className="shrink-0 rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-sm"
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
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 font-extrabold text-white border-2 border-white dark:border-slate-800 shadow-sm"
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
    <svg className="w-8 h-8 absolute -top-[23px] left-1/2 -translate-x-1/2 z-20 drop-shadow-sm" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 6L6 14L12 8L18 14L22 6L17 19H7L2 6Z" fill="#FFC72C" />
      <path d="M17 19H7V21H17V19Z" fill="#E0A300" />
      <circle cx="2" cy="5" r="1.2" fill="#FFD97D" />
      <circle cx="12" cy="7" r="1.2" fill="#FFD97D" />
      <circle cx="22" cy="5" r="1.2" fill="#FFD97D" />
    </svg>
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
      shell: 'border-[#FFE899] dark:border-amber-700/30 bg-gradient-to-b from-[#FFFDF3] via-white to-[#FFF9E6] dark:from-[#3a2f15]/20 dark:via-slate-900 dark:to-slate-900 shadow-md shadow-amber-100/50 dark:shadow-none',
      score: 'bg-[#FFB800] text-white',
      wreathColor: 'text-[#F5D06E] dark:text-[#d4af37]',
    };
  }
  if (rank === 2) {
    return {
      badgeColor: 'bg-[#4FA2FF]',
      shell: 'border-[#D0E7FF] dark:border-blue-700/30 bg-gradient-to-b from-[#F5FAFF] via-white to-[#EBF5FF] dark:from-[#1b2b48]/20 dark:via-slate-900 dark:to-slate-900 shadow-sm shadow-blue-100/40 dark:shadow-none',
      score: 'bg-[#3B82F6] text-white',
      wreathColor: 'text-[#9ECBFF] dark:text-[#4a90e2]',
    };
  }
  return {
    badgeColor: 'bg-[#FF7894]',
    shell: 'border-[#FFE4E6] dark:border-rose-700/30 bg-gradient-to-b from-[#FFF5F6] via-white to-[#FFEBEF] dark:from-[#3b1c24]/20 dark:via-slate-900 dark:to-slate-900 shadow-sm shadow-rose-100/40 dark:shadow-none',
    score: 'bg-[#EC4899] text-white',
    wreathColor: 'text-[#FFA1B5] dark:text-[#d04a6b]',
  };
}

function PodiumCard({ entry, noRoomLabel, compact = false }: { entry: OfficialExamLeaderboardEntry; noRoomLabel: string; compact?: boolean }) {
  const tone = getRankTone(entry.rank);
  const cardHeight = compact
    ? entry.rank === 1 ? 'h-[270px]' : entry.rank === 2 ? 'h-[245px]' : 'h-[225px]'
    : entry.rank === 1 ? 'h-[330px]' : entry.rank === 2 ? 'h-[295px]' : 'h-[270px]';
  const avatarSize = compact
    ? entry.rank === 1 ? 58 : entry.rank === 2 ? 50 : 44
    : entry.rank === 1 ? 72 : entry.rank === 2 ? 64 : 58;

  return (
    <div className={`relative flex flex-col items-center justify-between rounded-[24px] border px-4 pb-5 pt-8 ${tone.shell} ${cardHeight} ${
      entry.rank === 1 ? 'order-1 md:order-2' : entry.rank === 2 ? 'order-2 md:order-1' : 'order-3 md:order-3'
    }`}>
      {/* Ribbon Badge */}
      <Ribbon rank={entry.rank} colorClass={tone.badgeColor} />

      {/* Avatar, Crown & Laurel Wreaths */}
      <div className="relative flex flex-col items-center z-10 w-full">
        <div className="relative mb-2 mt-1">
          {entry.rank === 1 && <Crown />}
          
          {/* Left Laurel Branch */}
          <div className="absolute top-1/2 -left-7 -translate-y-1/2 pointer-events-none z-0">
            <svg className={`w-5 h-14 ${tone.wreathColor}`} viewBox="0 0 24 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 54C12 48 8 36 8 22C8 14 10 4 10 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.6"/>
              <path d="M10 6C7 8 4 11 4 15C4 17 6 18 9 16C12 14 12 9 10 6Z" fill="currentColor" opacity="0.8"/>
              <path d="M9 17C6 19 3 23 3 27C3 29 5 30 8 28C11 26 11 21 9 17Z" fill="currentColor" opacity="0.8"/>
              <path d="M10 29C7 31 4 35 4 39C4 41 6 42 9 40C12 38 12 33 10 29Z" fill="currentColor" opacity="0.8"/>
              <path d="M12 41C9 43 7 47 7 51C7 53 9 54 12 52C15 50 15 45 12 41Z" fill="currentColor" opacity="0.8"/>
            </svg>
          </div>
          
          {/* Right Laurel Branch */}
          <div className="absolute top-1/2 -right-7 -translate-y-1/2 pointer-events-none z-0">
            <svg className={`w-5 h-14 ${tone.wreathColor}`} viewBox="0 0 24 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 54C12 48 16 36 16 22C16 14 14 4 14 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.6"/>
              <path d="M14 6C17 8 20 11 20 15C20 17 18 18 15 16C12 14 12 9 14 6Z" fill="currentColor" opacity="0.8"/>
              <path d="M15 17C18 19 21 23 21 27C21 29 19 30 16 28C13 26 13 21 15 17Z" fill="currentColor" opacity="0.8"/>
              <path d="M14 29C17 31 20 35 20 39C20 41 18 42 15 40C12 38 12 33 14 29Z" fill="currentColor" opacity="0.8"/>
              <path d="M12 41C15 43 17 47 17 51C17 53 15 54 12 52C9 50 9 45 12 41Z" fill="currentColor" opacity="0.8"/>
            </svg>
          </div>

          <Avatar entry={entry} size={avatarSize} />
        </div>

        <h3 className={`font-extrabold text-slate-800 dark:text-slate-200 text-center line-clamp-1 max-w-[90%] mt-2.5 ${compact ? 'text-sm' : 'text-[15px]'}`}>
          {entry.full_name}
        </h3>
        
        <p className="mt-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 text-center truncate max-w-full px-2">
          {getEntryMeta(entry, noRoomLabel)}
        </p>
      </div>

      {/* Score Box & Duration */}
      <div className="relative flex flex-col items-center w-full z-10 mt-3">
        <div className={`w-32 py-2.5 rounded-2xl text-center shadow-sm font-black ${tone.score}`}>
          <p className={`${compact ? 'text-xl' : 'text-2xl'} leading-none`}>{formatScore(entry.total_score)}</p>
          <p className="text-[10px] font-bold opacity-90 mt-0.5">điểm</p>
        </div>

        <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400 dark:text-slate-500">
          <FiClock size={12} className="text-slate-400 dark:text-slate-505" /> {formatDuration(entry.duration_seconds)}
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
    <section className={`overflow-hidden ${compact ? 'rounded-2xl' : 'rounded-[2rem]'} ${inkResultSoftPanel} ${className} transition-colors duration-300`}>
      <div className={`border-b border-[#ead9bd]/70 bg-[#fffaf2]/72 dark:border-slate-800 dark:bg-slate-900 ${compact ? 'p-4' : 'p-5 md:p-6'}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-100 dark:border-violet-900/30 bg-violet-50 dark:bg-violet-950/20 px-3 py-1 text-[11px] font-extrabold uppercase text-violet-700 dark:text-violet-400">
              <FiMonitor size={14} /> {badgeLabel}
            </div>
            <h2 className={`${compact ? 'text-xl' : 'text-2xl'} flex items-center gap-2 font-black dark:text-white ${inkResultTitle}`}>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-500">
                <FiStar size={16} />
              </span>
              Bảng vàng thành tích
            </h2>
            <p className={`mt-1 max-w-2xl text-xs font-bold ${inkResultMuted}`}>
              {description || `Vinh danh những bài làm nổi bật nhất của ${examTitle || 'đề hiện tại'}.`}
            </p>
          </div>
          
          <div className="flex gap-2 self-start md:self-auto">
            <div className="rounded-xl border border-[#ead9bd]/75 bg-[#fffaf2]/72 dark:border-slate-800 dark:bg-slate-900 px-3 py-2 text-center min-w-[90px]">
              <p className={`flex items-center justify-center gap-1 text-[9px] font-black uppercase ${inkResultMuted}`}><FiUsers size={10} /> Thí sinh</p>
              <p className={`text-lg font-black mt-0.5 ${inkResultTitle}`}>{entries.length}</p>
            </div>
            <div className="rounded-xl border border-[#ead9bd]/75 bg-[#fffaf2]/72 dark:border-slate-800 dark:bg-slate-900 px-3 py-2 text-center min-w-[90px]">
              <p className={`flex items-center justify-center gap-1 text-[9px] font-black uppercase ${inkResultMuted}`}><FiAward size={10} /> Phạm vi</p>
              <p className={`text-xs font-black mt-1.5 truncate max-w-[80px] ${inkResultTitle}`} title={scopeLabel}>{scopeLabel}</p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className={`flex items-center justify-center ${compact ? 'min-h-[200px] p-6' : 'min-h-[260px] p-8'}`}>
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 dark:border-slate-800 border-t-violet-600" />
        </div>
      ) : entries.length === 0 ? (
        <div className={`flex flex-col items-center justify-center text-center bg-[#fffaf2]/72 dark:bg-slate-900 ${compact ? 'min-h-[200px] p-6' : 'min-h-[260px] p-8'}`}>
          <FiTrendingUp size={36} className="mb-2 text-slate-300 dark:text-slate-700" />
          <p className={`text-base font-black ${inkResultTitle}`}>{emptyTitle}</p>
          <p className={`mt-1 max-w-md text-xs font-bold ${inkResultMuted}`}>
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
            <div className="overflow-x-auto rounded-[24px] border border-[#ead9bd]/80 bg-[#fffaf2]/78 pb-2 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full min-w-[840px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-50 dark:border-slate-800 text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-50/40 dark:bg-slate-800/40">
                    <th className="w-20 px-6 py-4 text-center">HANG</th>
                    <th className="min-w-[210px] px-6 py-4">THÍ SINH</th>
                    <th className="min-w-[150px] px-6 py-4">PHÒNG THI</th>
                    <th className="min-w-[105px] px-6 py-4 text-center">SỐ LẦN THI</th>
                    <th className="min-w-[135px] px-6 py-4 text-center">ĐIỂM CAO NHẤT</th>
                    <th className="min-w-[155px] px-6 py-4 text-center">THỜI GIAN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
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
                      <tr key={entry.user_id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-4 px-6 text-center font-bold text-slate-850 dark:text-slate-350">
                          {entry.rank}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            {entry.avatar_url ? (
                              <img
                                src={entry.avatar_url}
                                alt={entry.full_name}
                                className="w-9 h-9 rounded-full object-cover border border-slate-100 dark:border-slate-800 shadow-sm"
                              />
                            ) : (
                              <div className={`w-9 h-9 rounded-full ${getAvatarBg(entry.full_name)} text-white font-extrabold flex items-center justify-center text-xs border border-white dark:border-slate-800 shadow-sm`}>
                                {initials}
                              </div>
                            )}
                            <span className="font-extrabold text-slate-900 dark:text-slate-100">{entry.full_name}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 font-bold text-slate-650 dark:text-slate-450">
                          {getEntryMeta(entry, noRoomLabel)}
                        </td>
                        <td className="py-4 px-6 text-center font-bold text-slate-600 dark:text-slate-400">
                          {entry.total_attempts}
                        </td>
                        <td className="py-4 px-6 text-center font-black text-emerald-600 dark:text-emerald-500">
                          {formatScore(entry.total_score)}/100
                        </td>
                        <td className="min-w-[155px] whitespace-nowrap px-6 py-4 text-center font-bold text-slate-500 dark:text-slate-400">
                          <div className="inline-flex items-center justify-center gap-1.5">
                            <FiClock className="text-slate-400 dark:text-slate-500" size={13} />
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
          
          <div className="text-center text-xs font-bold text-slate-400 dark:text-slate-505 mt-4 flex items-center justify-center gap-1">
            <span>ⓘ</span>
            <span>Bảng xếp hạng được cập nhật liên tục sau mỗi lượt thi</span>
          </div>
        </div>
      )}
    </section>
  );
}
