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
import { PetFace } from '@/components/common/MoliPet';

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

function normalizeDisplayText(value?: string | null) {
  return String(value || '').normalize('NFC').trim();
}

function GiftPetBadge() {
  return (
    <div className="pointer-events-none absolute -right-1 -top-9 z-20 h-20 w-20 rounded-[28px] border border-white/80 bg-white/75 shadow-xl shadow-rose-200/60 ring-4 ring-white/70 backdrop-blur sm:-right-5 sm:-top-12 sm:h-24 sm:w-24">
      <div className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-sky-50 via-white to-rose-50" />
      <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 scale-[0.82] sm:scale-95">
        <PetFace color="ocean" variant="cat" mood="happy" facing="left" waving />
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
  const greeting = normalizeDisplayText(studentName
    ? `Gửi ${studentName} thương mến,`
    : letter.greeting || 'Gửi bạn học viên chăm chỉ,');
  const title = normalizeDisplayText(letter.title);
  const encouragement = normalizeDisplayText(letter.encouragement);
  const studyReminder = normalizeDisplayText(letter.study_reminder);
  const blessing = normalizeDisplayText(letter.blessing);

  return (
    <motion.div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-900/35 px-3 py-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-sm sm:px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-gift-letter-title"
        className="relative flex max-h-[calc(100dvh-24px)] w-full max-w-[540px] flex-col overflow-visible rounded-[24px] border border-rose-100 bg-[#fffaf0] p-2.5 shadow-[0_28px_80px_rgba(15,23,42,0.22)] sm:max-h-[92dvh] sm:rounded-[32px] sm:p-4"
        initial={{ y: 36, scale: 0.96, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 28, scale: 0.96, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 24 }}
        onClick={(event) => event.stopPropagation()}
      >
        <GiftPetBadge />

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

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-t-[20px] border border-b-0 border-white/80 bg-[linear-gradient(180deg,#fffdf7_0%,#fff7ed_100%)] px-4 pb-5 pt-7 shadow-inner sm:rounded-t-[26px] sm:px-8 sm:pb-7 sm:pt-9">
          <button
            type="button"
            aria-label="Đóng thư quà hôm nay"
            onClick={onClose}
            className="absolute right-4 top-4 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-rose-100 bg-white text-slate-400 shadow-sm transition-colors hover:bg-rose-50 hover:text-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
          >
            <FaTimes size={14} />
          </button>

          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-amber-600">
            <FaStar size={12} />
            Daily Gift Letter
          </div>

          <div className="space-y-4">
            <p className="text-base font-semibold text-rose-500 sm:text-lg">
              {greeting}
            </p>

            <h2
              id="daily-gift-letter-title"
              className="max-w-[390px] text-xl font-black leading-tight text-slate-800 sm:text-3xl"
            >
              {title}
            </h2>

            <div className="h-px bg-gradient-to-r from-transparent via-rose-200 to-transparent" />

            <p className="text-[15px] font-semibold leading-7 text-slate-600 sm:text-base">
              Moly có một lời nhắn nhỏ muốn gửi đến bạn hôm nay:
            </p>

            <p className="text-[15px] font-medium leading-7 text-slate-600 sm:text-base">
              {encouragement}
            </p>

            {studyReminder && (
              <div className="rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm font-semibold leading-6 text-sky-800 shadow-sm">
                {studyReminder}
              </div>
            )}

            {blessing && (
              <p className="text-sm font-bold leading-6 text-emerald-700 sm:text-[15px]">
                {blessing}
              </p>
            )}

            <div className="pt-1 text-right text-sm font-semibold leading-6 text-slate-500 sm:text-[15px]">
              <p>Thương mến,</p>
              <p className="font-extrabold text-rose-500">Moly 💌</p>
            </div>
          </div>
        </div>

        <div className="shrink-0 rounded-b-[20px] border border-t-0 border-white/80 bg-[#fff7ed]/95 px-4 pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-3 shadow-inner backdrop-blur sm:rounded-b-[26px] sm:px-8 sm:pb-5">
          <button
            type="button"
            onClick={onAccept}
            disabled={accepting}
            className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 via-pink-500 to-sky-500 px-4 py-3 text-center text-sm font-extrabold text-white shadow-lg shadow-rose-200 transition-transform hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-70 sm:text-base"
          >
            <FaCheck size={14} />
            {accepting ? 'Đang nhận...' : 'Nhận năng lượng hôm nay'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
