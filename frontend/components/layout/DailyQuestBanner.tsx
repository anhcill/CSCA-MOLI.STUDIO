'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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

interface PromotionBanner {
  id: number;
  title: string;
  content: string;
  coupon_code: string | null;
  cta_text: string | null;
  badge_text: string | null;
  theme: 'gold' | 'violet' | 'emerald' | 'rose' | 'blue';
  ends_at: string | null;
}

function getPromotionBarClass(theme: PromotionBanner['theme']) {
  switch (theme) {
    case 'violet':
      return 'from-violet-600 via-fuchsia-500 to-pink-500';
    case 'emerald':
      return 'from-emerald-600 via-teal-500 to-cyan-500';
    case 'blue':
      return 'from-blue-600 via-indigo-500 to-sky-500';
    case 'rose':
      return 'from-rose-600 via-pink-500 to-orange-500';
    default:
      return 'from-amber-500 via-orange-500 to-rose-500';
  }
}

export default function DailyQuestBanner() {
  const { pick } = useLanguage();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [promotion, setPromotion] = useState<PromotionBanner | null>(null);
  const [promotionDismissed, setPromotionDismissed] = useState(false);
  const { isAuthenticated, user, updateUser } = useAuthStore();

  useEffect(() => {
    axios.get('/coupons/promotion?placement=checkout')
      .then((res) => {
        const activePromotion = res.data?.data || null;
        setPromotion(activePromotion);
        if (activePromotion?.id) {
          setPromotionDismissed(Boolean(localStorage.getItem(`promotion_banner_dismissed_${activePromotion.id}`)));
        }
      })
      .catch(() => setPromotion(null));
  }, []);

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

  useEffect(() => {
    const handleQuestClaimed = (event: Event) => {
      const questId = Number((event as CustomEvent<{ questId?: number }>).detail?.questId || 0);
      if (!questId) return;

      const next = quests.map((quest) => (
        quest.id === questId ? { ...quest, is_completed: true } : quest
      ));
      setQuests(next);
      if (!next.some((quest) => !quest.is_completed && quest.progress >= quest.target)) {
        setDismissed(true);
      }
    };

    window.addEventListener('daily-quest-claimed', handleQuestClaimed);
    return () => window.removeEventListener('daily-quest-claimed', handleQuestClaimed);
  }, [quests]);

  const dismissPromotion = () => {
    if (promotion?.id) {
      localStorage.setItem(`promotion_banner_dismissed_${promotion.id}`, '1');
    }
    setPromotionDismissed(true);
  };

  if (promotion && !promotionDismissed) {
    return (
      <div className={`w-full bg-gradient-to-r ${getPromotionBarClass(promotion.theme)} px-4 py-2.5 text-white`}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <FiGift size={18} className="shrink-0" />
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              {promotion.badge_text && (
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-black uppercase tracking-wide">
                  {promotion.badge_text}
                </span>
              )}
              <span className="truncate text-sm font-extrabold">{promotion.title}</span>
              <span className="hidden text-sm font-semibold text-white/90 sm:inline">
                {promotion.content}
              </span>
              {promotion.coupon_code && (
                <span className="rounded-full bg-white/15 px-2 py-0.5 font-mono text-xs font-black text-amber-100">
                  {promotion.coupon_code}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {promotion.coupon_code && (
              <Link
                href={`/checkout?coupon=${encodeURIComponent(promotion.coupon_code)}`}
                className="rounded-full bg-white/20 px-3 py-0.5 text-xs font-black transition-colors hover:bg-white/30"
              >
                {promotion.cta_text || 'Dùng mã'}
              </Link>
            )}
            <button
              type="button"
              onClick={dismissPromotion}
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

  if (!isAuthenticated || dismissed) return null;

  const canClaim = quests.filter((quest) => !quest.is_completed && quest.progress >= quest.target);
  const allDone = quests.length > 0 && quests.every((quest) => quest.is_completed);
  if (quests.length === 0 || allDone) return null;
  if (canClaim.length === 0) return null;

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
            {currentCoins.toLocaleString('vi-VN')} xu
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
