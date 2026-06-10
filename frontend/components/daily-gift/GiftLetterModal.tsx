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
  { Icon: FaHeart, className: 'left-5 top-8 text-rose-300', rotate: -12 },
  { Icon: FaStar, className: 'left-10 bottom-20 text-amber-300', rotate: 18 },
  { Icon: FaPencilAlt, className: 'right-12 bottom-24 text-sky-300', rotate: -18 },
  { Icon: FaBookOpen, className: 'left-1/2 top-5 text-emerald-300', rotate: 8 },
  { Icon: FaRegSmileBeam, className: 'right-5 top-28 text-violet-300', rotate: 14 },
];

function CuteCat() {
  return (
    <div className="pointer-events-none absolute -right-1 -top-10 h-24 w-24 sm:-right-5 sm:-top-12">
      <div className="absolute bottom-2 left-5 h-16 w-16 rounded-[28px] bg-slate-100 shadow-lg ring-4 ring-white">
        <span className="absolute -left-1 top-0 h-6 w-6 -rotate-12 rounded-tl-3xl bg-slate-100" />
        <span className="absolute -right-1 top-0 h-6 w-6 rotate-12 rounded-tr-3xl bg-slate-100" />
        <span className="absolute left-1 top-2 h-3 w-3 -rotate-12 rounded-tl-2xl bg-rose-200" />
        <span className="absolute right-1 top-2 h-3 w-3 rotate-12 rounded-tr-2xl bg-rose-200" />
        <span className="absolute left-4 top-7 h-2 w-2 rounded-full bg-slate-700" />
        <span className="absolute right-4 top-7 h-2 w-2 rounded-full bg-slate-700" />
        <span className="absolute left-1/2 top-9 h-2 w-2 -translate-x-1/2 rotate-45 rounded-sm bg-rose-300" />
        <span className="absolute left-3 top-10 h-2 w-4 rounded-full bg-rose-200/80" />
        <span className="absolute right-3 top-10 h-2 w-4 rounded-full bg-rose-200/80" />
        <span className="absolute left-2 top-12 h-1 w-8 rotate-12 rounded-full bg-slate-300" />
        <span className="absolute right-0 top-12 h-1 w-8 -rotate-12 rounded-full bg-slate-300" />
      </div>
      <div className="absolute bottom-0 right-5 h-3 w-12 -rotate-[28deg] rounded-full bg-amber-300 shadow-sm">
        <span className="absolute right-0 top-0 h-3 w-3 rounded-full bg-rose-400" />
      </div>
    </div>
  );
}

export default function GiftLetterModal({
  letter,
  studentName,
  accepting = false,
  onAccept,
  onClose,
}: GiftLetterModalProps) {
  const greeting = studentName
    ? `Gửi ${studentName} thương mến,`
    : letter.greeting || 'Gửi bạn học viên chăm chỉ,';

  return (
    <motion.div
      className="fixed inset-0 z-[9998] flex items-end justify-center bg-slate-900/35 px-3 py-4 backdrop-blur-sm sm:items-center sm:px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-gift-letter-title"
        className="relative max-h-[92dvh] w-full max-w-[540px] overflow-visible rounded-[28px] border border-rose-100 bg-[#fffaf0] p-3 shadow-[0_28px_80px_rgba(15,23,42,0.22)] sm:rounded-[32px] sm:p-4"
        initial={{ y: 36, scale: 0.96, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 28, scale: 0.96, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 24 }}
        onClick={(event) => event.stopPropagation()}
      >
        <CuteCat />

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

        <div className="max-h-[calc(92dvh-24px)] overflow-y-auto rounded-[22px] border border-white/80 bg-[linear-gradient(180deg,#fffdf7_0%,#fff7ed_100%)] px-5 pb-5 pt-8 shadow-inner sm:rounded-[26px] sm:px-8 sm:pb-7 sm:pt-9">
          <button
            type="button"
            aria-label="Đóng thư quà hôm nay"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-rose-100 bg-white text-slate-400 shadow-sm transition-colors hover:bg-rose-50 hover:text-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
          >
            <FaTimes size={14} />
          </button>

          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-amber-600">
            <FaStar size={12} />
            Daily Gift Letter
          </div>

          <div className="space-y-4">
            <p className="font-serif text-base font-semibold text-rose-500 sm:text-lg">
              {greeting}
            </p>

            <h2
              id="daily-gift-letter-title"
              className="max-w-[390px] text-2xl font-black leading-tight text-slate-800 sm:text-3xl"
            >
              {letter.title}
            </h2>

            <div className="h-px bg-gradient-to-r from-transparent via-rose-200 to-transparent" />

            <p className="text-[15px] font-medium leading-7 text-slate-600 sm:text-base">
              {letter.encouragement}
            </p>

            <div className="rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm font-semibold leading-6 text-sky-800 shadow-sm">
              {letter.study_reminder}
            </div>

            <p className="text-sm font-bold leading-6 text-emerald-700 sm:text-[15px]">
              {letter.blessing}
            </p>
          </div>

          <button
            type="button"
            onClick={onAccept}
            disabled={accepting}
            className="mt-6 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 via-pink-500 to-sky-500 px-4 py-3 text-center text-sm font-extrabold text-white shadow-lg shadow-rose-200 transition-transform hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-70 sm:text-base"
          >
            <FaCheck size={14} />
            {accepting ? 'Đang nhận...' : 'Nhận năng lượng hôm nay 💖'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
