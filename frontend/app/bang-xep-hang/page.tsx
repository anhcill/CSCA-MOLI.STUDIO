'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { FiAward, FiClock, FiCalendar, FiChevronDown, FiRefreshCw, FiTrendingUp, FiTarget } from 'react-icons/fi';
import Header from '@/components/layout/Header';
import { useAuthStore } from '@/lib/store/authStore';

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
                className="shrink-0 rounded-full object-cover border-2 border-white shadow-sm"
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
            className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 font-extrabold text-white border-2 border-white shadow-sm"
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
            avatar: 72,
            height: 'h-[350px]',
            wreathColor: 'gold' as const,
        };
    }
    if (rank === 2) {
        return {
            badgeColor: 'bg-[#4FA2FF]',
            shell: 'border-[#D0E7FF] bg-gradient-to-b from-[#F5FAFF] via-white to-[#EBF5FF] shadow-sm shadow-blue-100/40',
            score: 'bg-[#3B82F6] text-white',
            avatar: 64,
            height: 'h-[310px]',
            wreathColor: 'blue' as const,
        };
    }
    return {
        badgeColor: 'bg-[#FF7894]',
        shell: 'border-[#FFE4E6] bg-gradient-to-b from-[#FFF5F6] via-white to-[#FFEBEF] shadow-sm shadow-rose-100/40',
        score: 'bg-[#EC4899] text-white',
        avatar: 58,
        height: 'h-[280px]',
        wreathColor: 'pink' as const,
    };
}

function PodiumCard({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
    const tone = getRankTone(entry.rank);

    return (
        <div className={`relative flex flex-col items-center justify-between rounded-[24px] border px-4 pb-6 pt-8 ${tone.shell} ${tone.height} ${
            entry.rank === 1 ? 'order-1 md:order-2' : entry.rank === 2 ? 'order-2 md:order-1' : 'order-3 md:order-3'
        }`}>
            {/* Wreaths background */}
            <LaurelWreath color={tone.wreathColor} />

            {/* Ribbon Badge */}
            <Ribbon rank={entry.rank} colorClass={tone.badgeColor} />

            {/* Avatar & Crown */}
            <div className="relative flex flex-col items-center z-10 w-full">
                <div className="relative mb-2 mt-2">
                    {entry.rank === 1 && <Crown />}
                    <Avatar name={entry.full_name} url={entry.avatar_url} size={tone.avatar} />
                </div>

                <h3 className="font-extrabold text-slate-900 text-base text-center line-clamp-1 max-w-[90%] mt-2">
                    {entry.full_name}{isMe ? ' (Bạn)' : ''}
                </h3>
                
                <p className="mt-1 text-[11px] font-bold text-slate-500 text-center">
                    {entry.total_attempts} lần thi · ĐTB: {formatScore(entry.avg_score)}/100
                </p>
            </div>

            {/* Score box & Time */}
            <div className="relative flex flex-col items-center w-full z-10">
                <div className={`w-32 py-2 rounded-xl text-center shadow-sm font-black ${tone.score}`}>
                    <p className="text-2xl leading-none">{formatScore(entry.best_score)}</p>
                    <p className="text-[10px] font-bold opacity-90 mt-0.5">điểm</p>
                </div>

                <p className="mt-3.5 inline-flex items-center gap-1 text-[11px] font-bold text-slate-500">
                    <FiClock size={12} className="text-slate-400" /> {formatDuration(entry.best_time_spent)}
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
            console.error('Leaderboard error:', err);
            setEntries([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLeaderboard();
    }, [period]);

    // Handle clicks outside of dropdown to close it
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
        <div className="min-h-screen bg-[#F8FAFC]">
            <Header />

            <div className="mx-auto max-w-5xl px-4 py-8">
                {/* Header section matching the reference image */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                            🏆 BẢNG XẾP HẠNG
                        </h1>
                        <p className="text-xs font-bold text-slate-400 mt-1">Cập nhật theo thời gian thực</p>
                    </div>
                    
                    <div className="flex items-center gap-2 self-end sm:self-auto" ref={dropdownRef}>
                        <button
                            onClick={loadLeaderboard}
                            disabled={loading}
                            className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-700 shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                            title="Làm mới"
                        >
                            <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                        
                        <div className="relative">
                            <button
                                onClick={() => setDropdownOpen(!dropdownOpen)}
                                className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                            >
                                <FiCalendar className="text-slate-400" size={16} />
                                <span>{period === 'week' ? 'Tuần này' : 'Toàn hệ thống'}</span>
                                <FiChevronDown className="text-slate-400" size={16} />
                            </button>
                            {dropdownOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-100 rounded-xl shadow-lg z-30 overflow-hidden">
                                    <button
                                        onClick={() => { setPeriod('week'); setDropdownOpen(false); }}
                                        className={`w-full text-left px-4 py-2.5 text-sm font-bold hover:bg-slate-50 transition-colors ${period === 'week' ? 'text-violet-600 bg-violet-50/50' : 'text-slate-700'}`}
                                    >
                                        Tuần này
                                    </button>
                                    <button
                                        onClick={() => { setPeriod('all'); setDropdownOpen(false); }}
                                        className={`w-full text-left px-4 py-2.5 text-sm font-bold hover:bg-slate-50 transition-colors ${period === 'all' ? 'text-violet-600 bg-violet-50/50' : 'text-slate-700'}`}
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
                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-violet-600" />
                    </div>
                ) : entries.length === 0 ? (
                    <div className="flex min-h-[300px] flex-col items-center justify-center p-8 text-center bg-white rounded-[24px] border border-slate-100 shadow-sm">
                        <FiTrendingUp size={44} className="mb-3 text-slate-300" />
                        <p className="text-lg font-black text-slate-600">Chưa có dữ liệu</p>
                        <p className="mt-1 max-w-md text-sm font-semibold text-slate-400">
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
                            <div className="overflow-x-auto rounded-[24px] border border-slate-100 bg-white shadow-sm">
                                <table className="w-full text-left border-collapse min-w-[700px]">
                                    <thead>
                                        <tr className="border-b border-slate-50 text-[11px] font-black text-slate-400 uppercase tracking-wider bg-slate-50/40">
                                            <th className="py-4 px-6 text-center w-20">HANG</th>
                                            <th className="py-4 px-6">THÍ SINH</th>
                                            <th className="py-4 px-6 text-center">SỐ LẦN THI</th>
                                            <th className="py-4 px-6 text-center">ĐIỂM TRUNG BÌNH</th>
                                            <th className="py-4 px-6 text-center">ĐIỂM CAO NHẤT</th>
                                            <th className="py-4 px-6 text-center">THỜI GIAN GẦN NHẤT</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-sm">
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
                                                <tr key={entry.id} className={`hover:bg-slate-50/40 transition-colors ${isMe ? 'bg-violet-50/30' : ''}`}>
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
                                                                    className="w-9 h-9 rounded-full object-cover border border-slate-100 shadow-sm"
                                                                />
                                                            ) : (
                                                                <div className={`w-9 h-9 rounded-full ${getAvatarBg(entry.full_name)} text-white font-extrabold flex items-center justify-center text-xs border border-white shadow-sm`}>
                                                                    {initials}
                                                                </div>
                                                            )}
                                                            <span className="font-extrabold text-slate-900">
                                                                {entry.full_name} {isMe && <span className="text-violet-600 font-bold text-xs">(Bạn)</span>}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    
                                                    {/* Attempts */}
                                                    <td className="py-4 px-6 text-center font-bold text-slate-600">
                                                        {entry.total_attempts}
                                                    </td>
                                                    
                                                    {/* Average Score */}
                                                    <td className="py-4 px-6 text-center font-bold text-slate-600">
                                                        {formatScore(entry.avg_score)}/100
                                                    </td>
                                                    
                                                    {/* Highest Score */}
                                                    <td className="py-4 px-6 text-center font-black text-emerald-600">
                                                        {formatScore(entry.best_score)}/100
                                                    </td>
                                                    
                                                    {/* Latest Time */}
                                                    <td className="py-4 px-6 text-center font-bold text-slate-500">
                                                        <div className="inline-flex items-center gap-1.5">
                                                            <FiClock className="text-slate-400" size={13} />
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
                        
                        {/* Footer notice matching reference image */}
                        <div className="text-center text-xs font-bold text-slate-400 mt-6 flex items-center justify-center gap-1">
                            <span>ⓘ</span>
                            <span>Bảng xếp hạng được cập nhật liên tục sau mỗi lượt thi</span>
                        </div>
                    </div>
                )}

                {isAuthenticated && !myEntry && !loading && (
                    <div className="mt-8 rounded-2xl border border-dashed border-violet-300 bg-white p-6 text-center shadow-sm">
                        <FiTarget size={32} className="mx-auto mb-3 text-violet-400" />
                        <p className="font-bold text-gray-600">Bạn chưa có trên bảng xếp hạng</p>
                        <p className="mt-1 text-sm text-gray-400">Hoàn thành ít nhất 1 bài thi để xuất hiện</p>
                        <Link href="/exam-room" className="mt-4 inline-block rounded-full bg-violet-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700">
                            Thi ngay
                        </Link>
                    </div>
                )}

                {!isAuthenticated && !loading && entries.length > 0 && (
                    <div className="mt-6 text-center text-sm font-bold text-gray-500">
                        <Link href="/login" className="font-extrabold text-violet-600 hover:underline">Đăng nhập</Link>{' '}
                        để xem thứ hạng của bạn
                    </div>
                )}
            </div>
        </div>
    );
}
