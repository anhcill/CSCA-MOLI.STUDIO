'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FaGift, FaHeart, FaMagic, FaStar } from 'react-icons/fa';
import { useAuthStore } from '@/lib/store/authStore';
import { useDailyGift } from '@/hooks/useDailyGift';
import GiftLetterModal from './GiftLetterModal';
import DailyLetterModal from './DailyLetterModal';

interface DailyGiftBoxProps {
  enabled?: boolean;
}

const FLOATING_DECOR = [
  { Icon: FaHeart, className: 'left-1 top-1 text-rose-400', delay: 0 },
  { Icon: FaStar, className: 'right-2 top-0 text-amber-300', delay: 0.5 },
  { Icon: FaMagic, className: 'left-7 -top-2 text-sky-300', delay: 1 },
];

export default function DailyGiftBox({ enabled = true }: DailyGiftBoxProps) {
  const { user, isAuthenticated } = useAuthStore();
  const [open, setOpen] = useState(false);
  const dailyGift = useDailyGift(enabled && isAuthenticated);
  const displayName = user?.display_name || user?.full_name || user?.username || '';

  // Check if today is the special "Thư Hôm Nay" day (e.g. 2026-07-31)
  const isSpecialLetterDay = () => {
    const today = new Date();
    // 2026-07-31 or current system date check
    return (
      today.getFullYear() === 2026 &&
      today.getMonth() === 6 && // 0-indexed July = 6
      today.getDate() === 31
    );
  };

  const isSpecialDay = isSpecialLetterDay();

  if (!dailyGift.shouldShow || !dailyGift.letter) return null;

  const handleAccept = async () => {
    await dailyGift.markOpened();
    setOpen(false);
  };

  return (
    <>
      <div className="fixed bottom-[max(5.25rem,calc(env(safe-area-inset-bottom)+4.75rem))] right-3 z-[9996] sm:bottom-28 sm:right-6">
        <div className="relative h-20 w-20 sm:h-28 sm:w-28">
          {FLOATING_DECOR.map(({ Icon, className, delay }) => (
            <motion.span
              key={className}
              className={`pointer-events-none absolute ${className}`}
              animate={{
                y: [8, -18, -30],
                opacity: [0, 1, 0],
                scale: [0.7, 1, 0.9],
                rotate: [-8, 10, -4],
              }}
              transition={{
                duration: 2.8,
                delay,
                repeat: Infinity,
                repeatDelay: 0.6,
                ease: 'easeOut',
              }}
            >
              <Icon size={15} />
            </motion.span>
          ))}

          <motion.button
            type="button"
            aria-label="Mở thư quà học tập hôm nay"
            onClick={() => setOpen(true)}
            className="group absolute inset-x-0 bottom-0 mx-auto flex h-[68px] w-[68px] items-center justify-center rounded-[22px] border border-rose-100 bg-gradient-to-br from-rose-100 via-pink-100 to-sky-100 shadow-[0_18px_45px_rgba(244,114,182,0.35)] outline-none ring-4 ring-white/70 transition-colors hover:from-rose-200 hover:via-pink-100 hover:to-cyan-100 focus-visible:ring-4 focus-visible:ring-rose-300 sm:h-[88px] sm:w-[88px] sm:rounded-[24px]"
            animate={{
              y: [0, -5, 0],
              rotate: [0, -4, 4, -2, 0],
              scale: [1, 1.03, 1],
              boxShadow: [
                '0 18px 45px rgba(244,114,182,0.28)',
                '0 18px 55px rgba(56,189,248,0.35)',
                '0 18px 45px rgba(244,114,182,0.28)',
              ],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            whileHover={{ scale: 1.08, rotate: 0 }}
            whileTap={{ scale: 0.94 }}
          >
            <span className="absolute inset-2 rounded-[20px] border border-white/70 bg-white/35" />
            <span className="absolute left-1/2 top-1 h-3 w-11 -translate-x-1/2 rounded-full bg-rose-300/80" />
            <span className="absolute left-1/2 top-2 h-[56px] w-3.5 -translate-x-1/2 rounded-full bg-rose-400/80 sm:h-[72px] sm:w-4" />
            <span className="absolute left-2 top-1/2 h-3.5 w-[52px] -translate-y-1/2 rounded-full bg-rose-400/80 sm:h-4 sm:w-[72px]" />
            <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-white/85 text-rose-500 shadow-inner sm:h-14 sm:w-14">
              <FaGift size={26} className="drop-shadow-sm transition-transform duration-300 group-hover:scale-110 sm:size-[30px]" />
            </span>
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-rose-100 bg-white px-2.5 py-1 text-[10px] font-extrabold text-rose-500 shadow-md sm:px-3 sm:text-[11px]">
              {isSpecialDay ? 'Thư hôm nay 💌' : 'Quà hôm nay'}
            </span>
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          isSpecialDay ? (
            <DailyLetterModal
              isOpen={open}
              onClose={() => setOpen(false)}
              userName={displayName || 'bạn'}
              audioSrc="https://res.cloudinary.com/dvrgrmais/video/upload/v1785448506/moly-studio/audio/thu-hom-nay.mp3"
              coverSrc="https://res.cloudinary.com/dvrgrmais/image/upload/v1785448822/moly-studio/images/thu-hom-nay-cover.jpg"
              songTitle="id 072019"
              artistName="W/n"
            />
          ) : (
            <GiftLetterModal
              letter={dailyGift.letter}
              studentName={displayName}
              accepting={dailyGift.accepting}
              onAccept={handleAccept}
              onClose={() => setOpen(false)}
            />
          )
        )}
      </AnimatePresence>
    </>
  );
}

