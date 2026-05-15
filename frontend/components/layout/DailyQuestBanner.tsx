'use client';

import { useEffect, useState } from 'react';
import { FiCheck, FiGift, FiX } from 'react-icons/fi';
import { useAuthStore } from '@/lib/store/authStore';
import { useLanguage } from '@/context/LanguageContext';
import axios from '@/lib/utils/axios';

interface Quest {
  id: number;
  quest_type: string;
  target: number;
  progress: number;
  is_completed: boolean;
  reward_coins: number;
}

export default function DailyQuestBanner() {
  const { pick } = useLanguage();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const { isAuthenticated, user, updateUser } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) return;
    const dismissedKey = `daily_quest_banner_dismissed_${new Date().toDateString()}`;
    if (localStorage.getItem(dismissedKey)) return;

    axios.get('/users/quests')
      .then((res) => setQuests(res.data?.data?.quests || []))
      .catch(() => {});

    axios.get('/auth/me')
      .then((res) => {
        const freshUser = res.data?.data?.user;
        if (freshUser) updateUser(freshUser);
      })
      .catch(() => {});
  }, [isAuthenticated]);

  if (!isAuthenticated || dismissed) return null;

  const canClaim = quests.filter((quest) => !quest.is_completed && quest.progress >= quest.target);
  const allDone = quests.length > 0 && quests.every((quest) => quest.is_completed);
  if (quests.length === 0 || allDone) return null;

  const totalCoins = canClaim.reduce((sum, quest) => sum + quest.reward_coins, 0);
  const currentCoins = user?.coins || 0;

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem(`daily_quest_banner_dismissed_${new Date().toDateString()}`, '1');
  };

  return (
    <div className="w-full bg-gradient-to-r from-rose-500 via-pink-500 to-red-500 px-4 py-2.5 text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <FiGift size={18} className="shrink-0" />
          <span className="text-sm font-semibold">
            {canClaim.length > 0
              ? pick({
                vi: `Bạn có ${canClaim.length} nhiệm vụ chờ nhận, tổng ${totalCoins} xu để giảm nhẹ khi nâng cấp!`,
                en: `You have ${canClaim.length} quests ready to claim, worth ${totalCoins} coins for your upgrade!`,
                zh: `你有 ${canClaim.length} 个任务可领取，共 ${totalCoins} 枚金币，可用于升级优惠！`,
              })
              : pick({
                vi: 'Nhiệm vụ hằng ngày đang chờ, tích xu để giảm nhẹ khi mua gói!',
                en: 'Daily quests are waiting. Collect coins to reduce your package cost!',
                zh: '每日任务正在等待，收集金币可抵扣购买套餐！',
              })}
          </span>
          <span className="ml-1.5 rounded-full bg-white/10 px-1.5 py-0.5 text-xs font-bold text-amber-200">
            {currentCoins.toLocaleString()} xu
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canClaim.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">
              <FiCheck size={12} />
              {pick({ vi: `${canClaim.length} chờ nhận`, en: `${canClaim.length} ready`, zh: `${canClaim.length} 个可领取` })}
            </span>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full p-1 transition-colors hover:bg-white/20"
            title={pick({ vi: 'Đóng', en: 'Close', zh: '关闭' })}
          >
            <FiX size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
