'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { FiAward, FiClock, FiCalendar, FiChevronDown, FiRefreshCw, FiTrendingUp, FiTarget } from 'react-icons/fi';
import Header from '@/components/layout/Header';
import { useAuthStore } from '@/lib/store/authStore';
import InkResultBackground, {
    inkResultMuted,
    inkResultPanel,
    inkResultSoftPanel,
    inkResultTitle,
} from '@/components/layout/InkResultBackground';

type LeaderboardPeriod = 'week' | 'all';

interface LeaderboardEntry {
    rank: number;
    id: number;
    full_name: string;
    avatar_url: string | null;
    total_attempts: number;
    avg_score: number;
    best_score: number;
    best_time_spent?: number | null;
    last_attempt_at: string;
}

function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
    if (url) {
        return (
            <img
                src={url}
                alt={name}
                width={size}
                height={size}
                className="shrink-0 rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-sm"
                style={{ width: size, height: size }}
            />
        );
    }

    const initials = String(name || '?')
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

function formatDuration(seconds?: number | null) {
    if (!seconds || seconds <= 0) return 'Chưa có';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins <= 0) return `${secs}s`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatScore(score: number) {
    const value = Number(score) || 0;
    return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function formatRelativeTime(dateString?: string | null) {
    if (!dateString) return 'Chưa rõ';
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'Vừa xong';
        if (diffMins < 60) return `${diffMins} phút trước`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours} giờ trước`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays === 1) return 'Hôm qua';
        return `${diffDays} ngày trước`;
    } catch {
        return 'Chưa rõ';
    }
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
            className={`absolute top-0 left-4 w-7 h-11 ${colorClass} flex items-center justify-center font-extrabold text-white shadow-sm z-10`}
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
            avatar: 72,
            height: 'h-[330px]',
            wreathColor: 'text-[#F5D06E]',
        };
    }
    if (rank === 2) {
        return {
            badgeColor: 'bg-[#4FA2FF]',
            shell: 'border-[#D0E7FF] bg-gradient-to-b from-[#F5FAFF] via-white to-[#EBF5FF] shadow-sm shadow-blue-100/40',
            score: 'bg-[#3B82F6] text-white',
            avatar: 64,
            height: 'h-[295px]',
            wreathColor: 'text-[#9ECBFF]',
        };
    }
    return {
        badgeColor: 'bg-[#FF7894]',
        shell: 'border-[#FFE4E6] bg-gradient-to-b from-[#FFF5F6] via-white to-[#FFEBEF] shadow-sm shadow-rose-100/40',
        score: 'bg-[#EC4899] text-white',
        avatar: 58,
        height: 'h-[270px]',
        wreathColor: 'text-[#FFA1B5]',
    };
}

function PodiumCard({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
    const tone = getRankTone(entry.rank);

    return (
        <div className={`relative flex flex-col items-center justify-between rounded-[24px] border px-4 pb-5 pt-8 ${tone.shell} ${tone.height} ${
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

                    <Avatar name={entry.full_name} url={entry.avatar_url} size={tone.avatar} />
                </div>

                <h3 className="font-extrabold text-slate-900 text-[15px] text-center line-clamp-1 max-w-[90%] mt-2.5">
                    {entry.full_name}{isMe ? ' (Bạn)' : ''}
                </h3>
                
                <p className="mt-1 text-[11px] font-bold text-slate-500 text-center">
                    {entry.total_attempts} lần thi · ĐTB: {formatScore(entry.avg_score)}/100
                </p>
            </div>

            {/* Score box & Time */}
            <div className="relative flex flex-col items-center w-full z-10 mt-3">
                <div className={`w-32 py-2.5 rounded-2xl text-center shadow-sm font-black ${tone.score}`}>
                    <p className="text-2xl leading-none">{formatScore(entry.best_score)}</p>
                    <p className="text-[10px] font-bold opacity-90 mt-0.5">điểm</p>
                </div>

                <p className="mt-3.5 inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                    <FiClock size={12} className="text-slate-400 dark:text-slate-500" /> {formatDuration(entry.best_time_spent)}
                </p>
            </div>
        </div>
    );
}

export default function LeaderboardPage() {
    const { user, isAuthenticated } = useAuthStore();
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [period, setPeriod] = useState<LeaderboardPeriod>('week');
    const [dropdownOpen, setDropdownOpen] = useState(false);
    
    const dropdownRef = useRef<HTMLDivElement>(null);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

    const loadLeaderboard = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${apiUrl}/leaderboard?limit=20&period=${period}`);
            const json = await res.json();
            if (json.success) {
                setEntries(json.data);
                setLastUpdated(new Date());
            }
        } catch (err) {
            console.warn('Leaderboard error:', err);
            setEntries([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLeaderboard();
    }, [period]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const myEntry = isAuthenticated ? entries.find((entry) => entry.id === user?.id) : null;
    const podiumEntries = [entries[1], entries[0], entries[2]].filter(Boolean);
    const restEntries = entries.slice(3);

    return (
        <InkResultBackground className="transition-colors duration-300">
            <Header />

            <div className="mx-auto max-w-5xl px-4 py-8">
                {/* Header section */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                    <div>
                        <h1 className={`text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2 ${inkResultTitle}`}>
                            🏆 BẢNG XẾP HẠNG
                        </h1>
                        <p className={`text-xs font-bold mt-1 ${inkResultMuted}`}>Cập nhật theo thời gian thực</p>
                    </div>
                    
                    <div className="flex items-center gap-2 self-end sm:self-auto" ref={dropdownRef}>
                        <button
                            onClick={loadLeaderboard}
                            disabled={loading}
                            className="p-2.5 bg-[#fffaf2]/90 border border-[#ead9bd]/80 rounded-xl text-[#6f563f] hover:text-[#4f3521] shadow-sm hover:bg-white transition-colors disabled:opacity-50"
                            title="Làm mới"
                        >
                            <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                        
                        <div className="relative">
                            <button
                                onClick={() => setDropdownOpen(!dropdownOpen)}
                                className="flex items-center gap-2 px-4 py-2.5 bg-[#fffaf2]/90 rounded-xl border border-[#ead9bd]/80 text-sm font-bold text-[#4f3521] shadow-sm hover:bg-white transition-colors"
                            >
                                <FiCalendar className="text-slate-400" size={16} />
                                <span>{period === 'week' ? 'Tuần này' : 'Toàn hệ thống'}</span>
                                <FiChevronDown className="text-slate-400" size={16} />
                            </button>
                            {dropdownOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-[#fffaf2]/95 border border-[#ead9bd]/90 rounded-xl shadow-lg z-30 overflow-hidden backdrop-blur-md">
                                    <button
                                        onClick={() => { setPeriod('week'); setDropdownOpen(false); }}
                                        className={`w-full text-left px-4 py-2.5 text-sm font-bold hover:bg-white transition-colors ${period === 'week' ? 'text-violet-700 bg-violet-100/70' : 'text-slate-700'}`}
                                    >
                                        Tuần này
                                    </button>
                                    <button
                                        onClick={() => { setPeriod('all'); setDropdownOpen(false); }}
                                        className={`w-full text-left px-4 py-2.5 text-sm font-bold hover:bg-white transition-colors ${period === 'all' ? 'text-violet-700 bg-violet-100/70' : 'text-slate-700'}`}
                                    >
                                        Toàn hệ thống
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex min-h-[400px] items-center justify-center">
                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 dark:border-slate-800 border-t-violet-600" />
                    </div>
                ) : entries.length === 0 ? (
                    <div className={`flex min-h-[300px] flex-col items-center justify-center p-8 text-center rounded-[24px] ${inkResultPanel}`}>
                        <FiTrendingUp size={44} className="mb-3 text-slate-300 dark:text-slate-700" />
                        <p className={`text-lg font-black ${inkResultTitle}`}>Chưa có dữ liệu</p>
                        <p className={`mt-1 max-w-md text-sm font-semibold ${inkResultMuted}`}>
                            Hãy hoàn thành ít nhất 1 bài thi để xuất hiện trên bảng xếp hạng.
                        </p>
                        <Link href="/exam-room" className="mt-4 inline-block rounded-full bg-violet-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700">
                            Thi ngay
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Podium (Top 3) */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end max-w-4xl mx-auto py-4">
                            {podiumEntries.map((entry) => (
                                <PodiumCard key={entry.id} entry={entry} isMe={isAuthenticated && entry.id === user?.id} />
                            ))}
                        </div>

                        {/* Table (Ranks 4+) */}
                        {restEntries.length > 0 && (
                            <div className={`overflow-x-auto rounded-[24px] pb-2 ${inkResultSoftPanel}`}>
                                <table className="w-full min-w-[860px] border-collapse text-left">
                                    <thead>
                                        <tr className="border-b border-[#dfcfb9] text-[11px] font-black text-[#725d48] uppercase tracking-wider bg-[#f4eadc]/90">
                                            <th className="w-20 px-6 py-4 text-center">HANG</th>
                                            <th className="min-w-[220px] px-6 py-4">THÍ SINH</th>
                                            <th className="min-w-[105px] px-6 py-4 text-center">SỐ LẦN THI</th>
                                            <th className="min-w-[135px] px-6 py-4 text-center">ĐIỂM TRUNG BÌNH</th>
                                            <th className="min-w-[135px] px-6 py-4 text-center">ĐIỂM CAO NHẤT</th>
                                            <th className="min-w-[170px] px-6 py-4 text-center">THỜI GIAN GẦN NHẤT</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#dfcfb9] bg-[#fffaf2]/90 text-sm text-slate-800">
                                        {restEntries.map((entry) => {
                                            const isMe = isAuthenticated && entry.id === user?.id;
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
                                                <tr key={entry.id} className={`hover:bg-[#fff3df] transition-colors ${isMe ? 'bg-violet-100/80' : ''}`}>
                                                    {/* Rank */}
                                                    <td className="py-4 px-6 text-center font-bold text-slate-800">
                                                        {entry.rank}
                                                    </td>
                                                    
                                                    {/* Candidate */}
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
                                                            <span className="font-extrabold text-slate-900">
                                                                {entry.full_name} {isMe && <span className="text-violet-600 dark:text-violet-400 font-bold text-xs">(Bạn)</span>}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    
                                                    {/* Attempts */}
                                                    <td className="py-4 px-6 text-center font-bold text-slate-700">
                                                        {entry.total_attempts}
                                                    </td>
                                                    
                                                    {/* Average Score */}
                                                    <td className="py-4 px-6 text-center font-bold text-slate-700">
                                                        {formatScore(entry.avg_score)}/100
                                                    </td>
                                                    
                                                    {/* Highest Score */}
                                                    <td className="py-4 px-6 text-center font-black text-emerald-700">
                                                        {formatScore(entry.best_score)}/100
                                                    </td>
                                                    
                                                    {/* Latest Time */}
                                                    <td className="min-w-[170px] whitespace-nowrap px-6 py-4 text-center font-bold text-slate-600">
                                                        <div className="inline-flex items-center gap-1.5">
                                                            <FiClock className="text-slate-400 dark:text-slate-500" size={13} />
                                                            <span>{formatRelativeTime(entry.last_attempt_at)}</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        
                        {/* Footer notice */}
                        <div className="text-center text-xs font-bold text-slate-400 dark:text-slate-500 mt-6 flex items-center justify-center gap-1">
                            <span>ⓘ</span>
                            <span>Bảng xếp hạng được cập nhật liên tục sau mỗi lượt thi</span>
                        </div>
                    </div>
                )}

                {isAuthenticated && !myEntry && !loading && (
                    <div className="mt-8 rounded-2xl border border-dashed border-[#d9b784] bg-[#fffaf2]/90 p-6 text-center shadow-sm backdrop-blur-md">
                        <FiTarget size={32} className="mx-auto mb-3 text-violet-400" />
                        <p className={`font-bold ${inkResultTitle}`}>Bạn chưa có trên bảng xếp hạng</p>
                        <p className={`mt-1 text-sm ${inkResultMuted}`}>Hoàn thành ít nhất 1 bài thi để xuất hiện</p>
                        <Link href="/exam-room" className="mt-4 inline-block rounded-full bg-violet-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700">
                            Thi ngay
                        </Link>
                    </div>
                )}

                {!isAuthenticated && !loading && entries.length > 0 && (
                    <div className="mt-6 text-center text-sm font-bold text-gray-500 dark:text-slate-400">
                        <Link href="/login" className="font-extrabold text-violet-600 dark:text-violet-400 hover:underline">Đăng nhập</Link>{' '}
                        để xem thứ hạng của bạn
                    </div>
                )}
            </div>
        </InkResultBackground>
    );
}
