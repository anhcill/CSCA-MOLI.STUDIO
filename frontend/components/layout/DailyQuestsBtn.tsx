'use client';

import { useState, useEffect, useRef } from 'react';
import { FiGift, FiCheck, FiStar, FiX, FiClock, FiHelpCircle } from 'react-icons/fi';
import { useAuthStore } from '@/lib/store/authStore';
import confetti from 'canvas-confetti';
import axios from '@/lib/utils/axios';

interface Quest {
  id: number;
  quest_type: string;
  target: number;
  progress: number;
  is_completed: boolean;
  reward_coins: number;
}

const QUEST_LABELS: Record<string, string> = {
  'login': 'Đăng nhập vào hệ thống',
  'do_exam': 'Hoàn thành 1 bài thi',
  'learn_vocab': 'Học từ vựng mới',
};

const COIN_USAGES = [
  { icon: '🎓', title: 'Giảm khi mua gói', desc: '1 xu = 100đ, tối đa 20% đơn' },
  { icon: '🤖', title: 'Thử phân tích AI', desc: '50 xu/lượt nếu chưa VIP/Pre' },
  { icon: '🔥', title: 'Giữ động lực học', desc: 'Nhận từ nhiệm vụ hằng ngày' },
  { icon: '🎟️', title: 'Ưu đãi phụ', desc: 'Không thay thế khóa học chính' },
];

function getSecondsUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.floor((midnight.getTime() - now.getTime()) / 1000);
}

function formatCountdown(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function DailyQuestsBtn() {
  const [show, setShow] = useState(false);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; coins: number } | null>(null);
  const [countdown, setCountdown] = useState(getSecondsUntilMidnight());
  const [showCoinsInfo, setShowCoinsInfo] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated, user, updateUser } = useAuthStore();

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(getSecondsUntilMidnight());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShow(false);
        setShowCoinsInfo(false);
      }
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const fetchQuests = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const { data } = await axios.get('/users/quests');
      if (data.success) {
        setQuests(data.data.quests);
      }
    } catch (err) {
      console.error('Lỗi khi lấy nhiệm vụ:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchQuests();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && show) {
      fetchQuests();
    }
  }, [isAuthenticated, show]);

  const claimReward = async (id: number) => {
    if (!isAuthenticated) return;
    const quest = quests.find(q => q.id === id);
    try {
      const { data } = await axios.post(`/users/quests/${id}/claim`);
      if (data.success) {
        const rewardCoins = quest?.reward_coins || 0;
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#f43f5e', '#fbbf24', '#34d399', '#60a5fa']
        });
        setQuests(prev => prev.map(q => q.id === id ? { ...q, is_completed: true } : q));
        if (rewardCoins > 0) {
          updateUser({ coins: (user?.coins || 0) + rewardCoins });
        }
        setToast({ message: `Đã nhận thưởng thành công!`, coins: rewardCoins });
        setTimeout(() => setToast(null), 4000);
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi nhận thưởng');
    }
  };

  if (!isAuthenticated) return null;

  const uncompleted = quests.filter(q => !q.is_completed && q.progress >= q.target).length;
  const currentCoins = user?.coins || 0;

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShow(!show)}
          className="relative flex items-center gap-1.5 p-2 text-gray-600 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all duration-200"
          title="Nhiệm vụ hằng ngày"
        >
          <FiGift size={20} className={uncompleted > 0 ? "text-rose-500" : ""} />
          <span className="hidden lg:inline text-xs font-bold">Nhiệm vụ</span>
          {uncompleted > 0 && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>
          )}
        </button>

        {show && (
          <div className="absolute right-0 top-full mt-2 w-[22rem] bg-white rounded-2xl shadow-xl border border-gray-100 z-[200] animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-rose-50 to-pink-50 border-b border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center">
                  <FiGift size={16} />
                </div>
                <h3 className="font-bold text-gray-800">Nhiệm vụ hằng ngày</h3>
              </div>

              {/* Coins balance */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
                  <FiStar size={14} className="text-amber-500" />
                  <span className="text-sm font-bold text-amber-700">{currentCoins.toLocaleString()} xu</span>
                </div>
                <button
                  onClick={() => setShowCoinsInfo(!showCoinsInfo)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <FiHelpCircle size={13} />
                  Xu để làm gì?
                </button>
              </div>

              {/* Countdown to reset */}
              <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-white/70 rounded-lg px-2.5 py-1.5 w-fit">
                <FiClock size={12} className="text-rose-400" />
                <span>Reset sau:</span>
                <span className="font-mono font-bold text-rose-600">{formatCountdown(countdown)}</span>
              </div>
            </div>

            {/* Coins info section */}
            {showCoinsInfo && (
              <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 animate-in fade-in duration-200">
                <p className="text-xs font-bold text-amber-700 mb-2">Xu dùng để làm gì?</p>
                <div className="grid grid-cols-2 gap-2">
                  {COIN_USAGES.map((usage) => (
                    <div key={usage.title} className="flex items-start gap-1.5 bg-white rounded-lg p-2">
                      <span className="text-base leading-none mt-0.5">{usage.icon}</span>
                      <div>
                        <p className="text-xs font-bold text-gray-700 leading-tight">{usage.title}</p>
                        <p className="text-[10px] text-gray-400 leading-tight">{usage.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 rounded-lg border border-amber-200 bg-white/70 px-3 py-2">
                  <p className="text-[10px] leading-relaxed text-amber-700">
                    Xu chỉ là ưu đãi kích thích học tập: dùng để giảm nhẹ khi mua gói/khóa hoặc mở thử một vài lượt AI. Nội dung học đầy đủ vẫn nằm ở gói/khóa học.
                  </p>
                  <a
                    href="/checkout"
                    onClick={() => setShow(false)}
                    className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-amber-600 transition-colors"
                  >
                    Dùng xu khi nâng cấp
                  </a>
                </div>
              </div>
            )}

            {/* Quest list */}
            <div className="p-4 max-h-80 overflow-y-auto">
              {loading ? (
                <div className="text-center text-gray-500 py-4 text-sm animate-pulse">Đang tải nhiệm vụ...</div>
              ) : quests.length === 0 ? (
                <div className="text-center text-gray-500 py-4 text-sm">Chưa có nhiệm vụ nào</div>
              ) : (
                <div className="space-y-2.5">
                  {quests.map(quest => {
                    const label = QUEST_LABELS[quest.quest_type] || quest.quest_type;
                    const canClaim = quest.progress >= quest.target && !quest.is_completed;
                    const progressPercent = Math.min(100, Math.round((quest.progress / quest.target) * 100));

                    return (
                      <div key={quest.id} className={`p-3 rounded-xl border relative overflow-hidden ${
                        quest.is_completed ? 'bg-gray-50 border-gray-100' : 'bg-gray-50 border-gray-100'
                      }`}>
                        {quest.is_completed && (
                          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
                            <span className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                              <FiCheck size={11} /> Đã nhận thưởng
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between items-start mb-2">
                          <div className="text-sm font-semibold text-gray-800 pr-16">{label}</div>
                          <div className="flex items-center gap-1 text-xs font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded absolute top-3 right-3">
                            +{quest.reward_coins} <FiStar size={10} />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>Tiến độ</span>
                          <span>{quest.progress} / {quest.target}</span>
                        </div>

                        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full transition-all duration-500 ${canClaim ? 'bg-green-500' : 'bg-rose-400'}`}
                            style={{ width: `${progressPercent}%` }}
                          ></div>
                        </div>

                        {canClaim && (
                          <button
                            onClick={() => claimReward(quest.id)}
                            className="w-full mt-2 py-1.5 bg-gradient-to-r from-rose-400 to-red-500 text-white rounded-lg text-xs font-bold shadow-md hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                          >
                            Nhận thưởng
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer hint */}
            {quests.length > 0 && (
              <div className="px-4 pb-3 text-center">
                <p className="text-[10px] text-gray-400">
                  {quests.every(q => q.is_completed)
                    ? '✓ Tất cả nhiệm vụ hôm nay đã hoàn thành!'
                    : `${uncompleted > 0 ? `Còn ${uncompleted} nhiệm vụ chờ nhận thưởng` : 'Hoàn thành nhiệm vụ để nhận xu!'}`}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 max-w-sm">
            <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center shrink-0">
              <FiStar size={14} className="text-amber-900" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold">{toast.message}</p>
              <p className="text-xs text-amber-300 flex items-center gap-1">
                +{toast.coins} <FiStar size={10} />
              </p>
            </div>
            <button onClick={() => setToast(null)} className="p-1 rounded-full hover:bg-white/20 shrink-0">
              <FiX size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
