'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiMusic, FiPause, FiPlay, FiVolume2, FiX } from 'react-icons/fi';

const WELCOME_ARTWORK = 'https://res.cloudinary.com/dvrgrmais/image/upload/v1787951634/moly-studio/campaigns/2026-national-day/welcome-modal.png';
const NATIONAL_DAY_SONG = 'https://res.cloudinary.com/dvrgrmais/video/upload/v1787951635/moly-studio/campaigns/2026-national-day/nha-toi-co-treo-mot-la-co.mp3';
const MUSIC_START_AT_SECONDS = 2 * 60 + 16;
const DAILY_WELCOME_KEY_PREFIX = 'moly:national-day-welcome:';

// 5-pointed star polygon for viewBox 0 0 30 20 (standard 3:2 flag ratio)
const STAR_POINTS =
  '15,4 16.35,8.15 20.71,8.15 17.18,10.71 18.53,14.85 15,12.29 11.47,14.85 12.82,10.71 9.29,8.15 13.65,8.15';

/** SVG lá cờ Việt Nam thu nhỏ với bóng đổ và dải màu tự nhiên */
function FallingFlagSvg({ width }: { width: number }) {
  const height = (width * 2) / 3;
  return (
    <svg
      viewBox="0 0 30 20"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width, height, display: 'block' }}
      className="drop-shadow-[0_4px_8px_rgba(0,0,0,0.35)]"
    >
      <defs>
        <linearGradient id="flagRedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e5231b" />
          <stop offset="50%" stopColor="#da251d" />
          <stop offset="100%" stopColor="#b51512" />
        </linearGradient>
      </defs>
      <rect width="30" height="20" rx="1.2" fill="url(#flagRedGrad)" />
      {/* Vệt bóng uốn lượn nhẹ trên mặt vải */}
      <path
        d="M0,0 Q7.5,3 15,0 T30,0 L30,20 Q22.5,17 15,20 T0,20 Z"
        fill="rgba(255,255,255,0.08)"
      />
      {/* Ngôi sao vàng 5 cánh chuẩn tỉ lệ */}
      <polygon points={STAR_POINTS} fill="#FFCD00" filter="drop-shadow(0 1px 2px rgba(90,0,0,0.3))" />
    </svg>
  );
}

function getVietnamDayKey() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  return `${values.year}-${values.month}-${values.day}`;
}

export default function NationalDayGreeting() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [open, setOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [needsMusicTap, setNeedsMusicTap] = useState(false);

  // Tạo 32 lá cờ rơi với vị trí, kích thước và tốc độ đa dạng
  const fallingFlags = useMemo(() => {
    return Array.from({ length: 32 }, (_, i) => {
      const width = 22 + (i % 6) * 5; // Độ rộng từ 22px đến 47px
      const left = ((i * 3.1 + (i % 5) * 7.7) % 96) + 2; // Rải đều từ 2% đến 98%
      const duration = 7 + (i % 7) * 1.5; // Thời gian rơi từ 7s đến 16s
      const delay = -((i * 0.65) % 12); // Delay âm để khi mở ra là cờ đã đang rơi sẵn khắp màn hình
      const swayDuration = 2.5 + (i % 4) * 0.7; // Tốc độ chao liệng
      const animType = (i % 3) + 1; // 3 kiểu lượn sóng khác nhau

      return {
        id: `ff-${i}`,
        width,
        left: `${left}%`,
        duration: `${duration}s`,
        delay: `${delay}s`,
        swayDuration: `${swayDuration}s`,
        animType,
      };
    });
  }, []);

  const resetAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = MUSIC_START_AT_SECONDS;
    setIsPlaying(false);
  }, []);

  const playMusic = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (audio.currentTime < MUSIC_START_AT_SECONDS || Number.isNaN(audio.currentTime)) {
        audio.currentTime = MUSIC_START_AT_SECONDS;
      }
      audio.volume = 0.72;
      await audio.play();
      setNeedsMusicTap(false);
      setIsPlaying(true);
    } catch {
      setNeedsMusicTap(true);
      setIsPlaying(false);
    }
  }, []);

  const closeGreeting = useCallback(() => {
    setOpen(false);
    resetAudio();
  }, [resetAudio]);

  useEffect(() => {
    const welcomeKey = `${DAILY_WELCOME_KEY_PREFIX}${getVietnamDayKey()}`;
    let timer: number | undefined;

    try {
      if (!window.localStorage.getItem(welcomeKey)) {
        window.localStorage.setItem(welcomeKey, 'shown');
        timer = window.setTimeout(() => setOpen(true), 550);
      }
    } catch {
      timer = window.setTimeout(() => setOpen(true), 550);
    }

    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeGreeting();
    };
    document.addEventListener('keydown', handleEscape);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const attemptToPlay = window.setTimeout(() => void playMusic(), 300);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = originalOverflow;
      window.clearTimeout(attemptToPlay);
    };
  }, [closeGreeting, open, playMusic]);

  useEffect(() => () => resetAudio(), [resetAudio]);

  const toggleMusic = () => {
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }
    void playMusic();
  };

  return (
    <>
      <audio
        ref={audioRef}
        src={NATIONAL_DAY_SONG}
        preload="metadata"
        onLoadedMetadata={(event) => {
          event.currentTarget.currentTime = MUSIC_START_AT_SECONDS;
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={resetAudio}
      />

      <div className="fixed bottom-[max(5.25rem,calc(env(safe-area-inset-bottom)+4.75rem))] right-3 z-[9996] sm:bottom-28 sm:right-6">
        <motion.button
          type="button"
          aria-label="Mở lời chào Quốc Khánh và nghe lại nhạc"
          onClick={() => setOpen(true)}
          className="national-day-replay-button group relative flex h-14 w-14 items-center justify-center rounded-2xl text-white outline-none sm:h-[68px] sm:w-[68px]"
          animate={{ y: [0, -4, 0], rotate: [0, -2, 2, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          whileHover={{ scale: 1.07 }}
          whileTap={{ scale: 0.94 }}
        >
          <span aria-hidden="true" className="national-day-replay-star">★</span>
          <FiMusic size={25} className="relative z-10 drop-shadow-sm sm:hidden" />
          <FiMusic size={29} className="relative z-10 hidden drop-shadow-sm sm:block" />
          <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#ffe490]/70 bg-[#fff8e9] px-2.5 py-0.5 text-[10px] font-extrabold text-[#a90b18] shadow-lg sm:px-3 sm:text-[11px]">
            Quốc Khánh
          </span>
        </motion.button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className="national-day-greeting-backdrop fixed inset-0 z-[10050] flex items-center justify-center p-3 sm:p-6 overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeGreeting();
            }}
          >
            {/* ── Hiệu ứng lá cờ Việt Nam rơi nhẹ nhàng khắp màn hình ── */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
              {fallingFlags.map((flag) => (
                <div
                  key={flag.id}
                  className="falling-flag-container"
                  style={{
                    left: flag.left,
                    animationDuration: flag.duration,
                    animationDelay: flag.delay,
                  }}
                >
                  <div
                    className={`falling-flag-sway falling-flag-sway-type-${flag.animType}`}
                    style={{
                      animationDuration: flag.swayDuration,
                    }}
                  >
                    <FallingFlagSvg width={flag.width} />
                  </div>
                </div>
              ))}
            </div>

            {/* ── Modal Pop-up chính ── */}
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="national-day-greeting-title"
              className="national-day-greeting-card relative z-10 w-full max-w-[560px] overflow-hidden rounded-[22px] border border-[#f8c657]/80 bg-[#fff6e6] shadow-[0_30px_100px_rgba(0,0,0,0.62)]"
              initial={{ opacity: 0, y: 32, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 22, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 240, damping: 24 }}
            >
              <h2 id="national-day-greeting-title" className="sr-only">
                Chào mừng Quốc Khánh 2 tháng 9
              </h2>
              <motion.div
                className="relative aspect-[1303/1207] w-full"
                animate={{ scale: [1, 1.015, 1], filter: ['saturate(1)', 'saturate(1.08)', 'saturate(1)'] }}
                transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Image
                  src={WELCOME_ARTWORK}
                  alt="Chào mừng Quốc Khánh 2 tháng 9"
                  fill
                  priority
                  sizes="(max-width: 768px) 94vw, 560px"
                  className="object-cover"
                />
                <div aria-hidden="true" className="national-day-artwork-glow" />
              </motion.div>

              <button
                type="button"
                aria-label="Đóng lời chào Quốc Khánh"
                onClick={closeGreeting}
                className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/80 bg-[#12203a]/80 text-white shadow-lg backdrop-blur-sm transition hover:scale-105 hover:bg-[#071326] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd25e] sm:right-3 sm:top-3"
              >
                <FiX size={23} />
              </button>

              <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center px-3 pb-3 sm:px-4 sm:pb-4">
                <button
                  type="button"
                  onClick={toggleMusic}
                  className="national-day-music-control flex min-h-10 items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold text-white shadow-xl transition hover:scale-[1.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:px-4"
                >
                  {isPlaying ? <FiPause size={15} /> : <FiPlay size={15} />}
                  <span>{isPlaying ? 'Tạm dừng nhạc' : needsMusicTap ? 'Bật nhạc từ 2:16' : 'Nghe nhạc từ 2:16'}</span>
                  {isPlaying && <FiVolume2 size={15} className="animate-pulse" />}
                </button>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .national-day-replay-button {
          background: radial-gradient(circle at 30% 24%, #ffdf75 0 8%, transparent 9%), linear-gradient(145deg, #f2212d, #9d0717 68%, #5d0511);
          border: 1px solid rgba(255, 221, 113, 0.92);
          box-shadow: 0 10px 28px rgba(105, 3, 18, 0.56), inset 0 1px 0 rgba(255, 255, 255, 0.35);
        }
        .national-day-replay-button::after {
          content: '';
          position: absolute;
          inset: 4px;
          border-radius: 13px;
          border: 1px solid rgba(255, 227, 129, 0.42);
        }
        .national-day-replay-star {
          position: absolute;
          inset: -12px auto auto -9px;
          color: rgba(255, 218, 90, 0.85);
          font-size: 22px;
          filter: drop-shadow(0 2px 4px rgba(70, 0, 0, 0.5));
          animation: national-day-star-sparkle 2.8s ease-in-out infinite;
        }
        .national-day-greeting-backdrop {
          background: radial-gradient(circle at 50% 35%, rgba(196, 19, 35, 0.24), transparent 42%), rgba(1, 8, 22, 0.84);
          backdrop-filter: blur(8px);
        }
        .national-day-greeting-card::before {
          content: '';
          position: absolute;
          inset: 0;
          z-index: 10;
          pointer-events: none;
          border-radius: inherit;
          box-shadow: inset 0 0 42px rgba(255, 220, 126, 0.18);
        }
        .national-day-artwork-glow {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(180deg, rgba(255, 223, 142, 0.08), transparent 35%, rgba(101, 0, 11, 0.12));
        }
        .national-day-music-control {
          border: 1px solid rgba(255, 230, 153, 0.92);
          background: linear-gradient(135deg, rgba(194, 9, 27, 0.96), rgba(120, 3, 15, 0.96));
          box-shadow: 0 8px 24px rgba(55, 0, 9, 0.44), inset 0 1px 0 rgba(255, 255, 255, 0.25);
          backdrop-filter: blur(8px);
        }

        /* ═══════════════════════════════════════════════════
           HIỆU ỨNG CỜ RƠI (FALLING FLAGS EFFECT)
           ═══════════════════════════════════════════════════ */

        .falling-flag-container {
          position: absolute;
          top: -60px;
          pointer-events: none;
          animation: falling-flag-down linear infinite;
          will-change: transform, opacity;
        }

        @keyframes falling-flag-down {
          0% {
            transform: translateY(0);
            opacity: 0;
          }
          4% {
            opacity: 0.92;
          }
          85% {
            opacity: 0.85;
          }
          100% {
            transform: translateY(115vh);
            opacity: 0;
          }
        }

        /* Kiểu lượn sóng 1: Lượn 3D góc nghiêng vừa */
        .falling-flag-sway-type-1 {
          animation: falling-flag-sway-1 ease-in-out infinite alternate;
        }
        @keyframes falling-flag-sway-1 {
          0% {
            transform: perspective(400px) rotateX(15deg) rotateY(-25deg) rotateZ(-18deg) translateX(-18px);
          }
          50% {
            transform: perspective(400px) rotateX(-10deg) rotateY(15deg) rotateZ(8deg) translateX(12px);
          }
          100% {
            transform: perspective(400px) rotateX(20deg) rotateY(28deg) rotateZ(22deg) translateX(25px);
          }
        }

        /* Kiểu lượn sóng 2: Lộn vòng nhẹ nhàng như lá rơi trong gió */
        .falling-flag-sway-type-2 {
          animation: falling-flag-sway-2 ease-in-out infinite alternate;
        }
        @keyframes falling-flag-sway-2 {
          0% {
            transform: perspective(400px) rotateX(-20deg) rotateY(35deg) rotateZ(25deg) translateX(20px);
          }
          50% {
            transform: perspective(400px) rotateX(15deg) rotateY(-15deg) rotateZ(-10deg) translateX(-10px);
          }
          100% {
            transform: perspective(400px) rotateX(-25deg) rotateY(-35deg) rotateZ(-22deg) translateX(-22px);
          }
        }

        /* Kiểu lượn sóng 3: Bay là đà mềm mại */
        .falling-flag-sway-type-3 {
          animation: falling-flag-sway-3 ease-in-out infinite alternate;
        }
        @keyframes falling-flag-sway-3 {
          0% {
            transform: perspective(400px) rotateX(10deg) rotateY(-15deg) rotateZ(-8deg) translateX(-8px);
          }
          100% {
            transform: perspective(400px) rotateX(-15deg) rotateY(20deg) rotateZ(12deg) translateX(14px);
          }
        }

        @keyframes national-day-star-sparkle {
          0%, 100% { transform: scale(0.78) rotate(-8deg); opacity: 0.58; }
          50% { transform: scale(1.16) rotate(14deg); opacity: 1; }
        }

        @media (max-width: 640px) {
          .falling-flag-container {
            opacity: 0.75;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .national-day-replay-star,
          .falling-flag-container,
          .falling-flag-sway {
            animation: none !important;
          }
        }
      `}</style>
    </>
  );
}
