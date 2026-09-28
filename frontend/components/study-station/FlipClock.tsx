'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  FiPlay,
  FiPause,
  FiRotateCcw,
  FiSettings,
  FiCheck,
  FiVolume2,
  FiVolumeX,
  FiPlus,
  FiMinus,
  FiMaximize2,
  FiMinimize2,
  FiX,
  FiZap,
} from 'react-icons/fi';
import { FaQuoteLeft } from 'react-icons/fa';

interface FlipClockProps {
  onSessionComplete?: (mode: 'work' | 'break') => void;
  className?: string;
  isCompact?: boolean;
  studyGoal?: string;
  onEditGoal?: () => void;
  quote?: { text: string; author: string };
  onNextQuote?: () => void;
}

// ─── MECHANICAL FLIP DIGIT COMPONENT ──────────────────────────────────────────
function FlipDigit({ digit, size = 'normal' }: { digit: string; size?: 'normal' | 'large' | 'compact' }) {
  const [currentDigit, setCurrentDigit] = useState(digit);
  const [prevDigit, setPrevDigit] = useState(digit);
  const [isFlipping, setIsFlipping] = useState(false);

  useEffect(() => {
    if (digit !== currentDigit) {
      setPrevDigit(currentDigit);
      setIsFlipping(true);
      const timer = setTimeout(() => {
        setCurrentDigit(digit);
        setIsFlipping(false);
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [digit, currentDigit]);

  const containerClasses =
    size === 'large'
      ? 'relative flex flex-col h-28 w-18 sm:h-44 sm:w-28 md:h-56 md:w-36 lg:h-64 lg:w-44 select-none font-mono font-black text-4xl sm:text-7xl md:text-8xl lg:text-9xl perspective-500 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] rounded-2xl sm:rounded-3xl overflow-hidden ring-2 ring-white/20 bg-slate-900'
      : size === 'compact'
      ? 'relative flex flex-col h-11 w-7.5 sm:h-13 sm:w-9 select-none font-mono font-black text-lg sm:text-2xl perspective-500 shadow-md rounded-lg overflow-hidden ring-1 ring-white/15 bg-slate-900'
      : 'relative flex flex-col h-18 w-12 sm:h-24 sm:w-16 md:h-28 md:w-20 select-none font-mono font-black text-3xl sm:text-5xl md:text-6xl perspective-500 shadow-2xl rounded-2xl overflow-hidden ring-1 ring-white/20 bg-slate-900';

  const notchClasses =
    size === 'large'
      ? 'h-3 w-1.5 sm:h-4 sm:w-2 rounded-r-full bg-slate-950 z-30 ring-1 ring-white/20'
      : size === 'compact'
      ? 'h-1.5 w-0.5 rounded-r-full bg-slate-950 z-30 ring-1 ring-white/15'
      : 'h-2.5 w-1 rounded-r-full bg-slate-950 z-30 ring-1 ring-white/20';

  const notchRightClasses =
    size === 'large'
      ? 'h-3 w-1.5 sm:h-4 sm:w-2 rounded-l-full bg-slate-950 z-30 ring-1 ring-white/20'
      : size === 'compact'
      ? 'h-1.5 w-0.5 rounded-l-full bg-slate-950 z-30 ring-1 ring-white/15'
      : 'h-2.5 w-1 rounded-l-full bg-slate-950 z-30 ring-1 ring-white/20';

  return (
    <div className="relative inline-flex flex-col items-center justify-center">
      {/* 3D Perspective Card Container */}
      <div className={containerClasses}>
        {/* Notch pins on left and right for authentic mechanical look */}
        <div className={`absolute left-0 top-1/2 -translate-y-1/2 ${notchClasses}`} />
        <div className={`absolute right-0 top-1/2 -translate-y-1/2 ${notchRightClasses}`} />

        {/* TOP HALF (STATIC BACKGROUND) */}
        <div className="relative h-1/2 w-full overflow-hidden bg-gradient-to-b from-slate-800 to-slate-850 flex items-end justify-center border-b border-black/80">
          <span className="translate-y-[50%] text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)]">
            {currentDigit}
          </span>
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
        </div>

        {/* BOTTOM HALF (STATIC BACKGROUND) */}
        <div className="relative h-1/2 w-full overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950 flex items-start justify-center">
          <span className="-translate-y-[50%] text-slate-100 drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)]">
            {currentDigit}
          </span>
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
        </div>

        {/* FLIPPING LEAF (TOP TO BOTTOM) */}
        {isFlipping && (
          <div
            className="absolute inset-x-0 top-0 h-1/2 overflow-hidden bg-gradient-to-b from-slate-800 to-slate-850 flex items-end justify-center origin-bottom z-20 animate-flip-top border-b border-black/80 shadow-md"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <span className="translate-y-[50%] text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)]">
              {prevDigit}
            </span>
          </div>
        )}

        {isFlipping && (
          <div
            className="absolute inset-x-0 bottom-0 h-1/2 overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950 flex items-start justify-center origin-top z-20 animate-flip-bottom"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <span className="-translate-y-[50%] text-slate-100 drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)]">
              {currentDigit}
            </span>
          </div>
        )}

        {/* Horizontal center crease line */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-[0.5px] h-[1.5px] bg-black/90 z-25 shadow-sm" />
      </div>
    </div>
  );
}

// ─── MAIN FLIP CLOCK COMPONENT ────────────────────────────────────────────────
export default function FlipClock({
  onSessionComplete,
  className = '',
  isCompact = false,
  studyGoal,
  onEditGoal,
  quote,
  onNextQuote,
}: FlipClockProps) {
  // Preset options
  const PRESET_DURATIONS = [
    { label: '15p', minutes: 15, tag: 'Khởi động' },
    { label: '25p', minutes: 25, tag: 'Chuẩn Pomodoro' },
    { label: '45p', minutes: 45, tag: '1 tiết học' },
    { label: '60p', minutes: 60, tag: 'Tập trung sâu' },
    { label: '90p', minutes: 90, tag: 'Thực chiến đề' },
  ];

  const PRESET_BREAKS = [
    { label: '5p', minutes: 5 },
    { label: '10p', minutes: 10 },
    { label: '15p', minutes: 15 },
  ];

  // Custom durations state
  const [workMinutes, setWorkMinutes] = useState<number>(25);
  const [breakMinutes, setBreakMinutes] = useState<number>(5);
  const [customInputMin, setCustomInputMin] = useState<string>('25');

  // Timer runtime state
  const [mode, setMode] = useState<'work' | 'break'>('work');
  const [timeLeft, setTimeLeft] = useState<number>(workMinutes * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [completedSessions, setCompletedSessions] = useState<number>(0);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Fullscreen Desk Clock state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Audio Context for alarm sound
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      // Play chime chord
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.1);
        gain.gain.setValueAtTime(0.15, ctx.currentTime + index * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + index * 0.1 + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + index * 0.1);
        osc.stop(ctx.currentTime + index * 0.1 + 0.6);
      });
    } catch {}
  };

  // Timer interval effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      playBeep();
      if (mode === 'work') {
        setCompletedSessions((prev) => prev + 1);
        setMode('break');
        setTimeLeft(breakMinutes * 60);
        onSessionComplete?.('work');
      } else {
        setMode('work');
        setTimeLeft(workMinutes * 60);
        onSessionComplete?.('break');
      }
      setIsRunning(false);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, timeLeft, mode, breakMinutes, workMinutes, onSessionComplete, soundEnabled]);

  // Fullscreen toggling logic
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      setIsFullscreen(true);
      try {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch {}
    } else {
      setIsFullscreen(false);
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      } catch {}
    }
  };

  // Sync with browser native fullscreen exit
  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [isFullscreen]);

  // Keyboard shortcut listeners: Space (Start/Pause), Escape (Exit fullscreen), F (Toggle fullscreen)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === ' ' && isFullscreen) {
        e.preventDefault();
        setIsRunning((prev) => !prev);
      } else if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      } else if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Digits splitting
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const m1 = Math.floor(minutes / 10).toString();
  const m2 = (minutes % 10).toString();
  const s1 = Math.floor(seconds / 10).toString();
  const s2 = (seconds % 10).toString();

  // Handlers
  const handleSelectWorkMinutes = (mins: number) => {
    setWorkMinutes(mins);
    setCustomInputMin(mins.toString());
    if (mode === 'work') {
      setIsRunning(false);
      setTimeLeft(mins * 60);
    }
  };

  const handleSelectBreakMinutes = (mins: number) => {
    setBreakMinutes(mins);
    if (mode === 'break') {
      setIsRunning(false);
      setTimeLeft(mins * 60);
    }
  };

  const handleApplyCustomMin = () => {
    const parsed = parseInt(customInputMin, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 300) {
      handleSelectWorkMinutes(parsed);
      setShowSettings(false);
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(mode === 'work' ? workMinutes * 60 : breakMinutes * 60);
  };

  const adjustMinutes = (delta: number) => {
    const newMins = Math.max(1, Math.min(180, workMinutes + delta));
    handleSelectWorkMinutes(newMins);
  };

  return (
    <>
      {/* ─── STANDARD EMBEDDED FLIP CLOCK CARD ─────────────────────────────── */}
      <div
        className={`rounded-3xl border border-white/15 bg-gradient-to-b from-slate-900/90 to-slate-950/90 ${
          isCompact ? 'p-3.5 sm:p-4' : 'p-5'
        } shadow-2xl backdrop-blur-md transition-all ${className}`}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="relative flex h-2.5 w-2.5 sm:h-3 sm:w-3">
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                  isRunning ? (mode === 'work' ? 'bg-rose-400' : 'bg-emerald-400') : 'bg-slate-400'
                }`}
              />
              <span
                className={`relative inline-flex h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full ${
                  isRunning ? (mode === 'work' ? 'bg-rose-500' : 'bg-emerald-500') : 'bg-slate-500'
                }`}
              />
            </span>
            <h3 className={`${isCompact ? 'text-xs' : 'text-sm'} font-extrabold text-white tracking-wide truncate`}>
              Đồng Hồ Lật Pomodoro
            </h3>
          </div>

          {/* Mode pill, Settings button & Fullscreen button */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                const nextMode = mode === 'work' ? 'break' : 'work';
                setMode(nextMode);
                setIsRunning(false);
                setTimeLeft(nextMode === 'work' ? workMinutes * 60 : breakMinutes * 60);
              }}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-black transition-all ${
                mode === 'work'
                  ? 'bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/40 hover:bg-rose-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40 hover:bg-emerald-500/30'
              }`}
            >
              {mode === 'work' ? '🎯 Tập Trung' : '☕ Giải Lao'}
            </button>

            <button
              type="button"
              onClick={() => setShowSettings((prev) => !prev)}
              className={`rounded-xl p-1.5 text-xs transition-colors ${
                showSettings
                  ? 'bg-violet-600 text-white'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
              title="Tùy chỉnh thời gian học"
            >
              <FiSettings className="text-xs sm:text-sm" />
            </button>

            {/* FULLSCREEN MAXIMIZE BUTTON */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="rounded-xl p-1.5 text-xs transition-all bg-white/5 text-slate-300 hover:bg-violet-600 hover:text-white active:scale-95"
              title="Phóng to toàn màn hình bàn học (phím F)"
            >
              <FiMaximize2 className="text-xs sm:text-sm" />
            </button>
          </div>
        </div>

        {/* Mechanical Flip Clock Display */}
        <div className={`${isCompact ? 'my-3' : 'my-5'} flex flex-col items-center justify-center`}>
          <div className="flex items-center gap-1.5 sm:gap-3 md:gap-4">
            {/* Minutes Digits */}
            <div className="flex gap-1 sm:gap-1.5">
              <FlipDigit digit={m1} size={isCompact ? 'compact' : 'normal'} />
              <FlipDigit digit={m2} size={isCompact ? 'compact' : 'normal'} />
            </div>

            {/* Colon Separator */}
            <div className={`flex flex-col ${isCompact ? 'gap-1.5 py-1' : 'gap-2 sm:gap-3 py-2'}`}>
              <span
                className={`${isCompact ? 'h-1.5 w-1.5' : 'h-2.5 w-2.5 sm:h-3.5 sm:w-3.5'} rounded-full bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.8)] ${
                  isRunning ? 'animate-pulse' : ''
                }`}
              />
              <span
                className={`${isCompact ? 'h-1.5 w-1.5' : 'h-2.5 w-2.5 sm:h-3.5 sm:w-3.5'} rounded-full bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.8)] ${
                  isRunning ? 'animate-pulse' : ''
                }`}
              />
            </div>

            {/* Seconds Digits */}
            <div className="flex gap-1 sm:gap-1.5">
              <FlipDigit digit={s1} size={isCompact ? 'compact' : 'normal'} />
              <FlipDigit digit={s2} size={isCompact ? 'compact' : 'normal'} />
            </div>
          </div>

          <div className={`mt-1.5 flex items-center justify-between w-full ${isCompact ? 'max-w-[190px] text-[10px]' : 'max-w-[240px] sm:max-w-[310px] text-[11px]'} px-2 font-black uppercase tracking-widest text-slate-400`}>
            <span>Phút</span>
            <span>Giây</span>
          </div>
        </div>

        {/* Quick Presets */}
        <div className={isCompact ? 'mb-2.5' : 'mb-4'}>
          <div className="flex items-center justify-between mb-1 px-0.5">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Thời lượng:
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => adjustMinutes(-5)}
                className="rounded-lg bg-white/5 p-0.5 text-slate-300 hover:bg-white/10 text-xs"
                title="Giảm 5 phút"
              >
                <FiMinus />
              </button>
              <span className="text-xs font-black text-violet-400 px-1">{workMinutes}p</span>
              <button
                type="button"
                onClick={() => adjustMinutes(5)}
                className="rounded-lg bg-white/5 p-0.5 text-slate-300 hover:bg-white/10 text-xs"
                title="Tăng 5 phút"
              >
                <FiPlus />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-1">
            {PRESET_DURATIONS.map((preset) => {
              const active = workMinutes === preset.minutes;
              return (
                <button
                  key={preset.minutes}
                  type="button"
                  onClick={() => handleSelectWorkMinutes(preset.minutes)}
                  className={`rounded-xl ${isCompact ? 'py-1 text-[10px]' : 'py-1.5 text-xs'} font-black transition-all ${
                    active
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-600/30 ring-1 ring-violet-400'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                  title={preset.tag}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Settings Panel */}
        {showSettings && (
          <div className="mb-4 rounded-2xl border border-violet-500/30 bg-violet-950/30 p-3.5 space-y-3 animate-in fade-in">
            <div>
              <label className="block text-xs font-bold text-violet-200">
                Nhập số phút tập trung bất kỳ (1 – 180 phút):
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={customInputMin}
                  onChange={(e) => setCustomInputMin(e.target.value)}
                  className="w-24 rounded-xl border border-white/20 bg-slate-900 px-3 py-1.5 text-sm font-bold text-white focus:border-violet-500 focus:outline-none"
                />
                <span className="text-xs text-slate-300">phút</span>
                <button
                  type="button"
                  onClick={handleApplyCustomMin}
                  className="flex items-center gap-1 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-500 ml-auto"
                >
                  <FiCheck /> Áp dụng
                </button>
              </div>
            </div>

            <div className="border-t border-white/10 pt-2.5">
              <label className="block text-xs font-bold text-violet-200 mb-1.5">
                Thời gian giải lao:
              </label>
              <div className="flex gap-2">
                {PRESET_BREAKS.map((brk) => (
                  <button
                    key={brk.minutes}
                    type="button"
                    onClick={() => handleSelectBreakMinutes(brk.minutes)}
                    className={`flex-1 rounded-xl py-1 text-xs font-bold transition-all ${
                      breakMinutes === brk.minutes
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {brk.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/10 pt-2 text-xs text-slate-300">
              <span>Chuông báo khi hết giờ:</span>
              <button
                type="button"
                onClick={() => setSoundEnabled((prev) => !prev)}
                className="flex items-center gap-1 text-violet-300 hover:text-white"
              >
                {soundEnabled ? <FiVolume2 className="text-emerald-400" /> : <FiVolumeX className="text-rose-400" />}
                <span>{soundEnabled ? 'Bật' : 'Tắt'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className={`flex items-center justify-center ${isCompact ? 'gap-2' : 'gap-3'}`}>
          <button
            type="button"
            onClick={() => setIsRunning((prev) => !prev)}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl ${
              isCompact ? 'py-2 text-xs' : 'py-3 text-xs'
            } font-black uppercase tracking-wider text-white shadow-xl transition-all active:scale-95 ${
              isRunning
                ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
                : 'bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:brightness-110 shadow-violet-600/30'
            }`}
          >
            {isRunning ? <FiPause className={isCompact ? 'text-sm' : 'text-base'} /> : <FiPlay className={isCompact ? 'text-sm' : 'text-base'} />}
            <span>{isRunning ? 'Tạm Dừng' : 'Bắt Đầu'}</span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            className={`rounded-xl border border-white/10 bg-white/5 ${
              isCompact ? 'p-2' : 'p-3'
            } text-slate-300 transition-all hover:bg-white/10 hover:text-white active:scale-95`}
            title="Đặt lại đồng hồ"
          >
            <FiRotateCcw className={isCompact ? 'text-sm' : 'text-base'} />
          </button>
        </div>

        {/* Integrated Goal & Quote Bar */}
        {(studyGoal !== undefined || quote !== undefined) && (
          <div className="mt-4 pt-3.5 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
            {/* Mục tiêu hôm nay */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-3 sm:p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                    <FiZap className="text-xs" />
                    <span className="text-white">Mục Tiêu Hôm Nay</span>
                  </div>
                  {onEditGoal && (
                    <button
                      type="button"
                      onClick={onEditGoal}
                      className="text-[11px] font-bold text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      {studyGoal ? 'Sửa ↗' : '+ Đặt mục tiêu'}
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-300 italic line-clamp-2 leading-relaxed">
                  {studyGoal ? `"${studyGoal}"` : 'Viết ra cam kết buổi học để duy trì kỷ luật và không xao nhãng!'}
                </p>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 border-t border-white/5 pt-1.5">
                <span className="text-slate-400">🎯 Tự giác kỷ luật</span>
                {onEditGoal && (
                  <button type="button" onClick={onEditGoal} className="text-violet-400 hover:underline">
                    Mở rộng ↗
                  </button>
                )}
              </div>
            </div>

            {/* Châm ngôn & thành ngữ */}
            {quote && (
              <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/40 via-slate-900 to-indigo-950/40 p-3 sm:p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-violet-400">
                      Châm Ngôn & Thành Ngữ
                    </span>
                    {onNextQuote && (
                      <button
                        type="button"
                        onClick={onNextQuote}
                        className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                        title="Đổi câu khác"
                      >
                        <FiRotateCcw className="text-[10px]" />
                        <span>Đổi câu</span>
                      </button>
                    )}
                  </div>
                  <blockquote className="text-xs font-semibold italic text-slate-200 line-clamp-2 leading-relaxed">
                    "{quote.text}"
                  </blockquote>
                </div>
                <p className="mt-2 text-right text-[11px] font-bold text-violet-400 border-t border-white/5 pt-1.5">
                  — {quote.author}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer info */}
        <div className={`${isCompact ? 'mt-2.5 pt-2 text-[10px]' : 'mt-4 pt-3 text-xs'} flex items-center justify-between border-t border-white/10 text-slate-400`}>
          <span>Đã hoàn thành hôm nay:</span>
          <span className="font-extrabold text-violet-400">{completedSessions} chu kỳ</span>
        </div>
      </div>

      {/* ─── FULLSCREEN IMMERSIVE DESK CLOCK OVERLAY ───────────────────────── */}
      {isFullscreen && (
        <div className="fixed inset-0 z-[250] bg-slate-950/98 backdrop-blur-2xl flex flex-col justify-between p-6 sm:p-12 select-none overflow-hidden animate-in fade-in duration-200">
          {/* Top Bar in Fullscreen */}
          <div className="flex items-center justify-between w-full max-w-7xl mx-auto">
            <div className="flex items-center gap-3">
              <span
                className={`rounded-full px-4 py-1.5 text-xs sm:text-sm font-black uppercase tracking-wider shadow-lg ${
                  mode === 'work'
                    ? 'bg-rose-500/20 text-rose-400 ring-2 ring-rose-500/40 shadow-rose-500/20'
                    : 'bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500/40 shadow-emerald-500/20'
                }`}
              >
                {mode === 'work' ? '🎯 Đang Tập Trung' : '☕ Đang Giải Lao'}
              </span>

              <span className="hidden sm:inline text-xs font-bold text-slate-400">
                Chu kỳ hoàn thành: <strong className="text-violet-400">{completedSessions}</strong>
              </span>
            </div>

            {/* Quick Actions top-right */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSoundEnabled((prev) => !prev)}
                className="rounded-xl border border-white/15 bg-white/5 p-2.5 text-slate-300 hover:bg-white/10 hover:text-white"
                title={soundEnabled ? 'Tắt âm báo' : 'Bật âm báo'}
              >
                {soundEnabled ? <FiVolume2 className="text-emerald-400 text-lg" /> : <FiVolumeX className="text-rose-400 text-lg" />}
              </button>

              <button
                type="button"
                onClick={toggleFullscreen}
                className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-600 transition-all active:scale-95 shadow-lg"
                title="Thu nhỏ lại (phím ESC)"
              >
                <FiMinimize2 className="text-base" />
                <span className="hidden sm:inline">Thu nhỏ (ESC)</span>
              </button>
            </div>
          </div>

          {/* Giant Mechanical Flip Clock in Center */}
          <div className="my-auto flex flex-col items-center justify-center py-6">
            <div className="flex items-center gap-3 sm:gap-6 md:gap-8 lg:gap-10">
              {/* Minutes Digits */}
              <div className="flex gap-2 sm:gap-4 md:gap-5">
                <FlipDigit digit={m1} size="large" />
                <FlipDigit digit={m2} size="large" />
              </div>

              {/* Glowing Colon Separator */}
              <div className="flex flex-col gap-4 sm:gap-8 md:gap-10 py-4">
                <span
                  className={`h-4 w-4 sm:h-6 sm:w-6 md:h-8 md:w-8 rounded-full bg-violet-400 shadow-[0_0_25px_rgba(167,139,250,1)] ${
                    isRunning ? 'animate-pulse' : ''
                  }`}
                />
                <span
                  className={`h-4 w-4 sm:h-6 sm:w-6 md:h-8 md:w-8 rounded-full bg-violet-400 shadow-[0_0_25px_rgba(167,139,250,1)] ${
                    isRunning ? 'animate-pulse' : ''
                  }`}
                />
              </div>

              {/* Seconds Digits */}
              <div className="flex gap-2 sm:gap-4 md:gap-5">
                <FlipDigit digit={s1} size="large" />
                <FlipDigit digit={s2} size="large" />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between w-full max-w-[320px] sm:max-w-[560px] md:max-w-[700px] px-6 text-xs sm:text-sm font-black uppercase tracking-[0.3em] text-slate-400">
              <span>Phút</span>
              <span>Giây</span>
            </div>
          </div>

          {/* Bottom Bar in Fullscreen */}
          <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-4">
            {/* Big Action Buttons */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setIsRunning((prev) => !prev)}
                className={`flex items-center gap-3 rounded-2xl px-10 sm:px-14 py-4 text-sm sm:text-base font-black uppercase tracking-wider text-white shadow-2xl transition-all active:scale-95 ${
                  isRunning
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/40 ring-2 ring-amber-400/50'
                    : 'bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:brightness-110 shadow-violet-600/40 ring-2 ring-violet-400/50'
                }`}
              >
                {isRunning ? <FiPause className="text-xl" /> : <FiPlay className="text-xl" />}
                <span>{isRunning ? 'Tạm Dừng' : 'Bắt Đầu'}</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="rounded-2xl border border-white/20 bg-white/5 p-4 text-slate-300 hover:bg-white/10 hover:text-white transition-all active:scale-95 shadow-xl"
                title="Đặt lại đồng hồ"
              >
                <FiRotateCcw className="text-xl" />
              </button>
            </div>

            {/* Quick Presets chips in fullscreen */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {PRESET_DURATIONS.map((preset) => {
                const active = workMinutes === preset.minutes;
                return (
                  <button
                    key={preset.minutes}
                    type="button"
                    onClick={() => handleSelectWorkMinutes(preset.minutes)}
                    className={`rounded-xl px-4 py-1.5 text-xs font-black transition-all ${
                      active
                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/40 ring-1 ring-violet-400'
                        : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Inspiring hint & Keyboard Shortcuts */}
            <div className="text-center text-xs text-slate-400 flex flex-wrap items-center justify-center gap-3">
              <span>
                Phím tắt: Bấm <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-slate-200 font-mono">Space</kbd> để Bắt đầu/Dừng
              </span>
              <span>•</span>
              <span>
                Bấm <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-slate-200 font-mono">ESC</kbd> hoặc <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-slate-200 font-mono">F</kbd> để thoát
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Global CSS for mechanical flip animation */}
      <style jsx global>{`
        .perspective-500 {
          perspective: 600px;
        }
        @keyframes flipTopAnimation {
          0% {
            transform: rotateX(0deg);
          }
          100% {
            transform: rotateX(-90deg);
          }
        }
        @keyframes flipBottomAnimation {
          0% {
            transform: rotateX(90deg);
          }
          100% {
            transform: rotateX(0deg);
          }
        }
        .animate-flip-top {
          animation: flipTopAnimation 0.22s ease-in forwards;
          transform-origin: bottom center;
        }
        .animate-flip-bottom {
          animation: flipBottomAnimation 0.22s ease-out 0.22s forwards;
          transform-origin: top center;
        }
      `}</style>
    </>
  );
}
