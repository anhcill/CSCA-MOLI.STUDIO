'use client';

import { useState, useEffect } from 'react';
import { FiGift, FiX, FiCheck } from 'react-icons/fi';
import { useAuthStore } from '@/lib/store/authStore';

interface Quest {
  id: number;
  quest_type: string;
  target: number;
  progress: number;
  is_completed: boolean;
  reward_coins: number;
}

const QUEST_LABELS: Record<string, string> = {
  login: 'Đăng nhập',
  do_exam: 'Làm bài thi',
  learn_vocab: 'Học từ vựng',
};

export default function DailyQuestBanner() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const { isAuthenticated, token } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !token) return;
    const dismissedKey = 'daily_quest_banner_dismissed_' + new Date().toDateString();
    if (localStorage.getItem(dismissedKey)) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    fetch(`${apiUrl}/api/users/quests`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (json?.success) {
          setQuests(json.data.quests || []);
        }
      })
      .catch(() => {});
  }, [isAuthenticated, token]);

  if (!isAuthenticated || dismissed) return null;

  const canClaim = quests.filter(q => !q.is_completed && q.progress >= q.target);
  const allDone = quests.length > 0 && quests.every(q => q.is_completed);
  if (quests.length === 0 || allDone) return null;

  const totalCoins = canClaim.reduce((s, q) => s + q.reward_coins, 0);

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem('daily_quest_banner_dismissed_' + new Date().toDateString(), '1');
  };

  return (
    <div className="w-full bg-gradient-to-r from-rose-500 via-pink-500 to-red-500 text-white py-2.5 px-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <FiGift size={18} className="shrink-0" />
          <span className="text-sm font-semibold">
            {canClaim.length > 0
              ? `Bạn có ${canClaim.length} nhiệm vụ chờ nhận thưởng — tổng ${totalCoins} xu!`
              : 'Nhiệm vụ hằng ngày đang chờ — vào nhận thưởng ngay!'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canClaim.length > 0 && (
            <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full flex items-center gap-1">
              <FiCheck size={12} /> {canClaim.length} chờ nhận
            </span>
          )}
          <button
            onClick={dismiss}
            className="p-1 rounded-full hover:bg-white/20 transition-colors"
            title="Đóng"
          >
            <FiX size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
