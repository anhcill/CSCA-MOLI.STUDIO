'use client';

import { motion } from 'framer-motion';
import {
  FaBookOpen,
  FaCheck,
  FaHeart,
  FaPencilAlt,
  FaRegSmileBeam,
  FaStar,
  FaTimes,
  FaFire,
} from 'react-icons/fa';
import type { DailyGiftLetter } from '@/hooks/useDailyGift';

interface GiftLetterModalProps {
  letter: DailyGiftLetter;
  studentName?: string;
  accepting?: boolean;
  onAccept: () => void;
  onClose: () => void;
}

const DOODLES = [
  { Icon: FaHeart, className: 'left-5 top-8 text-rose-400 dark:text-rose-500', rotate: -12 },
  { Icon: FaStar, className: 'left-10 bottom-20 text-amber-400 dark:text-amber-500', rotate: 18 },
  { Icon: FaPencilAlt, className: 'right-12 bottom-24 text-sky-400 dark:text-sky-500', rotate: -18 },
  { Icon: FaBookOpen, className: 'left-1/2 top-5 text-emerald-400 dark:text-emerald-500', rotate: 8 },
  { Icon: FaRegSmileBeam, className: 'right-5 top-28 text-violet-400 dark:text-violet-500', rotate: 14 },
];

function normalizeDisplayText(value?: string | null) {
  return String(value || '').normalize('NFC').trim();
}

export default function GiftLetterModal({
  letter,
  studentName,
  accepting = false,
  onAccept,
  onClose,
}: GiftLetterModalProps) {
  const greeting = normalizeDisplayText(
    studentName
      ? `Gửi ${studentName} thương mến,`
      : letter.greeting || 'Gửi bạn học viên chăm chỉ,'
  );
  const title = normalizeDisplayText(letter.title);
  const encouragement = normalizeDisplayText(letter.encouragement);
  const studyReminder = normalizeDisplayText(letter.study_reminder);
  const blessing = normalizeDisplayText(letter.blessing);

  return (
    <motion.div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/65 px-3 py-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-md sm:px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-gift-letter-title"
        className="relative flex max-h-[calc(100dvh-24px)] w-full max-w-[540px] flex-col overflow-visible rounded-[28px] border border-rose-200/90 dark:border-slate-800 bg-gradient-to-b from-[#FFFDF9] via-[#FFF9F3] to-[#FFF4ED] dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 p-2.5 shadow-[0_28px_80px_rgba(244,63,94,0.22)] dark:shadow-[0_28px_80px_rgba(0,0,0,0.85)] sm:max-h-[92dvh] sm:rounded-[32px] sm:p-4"
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

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-t-[20px] border border-b-0 border-rose-100/80 dark:border-slate-800 bg-white/95 dark:bg-slate-950/90 px-4 pb-5 pt-7 shadow-xs sm:rounded-t-[26px] sm:px-8 sm:pb-7 sm:pt-9">
          <button
            type="button"
            aria-label="Đóng thư"
            onClick={onClose}
            className="absolute right-4 top-4 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-rose-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-sm transition-colors hover:bg-rose-50 dark:hover:bg-slate-700 hover:text-rose-600 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            <FaTimes size={14} />
          </button>

          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/70 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 shadow-xs">
            <FaFire className="text-orange-500" size={11} />
            Thư Động Lực Đầu Tuần
          </div>

          <div className="space-y-4">
            <p className="text-base font-extrabold text-rose-600 dark:text-rose-400 sm:text-lg">
              {greeting}
            </p>

            <h2
              id="daily-gift-letter-title"
              className="max-w-[420px] text-xl font-black leading-tight text-slate-900 dark:text-white sm:text-2xl"
            >
              {title}
            </h2>

            <div className="h-px bg-gradient-to-r from-transparent via-rose-300 dark:via-slate-700 to-transparent" />

            <div className="space-y-3.5 text-[15px] sm:text-base font-medium leading-relaxed text-slate-900 dark:text-slate-100 whitespace-pre-line">
              {encouragement}
            </div>

            {studyReminder && (
              <div className="rounded-2xl border border-amber-300 dark:border-amber-800/80 bg-amber-50/90 dark:bg-amber-950/30 px-4 py-3 text-xs sm:text-sm font-bold leading-relaxed text-amber-900 dark:text-amber-200 shadow-xs">
                {studyReminder}
              </div>
            )}

            {blessing && (
              <p className="text-sm sm:text-[15px] font-extrabold leading-relaxed text-emerald-700 dark:text-emerald-400">
                {blessing}
              </p>
            )}

            <div className="pt-2 text-right text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400">
              <p>Thương mến,</p>
              <p className="font-black text-rose-600 dark:text-rose-400 text-base">MOLY.STUDIO 💌</p>
            </div>
          </div>
        </div>

        <div className="shrink-0 rounded-b-[20px] border border-t-0 border-rose-100/80 dark:border-slate-800 bg-[#FFF7ED]/95 dark:bg-slate-900/95 px-4 pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-3 shadow-inner backdrop-blur sm:rounded-b-[26px] sm:px-8 sm:pb-5">
          <button
            type="button"
            onClick={onAccept}
            disabled={accepting}
            className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 via-pink-600 to-indigo-600 px-4 py-3 text-center text-sm font-black text-white shadow-lg shadow-rose-500/25 transition-transform hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-70 sm:text-base tracking-wide"
          >
            <FaCheck size={14} />
            {accepting ? 'Đang nhận năng lượng...' : 'Nhận Năng Lượng & Bắt Đầu Học! 🚀'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
