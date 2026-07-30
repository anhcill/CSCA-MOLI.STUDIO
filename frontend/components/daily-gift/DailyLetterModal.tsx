'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
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
} from 'react-icons/fa';

export interface DailyLetterModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  audioSrc?: string;
  coverSrc?: string;
  songTitle?: string;
  artistName?: string;
}

export default function DailyLetterModal({
  isOpen,
  onClose,
  userName = 'bạn',
  audioSrc = 'https://res.cloudinary.com/dvrgrmais/video/upload/v1785448506/moly-studio/audio/thu-hom-nay.mp3',
  coverSrc = 'https://res.cloudinary.com/dvrgrmais/image/upload/v1785448822/moly-studio/images/thu-hom-nay-cover.jpg',
  songTitle = 'id 072019',
  artistName = 'W/n',
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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const letterScrollRef = useRef<HTMLDivElement | null>(null);
  const userInteractionTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Gently move the letter independently from audio playback. Readers can
  // still scroll back without being snapped to another place in the letter.
  useEffect(() => {
    if (!isOpened || userInteracted) return;

    let animationFrame = 0;
    let previousTime = window.performance.now();
    const scrollSpeed = 16; // pixels per second
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

  // Give readers enough time to review an earlier paragraph before resuming.
  const handleUserScroll = () => {
    setUserInteracted(true);

    if (userInteractionTimerRef.current) {
      clearTimeout(userInteractionTimerRef.current);
    }

    userInteractionTimerRef.current = setTimeout(() => {
      setUserInteracted(false);
    }, 12000);
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

    // Play audio immediately in same click event context
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

    // Animation transition after envelope open
    setTimeout(() => {
      setIsOpening(false);
      setIsOpened(true);
    }, 850);
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
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity"
        />

        {/* Popup Card - Constrained inside max-h-[85vh] */}
        <motion.div
          ref={modalRef}
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          className="relative z-10 flex flex-col w-[calc(100%_-_12px)] max-w-md sm:max-w-xl max-h-[96vh] sm:max-h-[92vh] overflow-hidden rounded-[26px] bg-[#FFF8F3] shadow-[0_24px_80px_rgba(69,36,49,0.28)] border border-[#E8D3CA]"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Thư hôm nay"
        >
          {/* Close Button X */}
          <button
            type="button"
            onClick={handleCloseModal}
            aria-label="Đóng popup"
            className="absolute top-3.5 right-3.5 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-[#F1E5E1] text-[#765D67] transition-all hover:bg-[#E8D3D0] hover:text-[#442D37] focus:outline-none"
          >
            <FaTimes size={14} />
          </button>

          {!isOpened ? (
            /* TRẠNG THÁI 1: CHƯA MỞ THƯ */
            <div className="flex flex-col items-center px-5 py-6 sm:px-8 sm:py-8 text-center overflow-y-auto">
              {/* Header Label */}
              <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-[#F9D6DF]/60 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-[#F45C7A]">
                <FaHeart size={10} className="animate-pulse" />
                THƯ HÔM NAY
              </span>

              {/* Greeting */}
              <p className="mt-1 text-xs sm:text-sm font-medium text-[#F45C7A]">
                Gửi <span className="font-bold">{userName}</span> thương mến,
              </p>

              {/* Main Title */}
              <h2 className="mt-1.5 text-xl sm:text-2xl font-extrabold text-[#172033] leading-snug">
                Có một lá thư <br /> đang chờ bạn
              </h2>

              {/* Subtitle */}
              <p className="mt-2 max-w-xs text-xs sm:text-sm text-slate-500 leading-relaxed font-serif italic">
                “Có những ngày trái tim chỉ muốn nghe một bản nhạc buồn và thở chậm lại.”
              </p>

              {/* Envelope Component */}
              <div className="relative my-4 flex justify-center items-center">
                <motion.div
                  className="relative cursor-pointer group"
                  onClick={handleOpenLetter}
                  whileHover={{ y: -5 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-[#F9D6DF] via-[#A96FD4]/20 to-[#4D8FE8]/20 blur-md opacity-40 group-hover:opacity-80 transition duration-500" />

                  <div className="relative w-52 h-32 sm:w-60 sm:h-36 rounded-2xl bg-gradient-to-br from-[#FFF5ED] via-[#FDF0E6] to-[#F7E5D8] border border-[rgba(180,120,130,0.25)] shadow-md flex items-center justify-center overflow-hidden">
                    <div
                      className="absolute inset-0 border-t-[65px] sm:border-t-[75px] border-t-[#FBE3D4] border-x-[104px] sm:border-x-[120px] border-x-transparent border-b-0 top-0 opacity-90 transition-transform origin-top duration-700"
                      style={{
                        transform: isOpening ? 'rotateX(180deg)' : 'rotateX(0deg)',
                      }}
                    />

                    <motion.div
                      className="absolute bottom-2 w-[85%] h-20 bg-white rounded-lg shadow-sm border border-pink-100/60 p-2.5 flex flex-col justify-start items-center"
                      animate={{
                        y: isOpening ? -35 : 0,
                        opacity: isOpening ? 0.9 : 1,
                      }}
                      transition={{ duration: 0.7 }}
                    >
                      <div className="w-10 h-1 bg-rose-200 rounded-full mb-1.5" />
                      <div className="w-3/4 h-1 bg-slate-200 rounded-full mb-1" />
                      <div className="w-1/2 h-1 bg-slate-200 rounded-full" />
                    </motion.div>

                    <div className="absolute z-10 flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-[#F45C7A] text-white shadow-md transition-transform group-hover:scale-110">
                      <FaHeart className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Music Badge Notice */}
              <div className="mb-4 inline-flex items-center gap-1.5 rounded-xl bg-slate-100/80 px-3 py-1 text-xs text-slate-600 border border-slate-200/50">
                <FaMusic className="text-[#B85E7A] animate-bounce" size={12} />
                <span className="font-medium text-[#4B3440]">Bật nhạc khi mở thư</span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-500 italic">Bản nhạc buồn nhẹ nhàng</span>
              </div>

              {/* Main Button */}
              <button
                type="button"
                onClick={handleOpenLetter}
                disabled={isOpening}
                className="w-full max-w-xs rounded-2xl bg-gradient-to-r from-[#D85F7B] via-[#BE648A] to-[#8B668F] px-6 py-3 text-sm sm:text-base font-bold text-white shadow-lg shadow-[#A84F6B]/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-75"
              >
                {isOpening ? 'Đang mở thư...' : 'Mở thư'}
              </button>
            </div>
          ) : (
            /* TRẠNG THÁI 2: ĐÃ MỞ THƯ (Fit Screen Layout) */
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col h-full overflow-hidden px-3 py-3.5 sm:p-5"
            >
              {/* Header (Shrink-0) */}
              <div className="text-center mb-2.5 shrink-0">
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-[#BE6A80]">
                  Thư hôm nay
                </span>
                <h3 className="mt-1 text-xl sm:text-2xl font-black text-[#402A34]">
                  Mở thư ra rồi...
                </h3>
                <p className="mx-auto mt-1 max-w-md px-8 text-[12px] sm:text-sm leading-[18px] text-[#896D78] italic">
                  “Có những ngày trái tim chỉ muốn nghe một bản nhạc buồn và thở chậm lại.”
                </p>
              </div>

              {/* Letter Scroll Container (Flex-1, Auto-Scrollable, Handcrafted Font) */}
              <div
                ref={letterScrollRef}
                onWheel={handleUserScroll}
                onTouchStart={handleUserScroll}
                className="relative flex-1 min-h-0 rounded-[20px] bg-[#FFFEFC] px-4 py-4 sm:px-6 sm:py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_28px_rgba(93,57,68,0.07)] border border-[#EBDCD6] overflow-y-auto hide-scrollbar"
                style={{
                  fontFamily: '"Segoe UI", Arial, sans-serif',
                  backgroundImage: 'radial-gradient(circle at 15% 10%, rgba(220, 150, 165, 0.06), transparent 28%), radial-gradient(circle at 85% 90%, rgba(180, 135, 170, 0.05), transparent 30%)',
                }}
              >
                <div className="space-y-3.5 text-[15px] sm:text-base text-[#503C45] leading-6 sm:leading-7 tracking-normal">
                  <p className="font-bold text-[#C65372] text-base sm:text-lg">
                    Gửi <span className="underline decoration-[#E5A6B6] underline-offset-4">{userName}</span> thương mến,
                  </p>

                  <p>
                    Nếu hôm nay bạn thấy lòng mình chùng xuống,
                    <br />
                    thì cũng không sao cả.
                  </p>

                  <p>
                    Có những cuộc gặp gỡ đẹp chỉ để lại một mùa nhớ.
                    <br />
                    Bạn không cần vội quên, cũng không cần phải mạnh mẽ ngay lúc này.
                  </p>

                  <p>
                    Cứ để âm nhạc ôm lấy bạn một chút,
                    <br />
                    nghỉ ngơi vài phút rồi hãy tiếp tục hành trình của mình.
                  </p>

                  <p>
                    Không cần phải đi thật nhanh.
                    <br />
                    Chỉ cần bạn vẫn tiếp tục, từng chút một, như vậy đã rất đáng quý rồi.
                  </p>

                  <p>
                    Chúc bạn có một ngày nhẹ nhàng, học tập hiệu quả và tìm thấy niềm vui trong những điều nhỏ bé.
                  </p>

                  <p className="font-semibold text-[#A65375]">
                    Rồi ngày mai sẽ dịu hơn.
                  </p>

                  {/* Today's notice appears before the closing signature. */}
                  <div className="mt-5 rounded-2xl bg-[#FFF1ED] p-4 border border-[#F0D6CE] text-sm">
                    <p className="font-bold text-[#573945] flex items-center gap-2 mb-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F7DDE2]">
                        <FaBookOpen className="text-[#B95974]" size={13} />
                      </span>
                      Thông báo từ MOLY.STUDIO:
                    </p>
                    <div className="space-y-2 text-[#755D66] leading-6">
                      <p>
                        Hẹn bạn lúc <strong className="text-[#A84F6B]">20:00 tối nay</strong> để cùng đón xem <strong className="text-[#A84F6B]">MV 3107</strong>.
                        Một món quà âm nhạc nhỏ đang chờ bạn!
                      </p>
                      <p>
                        Đừng quên dành thời gian cổ vũ và đón xem <strong className="text-[#A84F6B]">đội tuyển bóng đá Việt Nam</strong> nhé.
                        Chúc đội tuyển thi đấu thật tự tin và mang về nhiều cảm xúc đẹp cho người hâm mộ.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 text-right text-sm font-semibold text-[#705762]">
                    <p>Thương mến,</p>
                    <p className="font-bold text-[#C65372] text-base sm:text-lg">MOLY.STUDIO 💌</p>
                  </div>
                </div>
              </div>

              {/* Music Player Box (Shrink-0) */}
              <div className="mt-3 shrink-0 rounded-[20px] bg-gradient-to-br from-[#49313E] via-[#3E3040] to-[#303A4C] p-3.5 text-white shadow-[0_10px_28px_rgba(62,40,52,0.2)] border border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-white/20 shadow">
                    <img
                      src={coverSrc}
                      alt={songTitle}
                      className="h-full w-full object-cover"
                    />
                    {isPlaying && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <FaMusic className="h-3.5 w-3.5 text-white animate-spin-slow" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs sm:text-sm font-bold truncate text-[#FFD8E1]">
                        {songTitle}
                      </h4>
                      <span className="rounded bg-[#C45A78]/30 px-1.5 py-0.5 text-[9px] font-semibold text-[#FFB6C9]">
                        3107
                      </span>
                    </div>
                    <p className="text-[11px] text-[#D8C9D1] truncate">{artistName}</p>

                    {audioError && (
                      <button
                        type="button"
                        onClick={togglePlay}
                        className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-amber-300 underline font-semibold"
                      >
                        <FaPlay size={9} /> Phát nhạc
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={togglePlay}
                    aria-label={isPlaying ? 'Tạm dừng nhạc' : 'Phát nhạc'}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#E36986] to-[#B35E8D] text-white shadow-lg shadow-[#2A1720]/20 hover:scale-105 active:scale-95 transition-transform"
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
                    className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-white/20 accent-[#E36986]"
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
                    className="h-1 w-16 cursor-pointer appearance-none rounded-lg bg-white/20 accent-[#D78AA0]"
                    aria-label="Thanh điều chỉnh âm lượng"
                  />
                </div>
              </div>

              {/* Close Button (Shrink-0) */}
              <button
                type="button"
                onClick={handleCloseModal}
                className="mt-3 shrink-0 w-full rounded-xl border border-[#DCC5BD] bg-[#FFFCF9] py-2.5 text-xs sm:text-sm font-bold text-[#654A56] shadow-xs transition-all hover:border-[#C88A9A] hover:bg-[#FFF4F1] hover:text-[#442D37]"
              >
                Đóng thư
              </button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
