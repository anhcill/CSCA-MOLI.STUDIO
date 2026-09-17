'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
    FiAward,
    FiClock,
    FiRefreshCw,
    FiTrendingUp,
    FiTarget,
    FiZap,
    FiStar,
} from 'react-icons/fi';
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

function Avatar({ name, url, size = 48, ringClass = '' }: { name: string; url?: string | null; size?: number; ringClass?: string }) {
    if (url) {
        return (
            <img
                src={url}
                alt={name}
                width={size}
                height={size}
                className={`shrink-0 rounded-full object-cover border-2 shadow-md ${ringClass || 'border-white dark:border-slate-800'}`}
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
            className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 font-black text-white shadow-md border-2 ${ringClass || 'border-white dark:border-slate-800'}`}
            style={{ width: size, height: size, fontSize: size * 0.38 }}
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
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <svg className="w-9 h-9 drop-shadow-[0_4px_10px_rgba(251,191,36,0.5)] animate-bounce" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 6L6 14L12 8L18 14L22 6L17 19H7L2 6Z" fill="url(#crown-gold)" />
                <path d="M17 19H7V21H17V19Z" fill="#D97706" />
                <circle cx="2" cy="5" r="1.5" fill="#FEF08A" />
                <circle cx="12" cy="7" r="1.5" fill="#FEF08A" />
                <circle cx="22" cy="5" r="1.5" fill="#FEF08A" />
                <defs>
                    <linearGradient id="crown-gold" x1="2" y1="6" x2="22" y2="21" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#FDE047" />
                        <stop offset="0.5" stopColor="#F59E0B" />
                        <stop offset="1" stopColor="#D97706" />
                    </linearGradient>
                </defs>
            </svg>
        </div>
    );
}

function LaurelWreath({ colorClass }: { colorClass: string }) {
    return (
        <>
            <div className="absolute top-1/2 -left-7 -translate-y-1/2 pointer-events-none z-0">
                <svg className={`w-5 h-16 ${colorClass}`} viewBox="0 0 24 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 54C12 48 8 36 8 22C8 14 10 4 10 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.65"/>
                    <path d="M10 6C7 8 4 11 4 15C4 17 6 18 9 16C12 14 12 9 10 6Z" fill="currentColor" opacity="0.85"/>
                    <path d="M9 17C6 19 3 23 3 27C3 29 5 30 8 28C11 26 11 21 9 17Z" fill="currentColor" opacity="0.85"/>
                    <path d="M10 29C7 31 4 35 4 39C4 41 6 42 9 40C12 38 12 33 10 29Z" fill="currentColor" opacity="0.85"/>
                    <path d="M12 41C9 43 7 47 7 51C7 53 9 54 12 52C15 50 15 45 12 41Z" fill="currentColor" opacity="0.85"/>
                </svg>
            </div>
            <div className="absolute top-1/2 -right-7 -translate-y-1/2 pointer-events-none z-0">
                <svg className={`w-5 h-16 ${colorClass}`} viewBox="0 0 24 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 54C12 48 16 36 16 22C16 14 14 4 14 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.65"/>
                    <path d="M14 6C17 8 20 11 20 15C20 17 18 18 15 16C12 14 12 9 14 6Z" fill="currentColor" opacity="0.85"/>
                    <path d="M15 17C18 19 21 23 21 27C21 29 19 30 16 28C13 26 13 21 15 17Z" fill="currentColor" opacity="0.85"/>
                    <path d="M14 29C17 31 20 35 20 39C20 41 18 42 15 40C12 38 12 33 14 29Z" fill="currentColor" opacity="0.85"/>
                    <path d="M12 41C15 43 17 47 17 51C17 53 15 54 12 52C9 50 9 45 12 41Z" fill="currentColor" opacity="0.85"/>
                </svg>
            </div>
        </>
    );
}

function getRankTone(rank: number) {
    if (rank === 1) {
        return {
            badgeBg: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950 font-black shadow-[0_4px_12px_rgba(245,158,11,0.4)]',
            cardBg: 'bg-gradient-to-b from-[#fffef5] via-white to-[#fff8e1] dark:from-slate-800/95 dark:via-slate-850/95 dark:to-slate-900/95 border-amber-300 dark:border-amber-500/40 shadow-[0_12px_35px_rgba(245,158,11,0.18)] dark:shadow-[0_12px_35px_rgba(245,158,11,0.15)]',
            scoreBg: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-md shadow-amber-500/30 dark:shadow-none',
            avatarRing: 'border-amber-400 ring-4 ring-amber-300/40 dark:ring-amber-500/30',
            wreath: 'text-amber-400 dark:text-amber-400',
            avatarSize: 76,
            minHeight: 'min-h-[350px]',
            order: 'order-1 md:order-2',
            glowColor: 'bg-amber-400/20',
            label: 'Quán Quân',
        };
    }
    if (rank === 2) {
        return {
            badgeBg: 'bg-gradient-to-r from-sky-400 to-blue-500 text-white font-black shadow-[0_4px_12px_rgba(56,189,248,0.35)]',
            cardBg: 'bg-gradient-to-b from-[#f6faff] via-white to-[#edf5ff] dark:from-slate-800/95 dark:via-slate-850/95 dark:to-slate-900/95 border-sky-300 dark:border-sky-500/40 shadow-[0_10px_30px_rgba(56,189,248,0.12)] dark:shadow-[0_10px_30px_rgba(56,189,248,0.12)]',
            scoreBg: 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30 dark:shadow-none',
            avatarRing: 'border-sky-400 ring-4 ring-sky-300/40 dark:ring-sky-500/30',
            wreath: 'text-sky-400 dark:text-sky-400',
            avatarSize: 64,
            minHeight: 'min-h-[310px]',
            order: 'order-2 md:order-1',
            glowColor: 'bg-sky-400/15',
            label: 'Á Quân',
        };
    }
    return {
        badgeBg: 'bg-gradient-to-r from-rose-400 to-pink-500 text-white font-black shadow-[0_4px_12px_rgba(244,63,94,0.35)]',
        cardBg: 'bg-gradient-to-b from-[#fff7f8] via-white to-[#ffedf0] dark:from-slate-800/95 dark:via-slate-850/95 dark:to-slate-900/95 border-rose-300 dark:border-rose-500/40 shadow-[0_10px_30px_rgba(244,63,94,0.12)] dark:shadow-[0_10px_30px_rgba(244,63,94,0.12)]',
        scoreBg: 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-md shadow-rose-500/30 dark:shadow-none',
        avatarRing: 'border-rose-400 ring-4 ring-rose-300/40 dark:ring-rose-500/30',
        wreath: 'text-rose-400 dark:text-rose-400',
        avatarSize: 58,
        minHeight: 'min-h-[290px]',
        order: 'order-3 md:order-3',
        glowColor: 'bg-rose-400/15',
        label: 'Quý Quân',
    };
}

function PodiumCard({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
    const tone = getRankTone(entry.rank);

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: entry.rank === 1 ? 0.1 : entry.rank === 2 ? 0.2 : 0.3 }}
            whileHover={{ y: -8, transition: { duration: 0.25 } }}
            className={`relative flex flex-col items-center justify-between rounded-[28px] border-2 p-5 ${tone.cardBg} ${tone.minHeight} ${tone.order} transition-all backdrop-blur-xl group overflow-hidden`}
        >
            <div className={`absolute -top-16 left-1/2 -translate-x-1/2 w-44 h-44 rounded-full ${tone.glowColor} blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-500`} />

            <div className="w-full flex items-center justify-between z-10">
                <span className={`px-3 py-1 rounded-full text-xs uppercase tracking-wider ${tone.badgeBg}`}>
                    #{entry.rank} {tone.label}
                </span>
                {isMe && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-violet-600 text-white shadow-sm animate-pulse">
                        Bạn
                    </span>
                )}
            </div>

            <div className="relative flex flex-col items-center z-10 w-full mt-2">
                <div className="relative mb-2">
                    {entry.rank === 1 && <Crown />}
                    <LaurelWreath colorClass={tone.wreath} />
                    <Avatar name={entry.full_name} url={entry.avatar_url} size={tone.avatarSize} ringClass={tone.avatarRing} />
                </div>

                <h3 className="font-black text-slate-900 dark:text-white text-base md:text-lg text-center line-clamp-1 max-w-[92%] mt-2 tracking-tight group-hover:text-violet-600 dark:group-hover:text-amber-400 transition-colors">
                    {entry.full_name}
                </h3>
                
                <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400 text-center flex items-center gap-1.5">
                    <span>{entry.total_attempts} lượt thi</span>
                    <span>•</span>
                    <span>ĐTB: <strong className="text-slate-700 dark:text-slate-200">{formatScore(entry.avg_score)}</strong></span>
                </p>
            </div>

            <div className="relative flex flex-col items-center w-full z-10 mt-4">
                <div className={`w-full max-w-[170px] py-2.5 px-4 rounded-2xl text-center font-black ${tone.scoreBg} transform group-hover:scale-105 transition-transform`}>
                    <p className="text-2xl md:text-3xl leading-none font-black tracking-tight">{formatScore(entry.best_score)}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-90 mt-0.5">Điểm cao nhất</p>
                </div>

                <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <FiClock size={13} className="text-slate-400" />
                    <span>{formatDuration(entry.best_time_spent)}</span>
                </p>
            </div>
        </motion.div>
    );
}

export default function LeaderboardPage() {
    const { user, isAuthenticated } = useAuthStore();
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<LeaderboardPeriod>('week');

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

    const loadLeaderboard = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${apiUrl}/leaderboard?limit=30&period=${period}`);
            const json = await res.json();
            if (json.success) {
                setEntries(json.data);
                if (json.data?.length > 0) {
                    try {
                        confetti({
                            particleCount: 45,
                            spread: 70,
                            origin: { y: 0.35 },
                            colors: ['#F59E0B', '#38BDF8', '#FB7185', '#A855F7']
                        });
                    } catch {}
                }
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

    const myEntry = isAuthenticated ? entries.find((entry) => entry.id === user?.id) : null;
    const podiumEntries = [entries[1], entries[0], entries[2]].filter(Boolean);
    const restEntries = entries.slice(3);

    return (
        <InkResultBackground className="transition-colors duration-300">
            <Header />

            <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/40 border border-amber-300/60 dark:border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-black uppercase tracking-wider mb-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                            <span>Bảng vàng vinh danh</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                            <span>🏆</span>
                            <span>BẢNG XẾP HẠNG</span>
                        </h1>
                        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                            <span>Cập nhật theo thời gian thực từ các phòng thi</span>
                        </p>
                    </div>
                    
                    {/* Period Switcher & Refresh */}
                    <div className="flex items-center gap-3 self-start md:self-auto">
                        <div className="p-1 rounded-2xl bg-slate-200/80 dark:bg-slate-800/80 border border-slate-300/60 dark:border-slate-700 flex items-center shadow-inner">
                            <button
                                onClick={() => setPeriod('week')}
                                className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                                    period === 'week'
                                        ? 'bg-white dark:bg-slate-900 text-violet-700 dark:text-violet-300 shadow-sm'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                Tuần này
                            </button>
                            <button
                                onClick={() => setPeriod('all')}
                                className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                                    period === 'all'
                                        ? 'bg-white dark:bg-slate-900 text-violet-700 dark:text-violet-300 shadow-sm'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                Toàn hệ thống
                            </button>
                        </div>

                        <button
                            onClick={loadLeaderboard}
                            disabled={loading}
                            className="p-3 bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-600 dark:text-slate-300 hover:text-violet-600 dark:hover:text-white shadow-sm hover:shadow-md transition-all active:scale-95 disabled:opacity-50"
                            title="Làm mới bảng xếp hạng"
                        >
                            <FiRefreshCw size={17} className={loading ? 'animate-spin text-violet-600' : ''} />
                        </button>
                    </div>
                </div>

                {/* My Ranking Banner */}
                {isAuthenticated && myEntry && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-8 rounded-2xl border-2 border-violet-500/40 bg-gradient-to-r from-violet-600/10 via-purple-600/10 to-indigo-600/10 dark:from-violet-950/40 dark:via-purple-950/30 dark:to-slate-900 p-4 md:p-5 shadow-lg backdrop-blur-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                    >
                        <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white font-black text-xl shadow-md">
                                #{myEntry.rank}
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                                    Thành tích hiện tại của bạn
                                </p>
                                <h4 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                    <span>{myEntry.full_name}</span>
                                    <span className="text-xs font-bold text-slate-400">({myEntry.total_attempts} lượt thi)</span>
                                </h4>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 self-end sm:self-auto">
                            <div className="text-right">
                                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Điểm cao nhất</p>
                                <p className="text-2xl font-black text-violet-600 dark:text-violet-400">{formatScore(myEntry.best_score)} <span className="text-xs">điểm</span></p>
                            </div>
                            <Link
                                href="/exam-room"
                                className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-black shadow-md shadow-violet-500/30 transition-transform active:scale-95"
                            >
                                Thi cải thiện
                            </Link>
                        </div>
                    </motion.div>
                )}

                {loading ? (
                    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
                        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 dark:border-slate-800 border-t-violet-600" />
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Đang tải bảng xếp hạng...</p>
                    </div>
                ) : entries.length === 0 ? (
                    <div className="flex min-h-[340px] flex-col items-center justify-center p-8 text-center rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-xl">
                        <div className="w-16 h-16 rounded-full bg-violet-100 dark:bg-violet-950/50 flex items-center justify-center text-violet-600 dark:text-violet-400 mb-4">
                            <FiTrendingUp size={32} />
                        </div>
                        <p className="text-xl font-black text-slate-900 dark:text-white">Chưa có dữ liệu xếp hạng</p>
                        <p className="mt-1.5 max-w-md text-sm font-semibold text-slate-500 dark:text-slate-400">
                            Hãy hoàn thành ít nhất một bài thi mô phỏng để ghi danh trên bảng vàng thành tích!
                        </p>
                        <Link href="/exam-room" className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-2.5 text-sm font-black text-white shadow-lg shadow-violet-500/25 transition-transform hover:scale-105">
                            <FiZap size={16} />
                            <span>Vào phòng thi ngay</span>
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-10">
                        {/* Podium Top 3 */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end max-w-4xl mx-auto pt-6 pb-2">
                            {podiumEntries.map((entry) => (
                                <PodiumCard key={entry.id} entry={entry} isMe={isAuthenticated && entry.id === user?.id} />
                            ))}
                        </div>

                        {/* Ranks 4+ Table */}
                        {restEntries.length > 0 && (
                            <div className="overflow-hidden rounded-[28px] border border-slate-200/90 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-xl">
                                <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                        <FiAward className="text-violet-600 dark:text-violet-400" size={16} />
                                        <span>Bảng tổng sắp (Top 4 - ${entries.length})</span>
                                    </h3>
                                    <span className="text-xs font-semibold text-slate-400">
                                        Tổng ${entries.length} thí sinh
                                    </span>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[820px] border-collapse text-left">
                                        <thead>
                                            <tr className="border-b border-slate-200/60 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-850/60 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                <th className="w-20 px-6 py-4 text-center">HẠNG</th>
                                                <th className="min-w-[220px] px-6 py-4">THÍ SINH</th>
                                                <th className="min-w-[110px] px-6 py-4 text-center">LƯỢT THI</th>
                                                <th className="min-w-[130px] px-6 py-4 text-center">ĐIỂM TRUNG BÌNH</th>
                                                <th className="min-w-[140px] px-6 py-4 text-center">ĐIỂM CAO NHẤT</th>
                                                <th className="min-w-[160px] px-6 py-4 text-center">HOÀN THÀNH</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
                                            {restEntries.map((entry) => {
                                                const isMe = isAuthenticated && entry.id === user?.id;

                                                return (
                                                    <tr
                                                        key={entry.id}
                                                        className={`transition-colors ${
                                                            isMe
                                                                ? 'bg-violet-100/60 dark:bg-violet-950/40 font-bold'
                                                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                                        }`}
                                                    >
                                                        <td className="py-4 px-6 text-center">
                                                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-xl text-xs font-black ${
                                                                entry.rank <= 5
                                                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                                            }`}>
                                                                {entry.rank}
                                                            </span>
                                                        </td>
                                                        
                                                        <td className="py-4 px-6">
                                                            <div className="flex items-center gap-3">
                                                                <Avatar name={entry.full_name} url={entry.avatar_url} size={38} />
                                                                <div className="min-w-0">
                                                                    <p className="font-black text-slate-900 dark:text-white truncate">
                                                                        {entry.full_name}
                                                                        {isMe && (
                                                                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-violet-600 text-white">
                                                                                Bạn
                                                                            </span>
                                                                        )}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        
                                                        <td className="py-4 px-6 text-center font-bold text-slate-600 dark:text-slate-300">
                                                            {entry.total_attempts}
                                                        </td>
                                                        
                                                        <td className="py-4 px-6 text-center font-bold text-slate-600 dark:text-slate-300">
                                                            {formatScore(entry.avg_score)}/100
                                                        </td>
                                                        
                                                        <td className="py-4 px-6 text-center">
                                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                                                                {formatScore(entry.best_score)} đ
                                                            </span>
                                                        </td>
                                                        
                                                        <td className="py-4 px-6 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                                                            <div className="inline-flex items-center gap-1.5">
                                                                <FiClock size={12} className="text-slate-400" />
                                                                <span>{formatRelativeTime(entry.last_attempt_at)}</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        
                        <div className="text-center text-xs font-semibold text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5 pt-2">
                            <FiStar size={13} className="text-amber-400" />
                            <span>Bảng xếp hạng được tính toán tự động dựa trên Điểm cao nhất và Thời gian làm bài</span>
                        </div>
                    </div>
                )}

                {isAuthenticated && !myEntry && !loading && (
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-10 rounded-3xl border-2 border-dashed border-violet-300 dark:border-violet-900/50 bg-violet-50/70 dark:bg-slate-900/70 p-8 text-center backdrop-blur-xl shadow-lg"
                    >
                        <div className="w-14 h-14 rounded-2xl bg-violet-600 text-white flex items-center justify-center mx-auto mb-3 shadow-md shadow-violet-500/30">
                            <FiTarget size={28} />
                        </div>
                        <h4 className="text-lg font-black text-slate-900 dark:text-white">Bạn chưa có mặt trên bảng xếp hạng</h4>
                        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                            Chỉ cần hoàn thành 1 bài thi mô phỏng bất kỳ, tên của bạn sẽ lập tức xuất hiện tại đây!
                        </p>
                        <Link
                            href="/exam-room"
                            className="mt-5 inline-flex items-center gap-2 rounded-full bg-violet-600 hover:bg-violet-700 px-6 py-2.5 text-sm font-black text-white shadow-md shadow-violet-500/30 transition-transform hover:scale-105"
                        >
                            <FiZap size={16} />
                            <span>Luyện đề & Thi ngay</span>
                        </Link>
                    </motion.div>
                )}

                {!isAuthenticated && !loading && entries.length > 0 && (
                    <div className="mt-8 text-center text-sm font-bold text-slate-500 dark:text-slate-400">
                        <Link href="/login" className="font-black text-violet-600 dark:text-violet-400 hover:underline">
                            Đăng nhập
                        </Link>{' '}
                        để lưu thành tích và so tài cùng các thí sinh khác.
                    </div>
                )}
            </div>
        </InkResultBackground>
    );
}
