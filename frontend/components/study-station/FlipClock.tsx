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
  FiChevronLeft,
  FiChevronRight,
  FiShuffle,
  FiEye,
} from 'react-icons/fi';
import { FaQuoteLeft } from 'react-icons/fa';

interface FlipClockProps {
  onSessionComplete?: (mode: 'work' | 'break', durationMinutes?: number) => void;
  className?: string;
  isCompact?: boolean;
  studyGoal?: string;
  onEditGoal?: () => void;
  quote?: { text: string; author: string };
  onNextQuote?: () => void;
}

const POMODORO_STORAGE_KEY = 'moly:pomodoro_daily_stats';

interface DailyPomodoroStats {
  date: string;
  completedSessions: number;
  totalMinutes: number;
}

interface QuickFlashcard {
  id: number;
  subject: 'Toán CSCA' | 'Lý & Hóa CSCA' | 'Tiếng Trung Học Thuật CSCA';
  topic: string;
  front: string;
  back: string;
}

export const CSCA_QUICK_CARDS: QuickFlashcard[] = [
  {
    id: 1,
    subject: 'Toán CSCA',
    topic: 'Đạo hàm & Tiếp tuyến',
    front: 'Phương trình tiếp tuyến của đồ thị y = f(x) tại M(x₀, y₀) và quy tắc đạo hàm hàm hợp [u(v(x))]’?',
    back: '• Tiếp tuyến: y - f(x₀) = f’(x₀)(x - x₀)\n• Hàm hợp: [u(v(x))]’ = u’(v(x)) · v’(x)\n• Điểm cực trị: f’(x₀) = 0 và f’(x) đổi dấu khi qua x₀.',
  },
  {
    id: 2,
    subject: 'Toán CSCA',
    topic: 'Cấp số cộng / Cấp số nhân',
    front: 'Công thức số hạng tổng quát uₙ và tổng Sₙ của Cấp số cộng (d) & Cấp số nhân (q ≠ 1)?',
    back: '• CSC: uₙ = u₁ + (n - 1)d  |  Sₙ = n(u₁ + uₙ)/2 = n·u₁ + n(n - 1)d/2\n• CSN: uₙ = u₁ · qⁿ⁻¹  |  Sₙ = u₁(1 - qⁿ) / (1 - q)',
  },
  {
    id: 3,
    subject: 'Toán CSCA',
    topic: 'Bất đẳng thức Cauchy (AM-GM)',
    front: 'Bất đẳng thức AM-GM (Cauchy) cho a, b > 0 và quy tắc tìm GTLN - GTNN nhanh?',
    back: '• a + b ≥ 2√(ab)  ⇔  (a + b)/2 ≥ √(ab) ≥ 2ab/(a + b)\n• Tích ab = P không đổi ⇒ (a + b)min = 2√P; Tổng a + b = S không đổi ⇒ (ab)max = S²/4.\n• Dấu "=" xảy ra khi và chỉ khi a = b.',
  },
  {
    id: 4,
    subject: 'Toán CSCA',
    topic: 'Tích vô hướng Vector',
    front: 'Tích vô hướng a⃗ · b⃗, điều kiện hai vector vuông góc và cos góc giữa hai vector trong Oxy?',
    back: '• a⃗ · b⃗ = |a⃗||b⃗|cos(a⃗, b⃗) = x₁x₂ + y₁y₂\n• Vuông góc: a⃗ ⊥ b⃗ ⇔ x₁x₂ + y₁y₂ = 0\n• cos θ = (x₁x₂ + y₁y₂) / [√(x₁² + y₁²) · √(x₂² + y₂²)]',
  },
  {
    id: 5,
    subject: 'Toán CSCA',
    topic: 'Xác suất cổ điển',
    front: 'Công thức cộng xác suất P(A ∪ B), xác suất có điều kiện P(A|B) và công thức Bernoulli?',
    back: '• P(A ∪ B) = P(A) + P(B) - P(A ∩ B)\n• P(A|B) = P(A ∩ B) / P(B) (Nếu A, B độc lập: P(A ∩ B) = P(A)·P(B))\n• Nhị thức Bernoulli: Pₙ(k) = Cₙᵏ · pᵏ · (1 - p)ⁿ⁻ᵏ',
  },
  {
    id: 6,
    subject: 'Lý & Hóa CSCA',
    topic: 'Định luật II Newton & Bảo toàn cơ năng',
    front: 'Định luật II Newton, Định lý động năng và Định luật bảo toàn cơ năng trong trọng trường?',
    back: '• Newton II: ∑F⃗ = m·a⃗\n• Định lý động năng: A_ngoại_lực = ΔWđ = ½mv₂² - ½mv₁²\n• Bảo toàn cơ năng (chỉ lực thế): W = ½mv² + mgh = const',
  },
  {
    id: 7,
    subject: 'Lý & Hóa CSCA',
    topic: 'Định luật Ohm toàn mạch',
    front: 'Định luật Ohm cho toàn mạch nguồn (E, r) nối với tải R_N và điều kiện công suất mạch ngoài cực đại?',
    back: '• Cường độ dòng điện: I = E / (R_N + r)  |  Hiệu điện thế ngoài: U_N = E - I·r\n• Công suất mạch ngoài cực đại khi R_N = r ⇒ P_max = E² / (4r)',
  },
  {
    id: 8,
    subject: 'Lý & Hóa CSCA',
    topic: 'Phương trình khí lý tưởng PV = nRT',
    front: 'Phương trình trạng thái khí lý tưởng PV = nRT và liên hệ với khối lượng riêng ρ, khối lượng mol M?',
    back: '• P·V = n·R·T = (m/M)·R·T  ⇒  (P₁V₁)/T₁ = (P₂V₂)/T₂\n• Khối lượng riêng: ρ = m/V = (P·M)/(R·T)\n• Lưu ý: Luôn đổi nhiệt độ sang Kelvin: T(K) = t(°C) + 273.15',
  },
  {
    id: 9,
    subject: 'Lý & Hóa CSCA',
    topic: 'Cân bằng hóa học Le Chatelier',
    front: 'Khi tăng nhiệt độ (T ↑) hoặc tăng áp suất (P ↑), cân bằng hóa học dịch chuyển theo chiều nào?',
    back: '• Tăng T (T ↑): Dịch chuyển theo chiều phản ứng THU NHIỆT (ΔH > 0)\n• Tăng P (P ↑): Dịch chuyển theo chiều làm GIẢM số mol khí (Δn_khí < 0)\n• Chất xúc tác chỉ tăng tốc độ đạt cân bằng, KHÔNG làm dịch chuyển cân bằng!',
  },
  {
    id: 10,
    subject: 'Tiếng Trung Học Thuật CSCA',
    topic: 'Từ vựng lập luận: 推导 • 假设',
    front: 'Giải nghĩa bộ từ khóa lập luận đề thi CSCA: 【推导 (tuīdǎo) - Suy đạo/Chứng minh】 & 【假设 (jiǎshè) - Giả thiết】?',
    back: '• 推导 (tuīdǎo): Suy đạo / Biến đổi suy ra / Chứng minh công thức\n• 假设 (jiǎshè): Giả thiết / Giả sử (Suppose / Assume)\n• 已知 (yǐzhī): Đã biết (Cho trước dữ kiện đề bài)',
  },
  {
    id: 11,
    subject: 'Tiếng Trung Học Thuật CSCA',
    topic: 'Từ vựng Toán học: 恒成立',
    front: 'Giải nghĩa thuật ngữ hay gặp trong bài toán hàm số & bất đẳng thức CSCA: 【恒成立 (héng chénglì)】?',
    back: '• 恒成立 (héng chénglì): Luôn đúng / Nghiệm đúng với mọi giá trị trên miền xác định\n• Ví dụ: 若 f(x) ≥ a 在 R 上恒成立 (Nếu f(x) ≥ a luôn đúng trên ℝ) ⇒ a ≤ f(x)_min.',
  },
  {
    id: 12,
    subject: 'Tiếng Trung Học Thuật CSCA',
    topic: 'Logic: 充分必要条件',
    front: 'Phân biệt bộ 3 điều kiện logic trọng tâm CSCA: 【充分条件】, 【必要条件】, 【充分必要条件】?',
    back: '• 充分不必要条件: Điều kiện đủ nhưng không cần (A ⇒ B nhưng B ⇏ A)\n• 必要不充分条件: Điều kiện cần nhưng không đủ (B ⇒ A nhưng A ⇏ B)\n• 充分必要条件 (充要条件): Điều kiện cần và đủ (A ⇔ B)',
  },
];

function getTodayDateString(): string {
  return new Date().toLocaleDateString('en-CA');
}

function getFocusRankBadge(todayMinutes: number): { label: string; badgeClass: string } {
  if (todayMinutes >= 120) {
    return {
      label: '👑 Chiến thần CSCA',
      badgeClass: 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40',
    };
  }
  if (todayMinutes >= 60) {
    return {
      label: '⚡ Cao thủ Kỷ luật',
      badgeClass: 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40',
    };
  }
  if (todayMinutes >= 25) {
    return {
      label: '🔥 Chiến binh Tập trung',
      badgeClass: 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40',
    };
  }
  return {
    label: '🌱 Khởi động',
    badgeClass: 'bg-slate-500/20 text-slate-300 ring-1 ring-slate-500/30',
  };
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
  const [todayMinutes, setTodayMinutes] = useState<number>(0);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Break-time CSCA Quick Flashcards state
  const [showQuickCards, setShowQuickCards] = useState<boolean>(false);
  const [quickCardIndex, setQuickCardIndex] = useState<number>(0);
  const [isCardRevealed, setIsCardRevealed] = useState<boolean>(false);

  // Fullscreen Desk Clock state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Audio Context for alarm sound
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Hydrate daily Pomodoro stats from localStorage on mount
  useEffect(() => {
    try {
      const today = getTodayDateString();
      const raw = localStorage.getItem(POMODORO_STORAGE_KEY);
      if (raw) {
        const parsed: DailyPomodoroStats = JSON.parse(raw);
        if (parsed && parsed.date === today) {
          setCompletedSessions(Number(parsed.completedSessions) || 0);
          setTodayMinutes(Number(parsed.totalMinutes) || 0);
        } else {
          const fresh: DailyPomodoroStats = {
            date: today,
            completedSessions: 0,
            totalMinutes: 0,
          };
          localStorage.setItem(POMODORO_STORAGE_KEY, JSON.stringify(fresh));
        }
      }
    } catch {}
  }, []);

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
        const nextSessions = completedSessions + 1;
        const nextMinutes = todayMinutes + workMinutes;
        setCompletedSessions(nextSessions);
        setTodayMinutes(nextMinutes);
        try {
          const stats: DailyPomodoroStats = {
            date: getTodayDateString(),
            completedSessions: nextSessions,
            totalMinutes: nextMinutes,
          };
          localStorage.setItem(POMODORO_STORAGE_KEY, JSON.stringify(stats));
        } catch {}
        setMode('break');
        setTimeLeft(breakMinutes * 60);
        setShowQuickCards(true);
        setIsCardRevealed(false);
        onSessionComplete?.('work', workMinutes);
      } else {
        setMode('work');
        setTimeLeft(workMinutes * 60);
        onSessionComplete?.('break', breakMinutes);
      }
      setIsRunning(false);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [
    isRunning,
    timeLeft,
    mode,
    breakMinutes,
    workMinutes,
    completedSessions,
    todayMinutes,
    onSessionComplete,
    soundEnabled,
  ]);

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

  // Flashcard navigation handlers
  const handlePrevCard = () => {
    setIsCardRevealed(false);
    setQuickCardIndex((prev) => (prev - 1 + CSCA_QUICK_CARDS.length) % CSCA_QUICK_CARDS.length);
  };

  const handleNextCard = () => {
    setIsCardRevealed(false);
    setQuickCardIndex((prev) => (prev + 1) % CSCA_QUICK_CARDS.length);
  };

  const handleRandomCard = () => {
    setIsCardRevealed(false);
    if (CSCA_QUICK_CARDS.length <= 1) return;
    let nextIdx = quickCardIndex;
    while (nextIdx === quickCardIndex) {
      nextIdx = Math.floor(Math.random() * CSCA_QUICK_CARDS.length);
    }
    setQuickCardIndex(nextIdx);
  };

  const currentCard = CSCA_QUICK_CARDS[quickCardIndex] || CSCA_QUICK_CARDS[0];
  const rankBadge = getFocusRankBadge(todayMinutes);

  const getSubjectBadgeStyle = (subject: QuickFlashcard['subject']) => {
    switch (subject) {
      case 'Toán CSCA':
        return 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40';
      case 'Lý & Hóa CSCA':
        return 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40';
      case 'Tiếng Trung Học Thuật CSCA':
        return 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40';
    }
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

        {/* ─── CSCA BREAK-TIME MINI FLASHCARDS TOGGLE & CAROUSEL ─────────────── */}
        <div className="mt-3.5">
          {mode === 'break' && !showQuickCards && (
            <div className="mb-2 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-200">
              <span>☕ Đang giải lao! Tranh thủ nhẩm 1–2 công thức CSCA nhé?</span>
              <button
                type="button"
                onClick={() => setShowQuickCards(true)}
                className="ml-2 shrink-0 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-extrabold text-white hover:bg-emerald-500 transition-colors"
              >
                Mở thẻ ngay
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowQuickCards((prev) => !prev)}
            className={`w-full flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-extrabold transition-all ${
              showQuickCards
                ? 'border-amber-500/40 bg-amber-500/15 text-amber-300 shadow-sm'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-1.5 truncate">
              <span>⚡ Nhẩm nhanh Kiến thức CSCA khi giải lao</span>
            </span>
            <span className="ml-2 shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-200">
              {showQuickCards ? 'Thu gọn ▲' : `${CSCA_QUICK_CARDS.length} thẻ ▼`}
            </span>
          </button>

          {showQuickCards && (
            <div className="mt-2.5 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-slate-900 via-slate-900/95 to-indigo-950/50 p-3.5 text-left shadow-xl animate-in fade-in">
              {/* Card Header: Subject badge & counter */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${getSubjectBadgeStyle(
                      currentCard.subject
                    )}`}
                  >
                    {currentCard.subject}
                  </span>
                  <span className="text-[11px] font-bold text-slate-400 truncate">
                    • {currentCard.topic}
                  </span>
                </div>
                <span className="shrink-0 font-mono text-[11px] font-bold text-slate-400">
                  {quickCardIndex + 1}/{CSCA_QUICK_CARDS.length}
                </span>
              </div>

              {/* Front Question / Term */}
              <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-violet-400 mb-1">
                  Câu hỏi / Thuật ngữ trọng tâm:
                </p>
                <p className="text-xs sm:text-[13px] font-bold text-white leading-relaxed">
                  {currentCard.front}
                </p>
              </div>

              {/* Click-to-reveal Back Formula / Explanation */}
              <div className="mt-2">
                {isCardRevealed ? (
                  <div
                    onClick={() => setIsCardRevealed(false)}
                    className="cursor-pointer rounded-xl border border-emerald-500/30 bg-emerald-950/25 p-3 transition-all hover:border-emerald-500/50"
                    title="Bấm để ẩn đáp án"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
                        ✓ Công thức & Giải thích chuẩn CSCA:
                      </span>
                      <span className="text-[10px] text-slate-400">Bấm để ẩn</span>
                    </div>
                    <p className="whitespace-pre-line text-xs text-emerald-100 font-medium leading-relaxed">
                      {currentCard.back}
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsCardRevealed(true)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-violet-400/40 bg-violet-500/10 py-2.5 px-3 text-xs font-bold text-violet-300 hover:bg-violet-500/20 hover:text-white transition-all"
                  >
                    <FiEye className="text-sm" />
                    <span>Bấm để lật xem Công thức / Giải nghĩa</span>
                  </button>
                )}
              </div>

              {/* Carousel Controls */}
              <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={handlePrevCard}
                  className="flex items-center gap-1 rounded-xl bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <FiChevronLeft />
                  <span>Trước</span>
                </button>

                <button
                  type="button"
                  onClick={handleRandomCard}
                  className="flex items-center gap-1 rounded-xl bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-300 ring-1 ring-amber-500/30 hover:bg-amber-500/25 transition-colors"
                >
                  <FiShuffle className="text-xs" />
                  <span>Ngẫu nhiên</span>
                </button>

                <button
                  type="button"
                  onClick={handleNextCard}
                  className="flex items-center gap-1 rounded-xl bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <span>Tiếp theo</span>
                  <FiChevronRight />
                </button>
              </div>
            </div>
          )}
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

        {/* Footer info with Persistent Daily Stats & Rank Badge */}
        <div
          className={`${
            isCompact ? 'mt-2.5 pt-2 text-[10px]' : 'mt-4 pt-3 text-xs'
          } flex flex-wrap items-center justify-between gap-2 border-t border-white/10 text-slate-400`}
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            <span>Đã hoàn thành hôm nay:</span>
            <span className="font-extrabold text-violet-400">
              {completedSessions} chu kỳ ({todayMinutes} phút tập trung)
            </span>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${rankBadge.badgeClass}`}
            title="Huy hiệu kỷ luật hôm nay (tự động lưu cả khi tải lại trang)"
          >
            {rankBadge.label}
          </span>
        </div>
      </div>

      {/* ─── FULLSCREEN IMMERSIVE DESK CLOCK OVERLAY ───────────────────────── */}
      {isFullscreen && (
        <div className="fixed inset-0 z-[250] bg-slate-950/98 backdrop-blur-2xl flex flex-col justify-between p-6 sm:p-12 select-none overflow-hidden animate-in fade-in duration-200">
          {/* Top Bar in Fullscreen */}
          <div className="flex items-center justify-between w-full max-w-7xl mx-auto">
            <div className="flex items-center gap-3 flex-wrap">
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
                Hôm nay:{' '}
                <strong className="text-violet-400">
                  {completedSessions} chu kỳ ({todayMinutes} phút tập trung)
                </strong>
              </span>

              <span
                className={`hidden md:inline-flex rounded-full px-3 py-1 text-xs font-extrabold ${rankBadge.badgeClass}`}
              >
                {rankBadge.label}
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
