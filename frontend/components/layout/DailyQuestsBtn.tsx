'use client';

import { useState, useEffect, useRef } from 'react';
import { FiGift, FiCheck, FiStar } from 'react-icons/fi';
import { useAuthStore } from '@/lib/store/authStore';
import confetti from 'canvas-confetti';

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

export default function DailyQuestsBtn() {
  const [show, setShow] = useState(false);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated, token } = useAuthStore();

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShow(false);
      }
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const fetchQuests = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/users/quests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
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
    if (isAuthenticated && show) {
      fetchQuests();
    }
  }, [isAuthenticated, show]);

  const claimReward = async (id: number) => {
    if (!token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/users/quests/${id}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        // Trigger confetti
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#f43f5e', '#fbbf24', '#34d399', '#60a5fa']
        });
        
        // Update local state
        setQuests(prev => prev.map(q => q.id === id ? { ...q, is_completed: true } : q));
        // Don't show annoying alert if successful, or maybe a toast later. 
        // For now, let the confetti do the talking!
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi nhận thưởng');
    }
  };

  if (!isAuthenticated) return null;

  // Uncompleted quests count
  const uncompleted = quests.filter(q => !q.is_completed && q.progress >= q.target).length;

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
        onClick={() => setShow(!show)}
        className="relative p-2 text-gray-600 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all duration-200"
        title="Nhiệm vụ hằng ngày"
      >
        <FiGift size={20} className={uncompleted > 0 ? "text-rose-500 animate-pulse" : ""} />
        {uncompleted > 0 && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
        )}
      </button>

      {show && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-[200] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
            <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center">
              <FiGift />
            </div>
            <h3 className="font-bold text-gray-800">Nhiệm vụ hằng ngày</h3>
          </div>

          {loading ? (
            <div className="text-center text-gray-500 py-4 text-sm animate-pulse">Đang tải nhiệm vụ...</div>
          ) : quests.length === 0 ? (
            <div className="text-center text-gray-500 py-4 text-sm">Chưa có nhiệm vụ nào</div>
          ) : (
            <div className="space-y-3">
              {quests.map(quest => {
                const label = QUEST_LABELS[quest.quest_type] || quest.quest_type;
                const canClaim = quest.progress >= quest.target && !quest.is_completed;
                const progressPercent = Math.min(100, Math.round((quest.progress / quest.target) * 100));

                return (
                  <div key={quest.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 relative overflow-hidden">
                    {quest.is_completed && (
                      <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
                        <span className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                          <FiCheck /> Đã nhận thưởng
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-sm font-semibold text-gray-800">{label}</div>
                      <div className="flex items-center gap-1 text-xs font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded">
                        +{quest.reward_coins} <FiStar size={10} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Tiến độ</span>
                      <span>{quest.progress} / {quest.target}</span>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2 overflow-hidden">
                      <div 
                        className={`h-1.5 rounded-full ${canClaim ? 'bg-green-500' : 'bg-rose-400'}`} 
                        style={{ width: `${progressPercent}%` }}
                      ></div>
                    </div>

                    {canClaim && (
                      <button 
                        onClick={() => claimReward(quest.id)}
                        className="w-full mt-2 py-1.5 bg-gradient-to-r from-rose-400 to-red-500 text-white rounded-lg text-xs font-bold shadow-md hover:shadow-lg transition-all"
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
      )}
    </div>
    </>
  );
}
