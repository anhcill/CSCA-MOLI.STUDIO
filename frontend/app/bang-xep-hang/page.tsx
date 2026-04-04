'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import Link from 'next/link';
import { FiAward, FiTrendingUp, FiTarget, FiRefreshCw } from 'react-icons/fi';

interface LeaderboardEntry {
    rank: number;
    id: number;
    full_name: string;
    avatar_url: string | null;
    total_attempts: number;
    avg_score: number;
    best_score: number;
    last_attempt_at: string;
}

const MEDAL = ['🥇', '🥈', '🥉'];

function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
    if (url) {
        return <img src={url} alt={name} width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />;
    }
    return (
        <div
            className="rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold shrink-0"
            style={{ width: size, height: size, fontSize: size * 0.4 }}
        >
            {name?.charAt(0)?.toUpperCase() || '?'}
        </div>
    );
}

export default function LeaderboardPage() {
    const { user, isAuthenticated } = useAuthStore();
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

    const loadLeaderboard = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${apiUrl}/leaderboard?limit=20`);
            const json = await res.json();
            if (json.success) {
                setEntries(json.data);
                setLastUpdated(new Date());
            }
        } catch (err) {
            console.error('Leaderboard error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLeaderboard();
    }, []);

    const myEntry = isAuthenticated ? entries.find((e) => e.id === user?.id) : null;

    return (
        <div className="min-h-screen bg-gradient-to-b from-violet-50 to-white">
            {/* Header */}
            <div className="bg-white border-b border-gray-100 shadow-sm">
                <div className="max-w-3xl mx-auto px-6 py-6 text-center">
                    <h1 className="text-3xl font-black text-gray-900 flex items-center justify-center gap-3">
                        <FiAward className="text-yellow-500" size={32} />
                        Bảng Xếp Hạng
                    </h1>
                    <p className="text-gray-500 mt-2 text-sm">Top học viên CSCA theo điểm trung bình</p>
                    <div className="flex items-center justify-center gap-2 mt-3">
                        {lastUpdated && (
                            <span className="text-xs text-gray-400">
                                Cập nhật lúc {lastUpdated.toLocaleTimeString('vi-VN')}
                            </span>
                        )}
                        <button
                            onClick={loadLeaderboard}
                            disabled={loading}
                            className="text-violet-600 hover:text-violet-800 disabled:opacity-50 transition-colors"
                            title="Làm mới"
                        >
                            <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 py-8">
                {/* My rank card (if logged in & on leaderboard) */}
                {isAuthenticated && myEntry && (
                    <div className="bg-violet-600 text-white rounded-2xl p-4 mb-6 flex items-center gap-4 shadow-lg">
                        <div className="text-3xl font-black w-10 text-center">#{myEntry.rank}</div>
                        <Avatar name={myEntry.full_name} url={myEntry.avatar_url} size={48} />
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-lg truncate">Bạn đang ở hạng {myEntry.rank}</p>
                            <p className="text-violet-200 text-sm">
                                ĐTB: <strong className="text-white">{myEntry.avg_score}</strong> ·{' '}
                                {myEntry.total_attempts} lần thi · Cao nhất: {myEntry.best_score}
                            </p>
                        </div>
                    </div>
                )}

                {/* Leaderboard table */}
                {loading ? (
                    <div className="text-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4" />
                        <p className="text-gray-500">Đang tải...</p>
                    </div>
                ) : entries.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                        <FiTrendingUp size={48} className="mx-auto mb-3 opacity-40" />
                        <p className="text-lg font-medium">Chưa có dữ liệu</p>
                        <p className="text-sm mt-1">Hãy thi thử để lên bảng xếp hạng!</p>
                        <Link href="/thi-thu" className="mt-4 inline-block px-6 py-2 bg-violet-600 text-white rounded-full text-sm font-semibold hover:bg-violet-700 transition-colors">
                            Thi ngay
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {entries.map((entry) => {
                            const isMe = isAuthenticated && entry.id === user?.id;
                            const isTop3 = entry.rank <= 3;

                            return (
                                <div
                                    key={entry.id}
                                    className={`flex items-center gap-4 px-5 py-4 rounded-2xl transition-all ${isMe
                                            ? 'bg-violet-50 border-2 border-violet-400 shadow-md'
                                            : isTop3
                                                ? 'bg-white border border-yellow-200 shadow-sm'
                                                : 'bg-white border border-gray-100 hover:border-violet-200 hover:shadow-sm'
                                        }`}
                                >
                                    {/* Rank */}
                                    <div className="w-10 text-center shrink-0">
                                        {entry.rank <= 3 ? (
                                            <span className="text-2xl">{MEDAL[entry.rank - 1]}</span>
                                        ) : (
                                            <span className="text-lg font-black text-gray-400">#{entry.rank}</span>
                                        )}
                                    </div>

                                    {/* Avatar */}
                                    <Avatar name={entry.full_name} url={entry.avatar_url} size={44} />

                                    {/* Name & subtitle */}
                                    <div className="flex-1 min-w-0">
                                        <p className={`font-bold truncate ${isMe ? 'text-violet-700' : 'text-gray-800'}`}>
                                            {entry.full_name}
                                            {isMe && <span className="ml-2 text-xs font-normal text-violet-500">(Bạn)</span>}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {entry.total_attempts} lần thi · Cao nhất: {entry.best_score} điểm
                                        </p>
                                    </div>

                                    {/* Score */}
                                    <div className="text-right shrink-0">
                                        <div className={`text-xl font-black ${isTop3 ? 'text-yellow-500' : isMe ? 'text-violet-600' : 'text-gray-700'}`}>
                                            {entry.avg_score}
                                        </div>
                                        <div className="text-xs text-gray-400">ĐTB</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* CTA */}
                {isAuthenticated && !myEntry && !loading && (
                    <div className="mt-8 text-center bg-white border border-dashed border-violet-300 rounded-2xl p-6">
                        <FiTarget size={32} className="mx-auto text-violet-400 mb-3" />
                        <p className="text-gray-600 font-medium">Bạn chưa có trên bảng xếp hạng</p>
                        <p className="text-sm text-gray-400 mt-1">Hoàn thành ít nhất 1 bài thi để xuất hiện</p>
                        <Link href="/thi-thu" className="mt-4 inline-block px-6 py-2.5 bg-violet-600 text-white rounded-full text-sm font-semibold hover:bg-violet-700 transition-colors">
                            Thi ngay
                        </Link>
                    </div>
                )}

                {!isAuthenticated && !loading && entries.length > 0 && (
                    <div className="mt-6 text-center text-sm text-gray-500">
                        <Link href="/auth" className="text-violet-600 hover:underline font-medium">Đăng nhập</Link>{' '}
                        để xem thứ hạng của bạn
                    </div>
                )}
            </div>
        </div>
    );
}
