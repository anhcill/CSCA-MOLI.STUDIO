'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaTimes,
  FaPlay,
  FaPause,
  FaVolumeUp,
  FaVolumeMute,
  FaMusic,
  FaHeart,
  FaBookOpen,
  FaFire,
  FaCompass,
  FaCheckCircle,
  FaRandom,
  FaChevronRight,
  FaChevronLeft,
} from 'react-icons/fa';
import {
  MONDAY_LETTERS_BANK,
  getWeeklyLetterIndex,
  type MondayLetterItem,
} from '@/lib/data/mondayLetters';

export interface DailyLetterModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  audioSrc?: string;
  coverSrc?: string;
  songTitle?: string;
  artistName?: string;
  initialLetterId?: number;
  letterData?: Partial<MondayLetterItem>;
}

export default function DailyLetterModal({
  isOpen,
  onClose,
  userName = 'bạn',
  audioSrc = 'https://res.cloudinary.com/dvrgrmais/video/upload/v1785448506/moly-studio/audio/thu-hom-nay.mp3',
  coverSrc = 'https://res.cloudinary.com/dvrgrmais/image/upload/v1785448822/moly-studio/images/thu-hom-nay-cover.jpg',
  songTitle = 'id 072019',
  artistName = 'W/n',
  initialLetterId,
  letterData,
}: DailyLetterModalProps) {
  const [isOpened, setIsOpened] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);

  // Letter Bank Index (Weekly rotation by default, or initialLetterId)
  const [letterIndex, setLetterIndex] = useState<number>(() => {
    if (typeof initialLetterId === 'number' && initialLetterId >= 1) {
      return (initialLetterId - 1) % MONDAY_LETTERS_BANK.length;
    }
    return getWeeklyLetterIndex();
  });

  const activeLetter = useMemo<MondayLetterItem>(() => {
    const base = MONDAY_LETTERS_BANK[letterIndex] || MONDAY_LETTERS_BANK[0];
    if (letterData) {
      return {
        ...base,
        ...letterData,
        paragraphs: letterData.paragraphs || base.paragraphs,
        actionableGoals: letterData.actionableGoals || base.actionableGoals,
        proverbCallout: letterData.proverbCallout || base.proverbCallout,
      };
    }
    return base;
  }, [letterIndex, letterData]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const letterScrollRef = useRef<HTMLDivElement | null>(null);
  const userInteractionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Switch to next letter
  const handleNextLetter = useCallback(() => {
    setLetterIndex((prev) => (prev + 1) % MONDAY_LETTERS_BANK.length);
    if (letterScrollRef.current) {
      letterScrollRef.current.scrollTop = 0;
    }
  }, []);

  // Switch to previous letter
  const handlePrevLetter = useCallback(() => {
    setLetterIndex((prev) => (prev - 1 + MONDAY_LETTERS_BANK.length) % MONDAY_LETTERS_BANK.length);
    if (letterScrollRef.current) {
      letterScrollRef.current.scrollTop = 0;
    }
  }, []);

  // Pick random letter
  const handleRandomLetter = useCallback(() => {
    setLetterIndex((prev) => {
      let next = Math.floor(Math.random() * MONDAY_LETTERS_BANK.length);
      if (next === prev) next = (next + 1) % MONDAY_LETTERS_BANK.length;
      return next;
    });
    if (letterScrollRef.current) {
      letterScrollRef.current.scrollTop = 0;
    }
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleCloseModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Reset audio & states on close
  const handleCloseModal = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setIsOpened(false);
    setIsOpening(false);
    setUserInteracted(false);
    onClose();
  }, [onClose]);

  // Gently auto-scroll letter if user has not interacted
  useEffect(() => {
    if (!isOpened || userInteracted) return;

    let animationFrame = 0;
    let previousTime = window.performance.now();
    const scrollSpeed = 14; // pixels per second for comfortable reading
    const gentlyScrollLetter = (now: number) => {
      const letter = letterScrollRef.current;
      if (letter) {
        const maxScroll = Math.max(0, letter.scrollHeight - letter.clientHeight);
        const elapsedSeconds = Math.min(0.1, (now - previousTime) / 1000);
        letter.scrollTop = Math.min(maxScroll, letter.scrollTop + scrollSpeed * elapsedSeconds);
      }
      previousTime = now;
      animationFrame = window.requestAnimationFrame(gentlyScrollLetter);
    };
    animationFrame = window.requestAnimationFrame(gentlyScrollLetter);

    return () => window.cancelAnimationFrame(animationFrame);
  }, [isOpened, userInteracted]);

  const handleUserScroll = () => {
    setUserInteracted(true);
    if (userInteractionTimerRef.current) {
      clearTimeout(userInteractionTimerRef.current);
    }
    userInteractionTimerRef.current = setTimeout(() => {
      setUserInteracted(false);
    }, 15000);
  };

  // Handle Play/Pause
  const togglePlay = async () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        setAudioError(false);
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        console.error('Audio playback error:', err);
        setAudioError(true);
        setIsPlaying(false);
      }
    }
  };

  // Open Letter Action
  const handleOpenLetter = () => {
    if (isOpening || isOpened) return;
    setIsOpening(true);

    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.volume = volume;
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setAudioError(false);
        })
        .catch((err) => {
          console.warn('Autoplay blocked or audio failed:', err);
          setAudioError(true);
          setIsPlaying(false);
        });
    }

    setTimeout(() => {
      setIsOpening(false);
      setIsOpened(true);
    }, 800);
  };

  // Audio Event Listeners
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    setIsMuted(newVol === 0);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = volume || 0.8;
        setIsMuted(false);
      } else {
        audioRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || time === 0) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-hidden">
        {/* Hidden HTML5 Audio Element */}
        <audio
          ref={audioRef}
          src={audioSrc}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
          onError={() => setAudioError(true)}
          preload="auto"
        />

        {/* Overlay Backdrop with Blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleCloseModal}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-md transition-opacity"
        />

        {/* Popup Card - High contrast in both Light & Dark Mode */}
        <motion.div
          ref={modalRef}
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          className="relative z-10 flex flex-col w-[calc(100%_-_12px)] max-w-md sm:max-w-2xl max-h-[96vh] sm:max-h-[92vh] overflow-hidden rounded-[28px] bg-gradient-to-b from-[#FFFDF9] via-[#FFF9F3] to-[#FFF4ED] dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 shadow-[0_24px_80px_rgba(244,63,94,0.22)] dark:shadow-[0_24px_80px_rgba(0,0,0,0.85)] border border-rose-200/90 dark:border-slate-800"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Thư thứ Hai đầu tuần"
        >
          {/* Close Button X */}
          <button
            type="button"
            onClick={handleCloseModal}
            aria-label="Đóng thư"
            className="absolute top-3.5 right-3.5 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-rose-100/90 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-rose-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-all focus:outline-none border border-rose-200 dark:border-slate-700 shadow-xs"
          >
            <FaTimes size={14} />
          </button>

          {!isOpened ? (
            /* ─── TRẠNG THÁI 1: CHƯA MỞ THƯ (ENVELOPE SCREEN) ─── */
            <div className="flex flex-col items-center px-5 py-6 sm:px-8 sm:py-8 text-center overflow-y-auto">
              {/* Header Label */}
              <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-rose-100 dark:bg-rose-950/80 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 shadow-xs">
                <FaFire size={11} className="text-orange-500 animate-pulse" />
                THƯ THỨ HAI ĐẦU TUẦN • BỨC THƯ #{activeLetter.id}
              </span>

              {/* Greeting */}
              <p className="mt-1 text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400">
                Gửi <span className="underline decoration-rose-300 underline-offset-4">{userName}</span> thương mến,
              </p>

              {/* Main Title - Sharp & High Contrast */}
              <h2 className="mt-1.5 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-tight">
                {activeLetter.title}
              </h2>

              {/* Subtitle Quote */}
              <p className="mt-2.5 max-w-md text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-semibold italic">
                “{activeLetter.quoteViet}”
              </p>

              {/* Envelope Component */}
              <div className="relative my-4 flex justify-center items-center">
                <motion.div
                  className="relative cursor-pointer group"
                  onClick={handleOpenLetter}
                  whileHover={{ y: -5 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-rose-400/30 via-amber-400/25 to-indigo-500/25 blur-md opacity-50 group-hover:opacity-90 transition duration-500" />

                  <div className="relative w-56 h-36 sm:w-64 sm:h-40 rounded-2xl bg-gradient-to-br from-[#FFF7F0] via-[#FDEEE2] to-[#F9E2D2] dark:from-slate-800 dark:via-slate-850 dark:to-slate-800 border border-rose-200/90 dark:border-slate-700 shadow-md flex items-center justify-center overflow-hidden">
                    <div
                      className="absolute inset-0 border-t-[72px] sm:border-t-[80px] border-t-rose-100 dark:border-t-slate-700 border-x-[112px] sm:border-x-[128px] border-x-transparent border-b-0 top-0 opacity-95 transition-transform origin-top duration-700"
                      style={{
                        transform: isOpening ? 'rotateX(180deg)' : 'rotateX(0deg)',
                      }}
                    />

                    <motion.div
                      className="absolute bottom-2 w-[85%] h-24 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-rose-100 dark:border-slate-700 p-2.5 flex flex-col justify-start items-center"
                      animate={{
                        y: isOpening ? -40 : 0,
                        opacity: isOpening ? 0.9 : 1,
                      }}
                      transition={{ duration: 0.7 }}
                    >
                      <div className="w-10 h-1 bg-rose-400 dark:bg-rose-500 rounded-full mb-1.5" />
                      <div className="w-3/4 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mb-1" />
                      <div className="w-1/2 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
                    </motion.div>

                    <div className="absolute z-10 flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-lg transition-transform group-hover:scale-110">
                      <FaHeart className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Music Badge Notice */}
              <div className="mb-4 inline-flex items-center gap-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs">
                <FaMusic className="text-rose-500 animate-bounce" size={12} />
                <span className="font-bold">Bật nhạc tiếp sức</span>
                <span className="text-slate-400 dark:text-slate-600">•</span>
                <span className="text-slate-600 dark:text-slate-400 italic">Giai điệu truyền cảm hứng</span>
              </div>

              {/* Main Button */}
              <button
                type="button"
                onClick={handleOpenLetter}
                disabled={isOpening}
                className="w-full max-w-xs rounded-2xl bg-gradient-to-r from-rose-500 via-pink-600 to-indigo-600 px-6 py-3.5 text-sm sm:text-base font-black text-white shadow-lg shadow-rose-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-75 tracking-wide"
              >
                {isOpening ? 'Đang mở thư...' : 'Mở Thư Đầu Tuần ✨'}
              </button>
            </div>
          ) : (
            /* ─── TRẠNG THÁI 2: ĐÃ MỞ THƯ (LETTER VIEW - SHARP & INSPIRING) ─── */
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col h-full overflow-hidden px-3.5 py-4 sm:p-6"
            >
              {/* Header (Shrink-0) with Next / Random Controls */}
              <div className="text-center mb-3 shrink-0">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 dark:bg-rose-950/80 px-3 py-0.5 text-[11px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800">
                    <FaFire className="text-orange-500" size={10} />
                    Thư Thứ Hai • #{activeLetter.id}/{MONDAY_LETTERS_BANK.length}
                  </span>

                  {/* Random Letter Button */}
                  <button
                    type="button"
                    onClick={handleRandomLetter}
                    title="Đổi châm ngôn ngẫu nhiên"
                    className="inline-flex items-center gap-1 rounded-full bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/80 dark:hover:bg-amber-900 px-2.5 py-0.5 text-[11px] font-bold text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 transition-colors shadow-2xs"
                  >
                    <FaRandom size={10} className="text-amber-600 dark:text-amber-400" />
                    <span>Đổi thư 🎲</span>
                  </button>

                  {/* Prev / Next Buttons */}
                  <div className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5">
                    <button
                      type="button"
                      onClick={handlePrevLetter}
                      title="Thư trước"
                      className="p-1 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors"
                    >
                      <FaChevronLeft size={10} />
                    </button>
                    <button
                      type="button"
                      onClick={handleNextLetter}
                      title="Thư kế tiếp"
                      className="p-1 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors"
                    >
                      <FaChevronRight size={10} />
                    </button>
                  </div>
                </div>

                <h3 className="mt-1 text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
                  {activeLetter.title}
                </h3>
                <p className="mx-auto mt-1 max-w-lg px-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-semibold italic">
                  “{activeLetter.quoteViet}”
                </p>
              </div>

              {/* Letter Scroll Container - Crisp High Contrast Typography */}
              <div
                ref={letterScrollRef}
                onWheel={handleUserScroll}
                onTouchStart={handleUserScroll}
                className="relative flex-1 min-h-0 rounded-[22px] bg-white dark:bg-slate-950 px-4 py-5 sm:px-6 sm:py-6 shadow-sm border border-rose-200/80 dark:border-slate-800 overflow-y-auto hide-scrollbar"
                style={{
                  fontFamily: '"Segoe UI", Roboto, -apple-system, BlinkMacSystemFont, Arial, sans-serif',
                }}
              >
                <div className="space-y-4 text-[15px] sm:text-base text-slate-900 dark:text-slate-100 leading-relaxed tracking-normal font-medium">
                  {/* Greeting */}
                  <p className="font-extrabold text-rose-600 dark:text-rose-400 text-base sm:text-lg">
                    Gửi <span className="underline decoration-rose-300 underline-offset-4">{userName}</span> thương mến,
                  </p>

                  {/* Ancient Wisdom Callout Box */}
                  <div className="rounded-2xl bg-amber-500/10 dark:bg-amber-400/10 border-l-4 border-amber-500 dark:border-amber-400 p-3.5 sm:p-4 text-slate-900 dark:text-amber-100">
                    <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1">
                      <span>📜</span>
                      <span>Châm ngôn cổ nhân:</span>
                    </div>
                    <p className="text-base sm:text-lg font-black tracking-wide text-amber-950 dark:text-amber-200">
                      {activeLetter.quoteChinese}
                    </p>
                    <p className="mt-1 font-bold text-xs sm:text-sm italic text-slate-800 dark:text-slate-200">
                      “{activeLetter.quoteViet}” — <span className="font-semibold text-amber-800 dark:text-amber-300">{activeLetter.quoteAuthor}</span>
                    </p>
                  </div>

                  {/* Paragraphs */}
                  {activeLetter.paragraphs.map((para, idx) => (
                    <p key={idx} className="text-slate-850 dark:text-slate-100 leading-relaxed">
                      {para}
                    </p>
                  ))}

                  {/* Proverb Insight Box */}
                  {activeLetter.proverbCallout && (
                    <div className="rounded-2xl bg-rose-500/10 dark:bg-rose-400/10 border-l-4 border-rose-500 dark:border-rose-400 p-3.5 sm:p-4 text-slate-900 dark:text-rose-100">
                      <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-1">
                        <FaFire size={11} className="text-orange-500" />
                        <span>{activeLetter.proverbCallout.badge}</span>
                      </div>
                      <blockquote className="text-sm sm:text-base font-bold italic text-slate-900 dark:text-white leading-relaxed">
                        {activeLetter.proverbCallout.quote}
                      </blockquote>
                      <p className="mt-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium">
                        {activeLetter.proverbCallout.meaning}
                      </p>
                    </div>
                  )}

                  {/* 3 Actionable Goals Card */}
                  {activeLetter.actionableGoals && activeLetter.actionableGoals.length > 0 && (
                    <div className="rounded-2xl bg-gradient-to-br from-indigo-50/90 via-purple-50/70 to-pink-50/90 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 border border-indigo-200/80 dark:border-slate-800 p-4">
                      <p className="font-extrabold text-indigo-950 dark:text-indigo-300 flex items-center gap-2 mb-2.5 text-sm sm:text-base">
                        <FaCompass className="text-indigo-600 dark:text-indigo-400" />
                        3 Mục tiêu nhỏ bắt đầu tuần mới hiệu quả:
                      </p>
                      <div className="space-y-2.5 text-xs sm:text-sm text-slate-850 dark:text-slate-200">
                        {activeLetter.actionableGoals.map((goal, gIdx) => (
                          <div key={gIdx} className="flex items-start gap-2">
                            <FaCheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={14} />
                            <div>
                              <strong className="text-indigo-950 dark:text-indigo-200">{goal.title}: </strong>
                              <span>{goal.desc}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Weekly Study Reminder Box */}
                  <div className="rounded-2xl bg-amber-50/90 dark:bg-slate-900 p-4 border border-amber-300/80 dark:border-slate-800 text-xs sm:text-sm shadow-2xs">
                    <p className="font-black text-amber-950 dark:text-amber-300 flex items-center gap-2 mb-1.5">
                      <FaBookOpen className="text-amber-600 dark:text-amber-400" size={14} />
                      Lời nhắc tuần mới từ MOLY:
                    </p>
                    <p className="text-slate-850 dark:text-slate-200 leading-relaxed font-semibold">
                      {activeLetter.reminder}
                    </p>
                  </div>

                  {/* Warm Blessing */}
                  <p className="font-extrabold text-emerald-700 dark:text-emerald-400 text-sm sm:text-[15px] leading-relaxed">
                    ✨ {activeLetter.blessing}
                  </p>

                  {/* Sign-off */}
                  <div className="pt-2 text-right text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 border-t border-slate-100 dark:border-slate-850">
                    <p>Thương mến & đồng hành cùng bạn,</p>
                    <p className="font-black text-rose-600 dark:text-rose-400 text-base sm:text-lg">MOLY.STUDIO 💌</p>
                  </div>
                </div>
              </div>

              {/* Music Player Box - Sleek, Dark Glass Style */}
              <div className="mt-3 shrink-0 rounded-[20px] bg-slate-900 dark:bg-slate-950 p-3.5 text-white shadow-lg border border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-white/20 shadow">
                    <img
                      src={coverSrc}
                      alt={songTitle}
                      className="h-full w-full object-cover"
                    />
                    {isPlaying && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <FaMusic className="h-3.5 w-3.5 text-white animate-spin" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs sm:text-sm font-bold truncate text-white">
                        {songTitle}
                      </h4>
                      <span className="rounded bg-rose-500/30 px-1.5 py-0.5 text-[9px] font-black text-rose-300 border border-rose-500/40">
                        Nhạc tiếp sức
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 truncate">{artistName}</p>

                    {audioError && (
                      <button
                        type="button"
                        onClick={togglePlay}
                        className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-amber-300 underline font-semibold"
                      >
                        <FaPlay size={9} /> Bấm để phát nhạc
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={togglePlay}
                    aria-label={isPlaying ? 'Tạm dừng nhạc' : 'Phát nhạc'}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/30 hover:scale-105 active:scale-95 transition-transform"
                  >
                    {isPlaying ? <FaPause size={12} /> : <FaPlay size={12} className="ml-0.5" />}
                  </button>
                </div>

                <div className="mt-2">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-white/20 accent-rose-500"
                    aria-label="Thanh thời gian bài hát"
                  />
                </div>

                <div className="mt-1.5 flex items-center justify-end gap-1.5 text-[11px] text-slate-400">
                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
                    className="text-slate-300 hover:text-white"
                  >
                    {isMuted || volume === 0 ? <FaVolumeMute size={12} /> : <FaVolumeUp size={12} />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="h-1 w-16 cursor-pointer appearance-none rounded-lg bg-white/20 accent-rose-400"
                    aria-label="Thanh điều chỉnh âm lượng"
                  />
                </div>
              </div>

              {/* Close Button & Action Footer */}
              <div className="mt-3 shrink-0 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleNextLetter}
                  className="rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/80 px-3 py-2.5 text-xs sm:text-sm font-bold text-rose-700 dark:text-rose-300 transition-all active:scale-[0.98]"
                  title="Đọc bức thư kế tiếp"
                >
                  Thư kế ➔
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 py-2.5 text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white shadow-xs transition-all active:scale-[0.98]"
                >
                  Đóng thư & Bắt đầu học 🚀
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
