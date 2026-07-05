'use client';

import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'framer-motion';
import { FaBookOpen, FaCrown, FaHeart, FaPencilAlt, FaStar, FaTimes } from 'react-icons/fa';
import {
  clearVipCelebrationUrlFlag,
  consumeVipCelebration,
  type VipCelebrationPayload,
} from '@/lib/utils/paymentCelebration';

const DOODLES = [
  { Icon: FaHeart, className: 'left-5 top-8 text-rose-300', rotate: -12 },
  { Icon: FaStar, className: 'left-10 bottom-20 text-amber-300', rotate: 18 },
  { Icon: FaPencilAlt, className: 'right-12 bottom-24 text-sky-300', rotate: -18 },
  { Icon: FaBookOpen, className: 'left-1/2 top-5 text-emerald-300', rotate: 8 },
  { Icon: FaCrown, className: 'right-5 top-28 text-violet-300', rotate: 14 },
];

function launchFireworks() {
  const endAt = Date.now() + 1900;

  confetti({
    particleCount: 120,
    spread: 82,
    startVelocity: 42,
    origin: { x: 0.5, y: 0.58 },
    colors: ['#f97316', '#facc15', '#22c55e', '#38bdf8', '#a855f7', '#fb7185'],
  });

  const timer = window.setInterval(() => {
    if (Date.now() > endAt) {
      window.clearInterval(timer);
      return;
    }

    confetti({
      particleCount: 42,
      angle: 60,
      spread: 55,
      startVelocity: 46,
      origin: { x: 0, y: 0.65 },
      colors: ['#facc15', '#fb7185', '#38bdf8'],
    });
    confetti({
      particleCount: 42,
      angle: 120,
      spread: 55,
      startVelocity: 46,
      origin: { x: 1, y: 0.65 },
      colors: ['#22c55e', '#a855f7', '#f97316'],
    });
  }, 260);

  return () => window.clearInterval(timer);
}

export default function VipSuccessCelebration() {
  const [payload, setPayload] = useState<VipCelebrationPayload | null>(null);
  const [open, setOpen] = useState(false);
  const cleanupConfettiRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const nextPayload = consumeVipCelebration();
    if (!nextPayload) return;

    setPayload(nextPayload);
    setOpen(true);
    const t = window.setTimeout(() => {
      cleanupConfettiRef.current = launchFireworks();
    }, 180);

    return () => {
      window.clearTimeout(t);
      cleanupConfettiRef.current?.();
    };
  }, []);

  const handleClose = () => {
    cleanupConfettiRef.current?.();
    clearVipCelebrationUrlFlag();
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/40 px-3 py-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-sm sm:px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="vip-success-title"
            className="relative flex max-h-[calc(100dvh-24px)] w-full max-w-[540px] flex-col overflow-visible rounded-[24px] border border-amber-100 bg-[#fffaf0] p-2.5 shadow-[0_28px_80px_rgba(15,23,42,0.22)] sm:max-h-[92dvh] sm:rounded-[32px] sm:p-4"
            initial={{ y: 36, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 28, scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 240, damping: 24 }}
            onClick={(event) => event.stopPropagation()}
          >
            {DOODLES.map(({ Icon, className, rotate }) => (
              <motion.span
                key={className}
                className={`pointer-events-none absolute ${className}`}
                animate={{ y: [0, -5, 0], rotate: [rotate, rotate + 8, rotate] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Icon size={18} />
              </motion.span>
            ))}

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-t-[20px] border border-b-0 border-white/80 bg-[linear-gradient(180deg,#fffdf7_0%,#fff7ed_100%)] px-4 pb-6 pt-7 shadow-inner sm:rounded-t-[26px] sm:px-8 sm:pb-8 sm:pt-9">
              <button
                type="button"
                aria-label="Đóng thông báo đăng ký thành công"
                onClick={handleClose}
                className="absolute right-4 top-4 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-amber-100 bg-white text-slate-400 shadow-sm transition-colors hover:bg-amber-50 hover:text-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              >
                <FaTimes size={14} />
              </button>

              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-extrabold uppercase text-amber-600">
                <FaCrown size={12} />
                Welcome Letter
              </div>

              <div className="space-y-4">
                <p className="font-serif text-base font-semibold text-rose-500 sm:text-lg">
                  Gửi bạn học viên thương mến,
                </p>

                <h2
                  id="vip-success-title"
                  className="max-w-[430px] text-2xl font-black leading-tight text-slate-800 sm:text-3xl"
                >
                  🎉 Chúc mừng bạn đã đăng ký thành công!
                </h2>

                <div className="h-px bg-gradient-to-r from-transparent via-amber-200 to-transparent" />

                <p className="text-[15px] font-medium leading-7 text-slate-600 sm:text-base">
                  Từ hôm nay, Moly sẽ đồng hành cùng bạn luyện tập từng chút một. Cố lên nha, ước mơ du học Trung Quốc đang gần hơn rồi đó 🇨🇳💪✨
                </p>

                {payload?.packageName && (
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm font-bold leading-6 text-emerald-800 shadow-sm">
                    Gói của bạn: {payload.packageName}
                  </div>
                )}

                {payload?.vipExpiresAt && (
                  <p className="text-sm font-semibold leading-6 text-slate-500">
                    Hạn sử dụng đến {new Date(payload.vipExpiresAt).toLocaleDateString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}.
                  </p>
                )}
              </div>
            </div>

            <div className="shrink-0 rounded-b-[20px] border border-t-0 border-white/80 bg-[#fff7ed]/95 px-4 pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-3 shadow-inner backdrop-blur sm:rounded-b-[26px] sm:px-8 sm:pb-5">
              <button
                type="button"
                onClick={handleClose}
                className="flex min-h-[50px] w-full items-center justify-center rounded-2xl bg-gradient-to-r from-rose-500 via-pink-500 to-sky-500 px-4 py-3 text-center text-sm font-extrabold text-white shadow-lg shadow-rose-200 transition-transform hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 sm:text-base"
              >
                Bắt đầu luyện tập
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
