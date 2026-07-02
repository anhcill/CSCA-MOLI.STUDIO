'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FiAward, FiClock, FiHash, FiMonitor, FiRefreshCw, FiStar, FiTarget, FiTrendingUp, FiUsers } from 'react-icons/fi';
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
                className="shrink-0 rounded-full object-cover ring-4 ring-white"
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
            className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 font-black text-white ring-4 ring-white"
            style={{ width: size, height: size, fontSize: size * 0.38 }}
        >
            {initials}
        </div>
    );
}

function formatDuration(seconds?: number | null) {
    if (!seconds || seconds <= 0) return 'Chưa có thời gian';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins <= 0) return `${secs}s`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatScore(score: number) {
    const value = Number(score) || 0;
    return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function getRankTone(rank: number) {
    if (rank === 1) {
        return {
            badge: 'border-amber-200 bg-amber-50 text-amber-700',
            shell: 'order-1 border-amber-200 shadow-xl shadow-amber-100/80 ring-1 ring-amber-100 md:order-2 md:w-full',
            accent: 'from-amber-300 via-amber-400 to-orange-400',
            score: 'bg-slate-950 shadow-lg shadow-amber-200/70',
            avatar: 64,
            height: 'min-h-[310px]',
        };
    }
    if (rank === 2) {
        return {
            badge: 'border-cyan-200 bg-cyan-50 text-cyan-700',
            shell: 'order-2 border-cyan-200 shadow-lg shadow-cyan-100/80 md:order-1 md:mx-auto md:w-[96%]',
            accent: 'from-cyan-300 via-sky-400 to-teal-400',
            score: 'bg-slate-900 shadow-md shadow-cyan-100/80',
            avatar: 56,
            height: 'min-h-[268px]',
        };
    }
    return {
        badge: 'border-rose-200 bg-rose-50 text-rose-700',
        shell: 'order-3 border-rose-200 shadow-md shadow-rose-100/80 md:order-3 md:mx-auto md:w-[92%]',
        accent: 'from-rose-300 via-pink-400 to-red-400',
        score: 'bg-slate-900 shadow-sm shadow-rose-100/80',
        avatar: 50,
        height: 'min-h-[248px]',
    };
}

function PodiumCard({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
    const tone = getRankTone(entry.rank);

    return (
        <div className={`relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border bg-gradient-to-b from-white via-white to-slate-50/80 p-4 text-center transition-all ${tone.height} ${tone.shell}`}>
            <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${tone.accent}`} />
            <div className="absolute inset-x-5 top-6 h-px bg-gradient-to-r from-transparent via-slate-100 to-transparent" />
            <div className="relative z-10 flex flex-col items-center">
                <div className={`mb-3 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${tone.badge}`}>
                    <FiAward size={14} /> #{entry.rank}
                </div>
                <Avatar name={entry.full_name} url={entry.avatar_url} size={tone.avatar} />
                <h3 className="mt-3 min-h-[40px] line-clamp-2 text-base font-black text-slate-950">
                    {entry.full_name}{isMe ? ' (Bạn)' : ''}
                </h3>
                <p className="mt-1 text-xs font-bold text-slate-500">
                    {entry.total_attempts} lần thi · ĐTB: {formatScore(entry.avg_score)}/100
                </p>
                <div className={`mt-4 rounded-2xl px-5 py-3 text-white ${tone.score}`}>
                    <p className="text-2xl font-black">{formatScore(entry.best_score)}</p>
                    <p className="text-[11px] font-bold text-slate-300">điểm</p>
                </div>
                <p className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-slate-500">
                    <FiClock size={13} /> {formatDuration(entry.best_time_spent)}
                </p>
            </div>
        </div>
    );
}

function RankingRow({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
    return (
        <div className={`grid grid-cols-[44px_1fr_auto] items-center gap-3 rounded-2xl border bg-white px-4 py-3 shadow-sm ${isMe ? 'border-violet-200 ring-2 ring-violet-100' : 'border-slate-100'}`}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-sm font-black text-slate-500">
                #{entry.rank}
            </div>
            <div className="flex min-w-0 items-center gap-3">
                <Avatar name={entry.full_name} url={entry.avatar_url} size={42} />
                <div className="min-w-0">
                    <p className="truncate font-black text-slate-950">
                        {entry.full_name}{isMe ? ' (Bạn)' : ''}
                    </p>
                    <p className="truncate text-xs font-bold text-slate-500">
                        {entry.total_attempts} lần thi · {formatDuration(entry.best_time_spent)} · ĐTB: {formatScore(entry.avg_score)}/100
                    </p>
                </div>
            </div>
            <div className="text-right">
                <p className="text-lg font-black text-emerald-600">{formatScore(entry.best_score)}</p>
                <p className="text-xs font-bold text-slate-400">điểm</p>
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

    const myEntry = isAuthenticated ? entries.find((entry) => entry.id === user?.id) : null;
    const podiumEntries = [entries[1], entries[0], entries[2]].filter(Boolean);
    const restEntries = entries.slice(3);
    const scopeLabel = period === 'week' ? 'Tuần này' : 'Toàn hệ thống';

    return (
        <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-violet-50">
            <Header />

            <div className="border-b border-gray-100 bg-white shadow-sm">
                <div className="mx-auto max-w-5xl px-6 py-6 text-center">
                    <h1 className="flex items-center justify-center gap-3 text-3xl font-black text-gray-900">
                        <FiAward className="text-yellow-500" size={32} />
                        Bảng xếp hạng toàn hệ thống
                    </h1>
                    <div className="mt-4 inline-flex rounded-xl border border-violet-100 bg-violet-50 p-1">
                        {([
                            { value: 'week', label: 'Tuần này' },
                            { value: 'all', label: 'Tất cả' },
                        ] as { value: LeaderboardPeriod; label: string }[]).map((item) => (
                            <button
                                key={item.value}
                                onClick={() => setPeriod(item.value)}
                                className={`rounded-lg px-4 py-1.5 text-sm font-bold transition-colors ${
                                    period === item.value ? 'bg-white text-violet-700 shadow-sm' : 'text-violet-400 hover:text-violet-700'
                                }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                    <div className="mt-3 flex items-center justify-center gap-2">
                        {lastUpdated && (
                            <span className="text-xs text-gray-400">
                                Cập nhật lúc {lastUpdated.toLocaleTimeString('vi-VN')}
                            </span>
                        )}
                        <button
                            onClick={loadLeaderboard}
                            disabled={loading}
                            className="text-violet-600 transition-colors hover:text-violet-800 disabled:opacity-50"
                            title="Làm mới"
                        >
                            <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-5xl px-4 py-8">
                <section className="overflow-hidden rounded-[2rem] border border-emerald-100 bg-gradient-to-b from-white to-emerald-50/40 shadow-sm">
                    <div className="border-b border-emerald-100 bg-white p-5 md:p-6">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div>
                                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black uppercase text-emerald-700">
                                    <FiMonitor size={14} /> {scopeLabel}
                                </div>
                                <h2 className="flex items-center gap-2 text-2xl font-black text-slate-950 md:text-3xl">
                                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                                        <FiStar size={18} />
                                    </span>
                                    Bảng vàng thành tích
                                </h2>
                                <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-600">
                                    Vinh danh những bài làm nổi bật nhất trên toàn hệ thống MOLY.
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                                    <p className="flex items-center gap-2 text-xs font-bold text-slate-500"><FiUsers /> Người đã xếp hạng</p>
                                    <p className="mt-1 text-2xl font-black text-slate-950">{entries.length}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                                    <p className="flex items-center gap-2 text-xs font-bold text-slate-500"><FiHash /> Phạm vi</p>
                                    <p className="mt-1 text-sm font-black text-slate-950">{scopeLabel}</p>
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
                            <p className="text-lg font-black text-slate-600">Chưa có dữ liệu</p>
                            <p className="mt-1 max-w-md text-sm font-semibold text-slate-400">
                                Hãy hoàn thành ít nhất 1 bài thi để xuất hiện trên bảng xếp hạng.
                            </p>
                            <Link href="/exam-room" className="mt-4 inline-block rounded-full bg-violet-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700">
                                Thi ngay
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-5 p-5 md:p-6">
                            <div className="grid gap-4 md:grid-cols-3 md:items-end">
                                {podiumEntries.map((entry) => (
                                    <PodiumCard key={entry.id} entry={entry} isMe={isAuthenticated && entry.id === user?.id} />
                                ))}
                            </div>

                            {restEntries.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between px-1">
                                        <h3 className="font-black text-slate-900">Từ hạng 4 trở xuống</h3>
                                        <span className="text-xs font-bold text-slate-400">{restEntries.length} thí sinh</span>
                                    </div>
                                    {restEntries.map((entry) => (
                                        <RankingRow key={entry.id} entry={entry} isMe={isAuthenticated && entry.id === user?.id} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </section>

                {isAuthenticated && !myEntry && !loading && (
                    <div className="mt-8 rounded-2xl border border-dashed border-violet-300 bg-white p-6 text-center">
                        <FiTarget size={32} className="mx-auto mb-3 text-violet-400" />
                        <p className="font-medium text-gray-600">Bạn chưa có trên bảng xếp hạng</p>
                        <p className="mt-1 text-sm text-gray-400">Hoàn thành ít nhất 1 bài thi để xuất hiện</p>
                        <Link href="/exam-room" className="mt-4 inline-block rounded-full bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700">
                            Thi ngay
                        </Link>
                    </div>
                )}

                {!isAuthenticated && !loading && entries.length > 0 && (
                    <div className="mt-6 text-center text-sm text-gray-500">
                        <Link href="/login" className="font-medium text-violet-600 hover:underline">Đăng nhập</Link>{' '}
                        để xem thứ hạng của bạn
                    </div>
                )}
            </div>
        </div>
    );
}
