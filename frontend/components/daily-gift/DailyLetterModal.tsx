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
  FaEnvelope,
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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

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

  // Reset audio on close or reopen
  const handleCloseModal = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setIsOpened(false);
    setIsOpening(false);
    onClose();
  }, [onClose]);

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

    // Play audio immediately in same click event context to prevent browser autoplay block
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
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
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
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-md transition-opacity"
        />

        {/* Popup Card */}
        <motion.div
          ref={modalRef}
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl shadow-2xl border border-[rgba(180,120,130,0.18)]"
          style={{ backgroundColor: '#FFF9F5' }}
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
            className="absolute top-4 right-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-slate-200/50 text-[#172033]/60 transition-all hover:bg-slate-300/60 hover:text-[#172033] focus:outline-none"
          >
            <FaTimes size={16} />
          </button>

          {!isOpened ? (
            /* TRẠNG THÁI 1: CHƯA MỞ THƯ */
            <div className="flex flex-col items-center px-6 py-8 sm:px-10 sm:py-10 text-center">
              {/* Header Label */}
              <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[#F9D6DF]/60 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#F45C7A]">
                <FaHeart size={10} className="animate-pulse" />
                THƯ HÔM NAY
              </span>

              {/* Greeting */}
              <p className="mt-2 text-sm font-medium text-[#F45C7A]">
                Gửi <span className="font-bold">{userName}</span> thương mến,
              </p>

              {/* Main Title */}
              <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-[#172033] leading-snug">
                Có một lá thư <br /> đang chờ bạn
              </h2>

              {/* Subtitle / Description */}
              <p className="mt-3 max-w-xs text-xs sm:text-sm text-slate-500 leading-relaxed">
                Có những ngày trái tim chỉ muốn nghe một bản nhạc buồn và thở chậm lại.
              </p>

              {/* Envelope Component */}
              <div className="relative my-6 flex justify-center items-center">
                <motion.div
                  className="relative cursor-pointer group"
                  onClick={handleOpenLetter}
                  whileHover={{ y: -6 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Soft Envelope Glow on Hover */}
                  <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-[#F9D6DF] via-[#A96FD4]/20 to-[#4D8FE8]/20 blur-lg opacity-40 group-hover:opacity-80 transition duration-500" />

                  {/* Envelope Container */}
                  <div className="relative w-56 h-36 sm:w-64 sm:h-40 rounded-2xl bg-gradient-to-br from-[#FFF5ED] via-[#FDF0E6] to-[#F7E5D8] border border-[rgba(180,120,130,0.25)] shadow-md flex items-center justify-center overflow-hidden">
                    {/* Envelope Lines & Flap */}
                    <div className="absolute inset-0 border-t-[75px] sm:border-t-[85px] border-t-[#FBE3D4] border-x-[112px] sm:border-x-[128px] border-x-transparent border-b-0 top-0 opacity-90 transition-transform origin-top duration-700"
                      style={{
                        transform: isOpening ? 'rotateX(180deg)' : 'rotateX(0deg)',
                      }}
                    />
                    
                    {/* Letter Peek inside Envelope */}
                    <motion.div
                      className="absolute bottom-2 w-[85%] h-24 bg-white rounded-lg shadow-sm border border-pink-100/60 p-3 flex flex-col justify-start items-center"
                      animate={{
                        y: isOpening ? -40 : 0,
                        opacity: isOpening ? 0.9 : 1,
                      }}
                      transition={{ duration: 0.7 }}
                    >
                      <div className="w-12 h-1 bg-rose-200 rounded-full mb-2" />
                      <div className="w-3/4 h-1 bg-slate-200 rounded-full mb-1" />
                      <div className="w-1/2 h-1 bg-slate-200 rounded-full" />
                    </motion.div>

                    {/* Heart Seal Stamp */}
                    <div className="absolute z-10 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-[#F45C7A] text-white shadow-md transition-transform group-hover:scale-110">
                      <FaHeart className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Music Badge Notice */}
              <div className="mb-6 inline-flex items-center gap-2 rounded-xl bg-slate-100/80 px-3.5 py-1.5 text-xs text-slate-600 border border-slate-200/50">
                <FaMusic className="text-[#A96FD4] animate-bounce" />
                <span className="font-medium text-[#172033]">Bật nhạc khi mở thư</span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-500 italic">Một bản nhạc buồn nhẹ nhàng</span>
              </div>

              {/* Main Button: Open Letter */}
              <button
                type="button"
                onClick={handleOpenLetter}
                disabled={isOpening}
                className="w-full max-w-xs rounded-2xl bg-gradient-to-r from-[#F45C7A] via-[#A96FD4] to-[#4D8FE8] px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-pink-500/20 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-pink-500/30 active:scale-[0.98] disabled:opacity-75"
              >
                {isOpening ? 'Đang mở thư...' : 'Mở thư'}
              </button>
            </div>
          ) : (
            /* TRẠNG THÁI 2: ĐÃ MỞ THƯ */
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col px-5 py-6 sm:px-8 sm:py-8"
            >
              {/* Header */}
              <div className="text-center mb-4">
                <h3 className="text-xl sm:text-2xl font-black text-[#172033]">
                  Mở thư ra rồi...
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-slate-500 italic">
                  Có những ngày trái tim chỉ muốn nghe một bản nhạc buồn và thở chậm lại.
                </p>
              </div>

              {/* Letter Content Card */}
              <div className="relative rounded-2xl bg-white p-5 sm:p-6 shadow-sm border border-[rgba(180,120,130,0.18)] text-[#172033] max-h-[50vh] overflow-y-auto hide-scrollbar">
                <div className="space-y-3.5 text-sm sm:text-[15px] leading-relaxed text-slate-700 font-sans">
                  <p className="font-semibold text-[#F45C7A]">
                    Gửi <span className="underline decoration-pink-300">{userName}</span> thương mến,
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

                  {/* MOLY Study Announcement */}
                  <div className="my-3 rounded-xl bg-[#FFF9F5] p-3.5 border border-[#F9D6DF] text-xs sm:text-sm">
                    <p className="font-semibold text-[#172033] flex items-center gap-1.5 mb-1">
                      <FaBookOpen className="text-[#4D8FE8]" />
                      Thông báo từ MOLY:
                    </p>
                    <p className="text-slate-600 leading-relaxed">
                      Hôm nay, MOLY cũng đã cập nhật thêm một số đề luyện tập miễn phí mới dành cho bạn.
                      Khi cảm thấy sẵn sàng, bạn có thể mở đề, ôn lại kiến thức và tiến thêm một bước nhỏ đến mục tiêu của mình.
                    </p>
                  </div>

                  <p>
                    Không cần phải đi thật nhanh.
                    <br />
                    Chỉ cần bạn vẫn tiếp tục, từng chút một, như vậy đã rất đáng quý rồi.
                  </p>

                  <p>
                    Chúc bạn có một ngày nhẹ nhàng, học tập hiệu quả và tìm thấy niềm vui trong những điều nhỏ bé.
                  </p>

                  <p className="font-medium italic text-[#A96FD4]">
                    Rồi ngày mai sẽ dịu hơn.
                  </p>

                  <div className="pt-2 text-right text-xs sm:text-sm font-semibold text-slate-600">
                    <p>Thương mến,</p>
                    <p className="font-bold text-[#F45C7A] text-base">MOLY.STUDIO 💌</p>
                  </div>
                </div>
              </div>

              {/* Music Player Box */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-4 rounded-2xl bg-gradient-to-r from-slate-900 to-[#172033] p-4 text-white shadow-lg"
              >
                <div className="flex items-center gap-3">
                  {/* Song Thumbnail */}
                  <div className="relative h-12 w-12 sm:h-14 sm:w-14 shrink-0 overflow-hidden rounded-xl border border-white/20 shadow">
                    <img
                      src={coverSrc}
                      alt={songTitle}
                      className="h-full w-full object-cover"
                    />
                    {isPlaying && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <FaMusic className="h-4 w-4 text-white animate-spin-slow" />
                      </div>
                    )}
                  </div>

                  {/* Song Title & Artist */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm sm:text-base font-bold truncate text-pink-200">
                        {songTitle}
                      </h4>
                      <span className="rounded bg-rose-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
                        3107
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 truncate">{artistName}</p>

                    {audioError && (
                      <button
                        type="button"
                        onClick={togglePlay}
                        className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-300 underline font-semibold"
                      >
                        <FaPlay size={10} /> Phát nhạc (Thử lại)
                      </button>
                    )}
                  </div>

                  {/* Play / Pause Toggle Button */}
                  <button
                    type="button"
                    onClick={togglePlay}
                    aria-label={isPlaying ? 'Tạm dừng nhạc' : 'Phát nhạc'}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#F45C7A] to-[#A96FD4] text-white shadow hover:scale-105 active:scale-95 transition-transform"
                  >
                    {isPlaying ? <FaPause size={14} /> : <FaPlay size={14} className="ml-0.5" />}
                  </button>
                </div>

                {/* Progress Bar & Time */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-700 accent-[#F45C7A]"
                    aria-label="Thanh thời gian bài hát"
                  />
                </div>

                {/* Volume Control */}
                <div className="mt-2.5 flex items-center justify-end gap-2 text-xs text-slate-400">
                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
                    className="text-slate-300 hover:text-white"
                  >
                    {isMuted || volume === 0 ? <FaVolumeMute size={14} /> : <FaVolumeUp size={14} />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="h-1 w-20 cursor-pointer appearance-none rounded-lg bg-slate-700 accent-[#4D8FE8]"
                    aria-label="Thanh điều chỉnh âm lượng"
                  />
                </div>
              </motion.div>

              {/* Close Button */}
              <button
                type="button"
                onClick={handleCloseModal}
                className="mt-4 w-full rounded-2xl border border-slate-300 bg-white py-3 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-[#172033]"
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
