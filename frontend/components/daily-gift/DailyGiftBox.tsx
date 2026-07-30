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

  // On normal days, hide if already opened today or no letter.
  // On special letter days, ALWAYS show the floating button so user can open & listen to music.
  if (!isSpecialDay && (!dailyGift.shouldShow || !dailyGift.letter)) return null;

  const handleAccept = async () => {
    await dailyGift.markOpened();
    setOpen(false);
  };

  return (
    <>
      <div className="fixed bottom-[max(5.25rem,calc(env(safe-area-inset-bottom)+4.75rem))] right-3 z-[9996] sm:bottom-28 sm:right-6">
        <div className="relative h-16 w-16 sm:h-20 sm:w-20">
          {FLOATING_DECOR.map(({ Icon, className, delay }) => (
            <motion.span
              key={className}
              className={`pointer-events-none absolute ${className}`}
              animate={{
                y: [6, -14, -24],
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
              <Icon size={13} />
            </motion.span>
          ))}

          <motion.button
            type="button"
            aria-label="Mở thư quà học tập hôm nay"
            onClick={() => setOpen(true)}
            className="group absolute inset-x-0 bottom-0 mx-auto flex h-[52px] w-[52px] sm:h-[60px] sm:w-[60px] items-center justify-center rounded-2xl bg-gradient-to-br from-[#F45C7A] via-[#E84E6E] to-[#A96FD4] text-white shadow-[0_8px_25px_rgba(244,92,122,0.4)] outline-none transition-transform focus-visible:ring-2 focus-visible:ring-rose-400"
            animate={{
              y: [0, -4, 0],
              rotate: [0, -3, 3, -1, 0],
              scale: [1, 1.02, 1],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
          >
            {/* Gift Box Icon centered cleanly */}
            <div className="relative flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-xs">
              <FaGift size={22} className="drop-shadow-xs transition-transform duration-300 group-hover:scale-110 sm:size-[24px]" />
            </div>

            {/* Bottom Label Badge */}
            <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-rose-100/80 bg-white/95 px-2.5 py-0.5 text-[10px] font-extrabold text-[#F45C7A] shadow-md sm:px-3 sm:text-[11px]">
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

