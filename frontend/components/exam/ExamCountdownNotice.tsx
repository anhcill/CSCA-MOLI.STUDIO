'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiBell, FiBookOpen, FiCheck, FiChevronDown, FiClock, FiX } from 'react-icons/fi';
import axios from '@/lib/utils/axios';
import { useAuthStore } from '@/lib/store/authStore';
import styles from './ExamCountdownNotice.module.css';

type ReminderFrequency = 'daily' | 'five_days';

interface LobbyExam {
  id: number;
  title: string;
  start_time?: string | null;
  end_time?: string | null;
  duration?: number | null;
  subject_name?: string | null;
  subject_code?: string | null;
}

interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

interface ExamSession {
  exams: LobbyExam[];
  startsAt: number;
  endsAt: number;
}

const NOTICE_KEY_PREFIX = 'moly:exam-countdown-notice';
const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_WINDOW_MS = 48 * 60 * 60 * 1000;
const URGENT_WINDOW_MS = DAY_MS;

const SUBJECT_META: Record<string, { icon: string; tone: string }> = {
  MATH: { icon: '📐', tone: 'bg-blue-50 text-blue-700' },
  PHYSICS: { icon: '⚛', tone: 'bg-emerald-50 text-emerald-700' },
  CHEMISTRY: { icon: '⚗', tone: 'bg-violet-50 text-violet-700' },
  CHINESE: { icon: '书', tone: 'bg-rose-50 text-rose-700' },
  CHINESE_SOC: { icon: '书', tone: 'bg-rose-50 text-rose-700' },
  CHINESE_SCI: { icon: '书', tone: 'bg-rose-50 text-rose-700' },
};

function getVietnamDayKey(timestamp = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function countdownParts(target: number, now: number): CountdownParts {
  const totalSeconds = Math.max(0, Math.floor((target - now) / 1000));
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function formatInTimeZone(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('vi-VN', options).format(new Date(value));
}

function shouldShowNotice(frequency: ReminderFrequency, lastShownAt: number, targetAt: number, now: number) {
  if (!Number.isFinite(lastShownAt) || lastShownAt <= 0) return true;
  if (getVietnamDayKey(lastShownAt) === getVietnamDayKey(now)) return false;

  const timeUntilExam = targetAt - now;
  if (timeUntilExam <= URGENT_WINDOW_MS) return true;
  if (frequency === 'daily') return true;
  return now - lastShownAt >= 5 * DAY_MS;
}

function selectNextExamSession(lobby: { live?: LobbyExam[]; upcoming?: LobbyExam[] }, now: number): ExamSession | null {
  const unique = new Map<number, LobbyExam>();
  [...(lobby.live || []), ...(lobby.upcoming || [])].forEach((exam) => unique.set(exam.id, exam));

  const scheduled = [...unique.values()]
    .filter((exam) => {
      const startsAt = exam.start_time ? new Date(exam.start_time).getTime() : NaN;
      const endsAt = exam.end_time ? new Date(exam.end_time).getTime() : NaN;
      return Number.isFinite(startsAt) && Number.isFinite(endsAt) && endsAt > now;
    })
    .sort((a, b) => new Date(a.start_time || 0).getTime() - new Date(b.start_time || 0).getTime());

  if (scheduled.length === 0) return null;

  const startsAt = new Date(scheduled[0].start_time as string).getTime();
  const exams = scheduled.filter((exam) => (
    new Date(exam.start_time as string).getTime() <= startsAt + SESSION_WINDOW_MS
  ));
  const endsAt = Math.max(...exams.map((exam) => new Date(exam.end_time as string).getTime()));

  return { exams, startsAt, endsAt };
}

function FlipUnit({ value, label, emphasis = false }: { value: number; label: string; emphasis?: boolean }) {
  const displayed = String(value).padStart(2, '0');
  return (
    <div className="min-w-0 text-center">
      <div className={`${styles.flipCard} ${emphasis ? styles.dayCard : ''} px-2 py-3 sm:px-4 sm:py-4`}>
        <span key={displayed} className={`${styles.flipValue} relative z-[3] text-4xl font-black leading-none text-[#fff1d6] sm:text-6xl`}>
          {displayed}
        </span>
      </div>
      <span className={`mt-2 block text-[10px] font-black tracking-[0.14em] sm:text-xs ${emphasis ? 'text-[#b9231a]' : 'text-[#5e5147]'}`}>
        {label}
      </span>
    </div>
  );
}
export default function ExamCountdownNotice() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [exams, setExams] = useState<LobbyExam[]>([]);
  const [targetAt, setTargetAt] = useState<number | null>(null);
  const [sessionEndsAt, setSessionEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(false);
  const [frequency, setFrequency] = useState<ReminderFrequency>('daily');
  const [frequencyMenuOpen, setFrequencyMenuOpen] = useState(false);

  const storageBase = `${NOTICE_KEY_PREFIX}:${user?.id || 'guest'}`;
  const frequencyKey = `${storageBase}:frequency`;
  const lastShownKey = `${storageBase}:last-shown-at`;

  const closeNotice = useCallback(() => {
    setFrequencyMenuOpen(false);
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    let cancelled = false;
    let openTimer: number | undefined;
    let retryCount = 0;

    const openWhenAvailable = () => {
      if (cancelled) return;
      const anotherDialog = document.querySelector('[role="dialog"][aria-modal="true"]');
      if (anotherDialog && retryCount < 8) {
        retryCount += 1;
        openTimer = window.setTimeout(openWhenAvailable, 1500);
        return;
      }
      localStorage.setItem(lastShownKey, String(Date.now()));
      setOpen(true);
    };

    const load = async () => {
      try {
        const storedFrequency = localStorage.getItem(frequencyKey);
        const nextFrequency: ReminderFrequency = storedFrequency === 'five_days' ? 'five_days' : 'daily';
        setFrequency(nextFrequency);

        const response = await axios.get('/exams/lobby');
        if (cancelled) return;
        const currentTime = Date.now();
        const session = selectNextExamSession(response.data?.data || {}, currentTime);
        if (!session) return;
        const lastShownAt = Number(localStorage.getItem(lastShownKey) || 0);
        if (!shouldShowNotice(nextFrequency, lastShownAt, session.startsAt, currentTime)) return;

        setExams(session.exams);
        setTargetAt(session.startsAt);
        setSessionEndsAt(session.endsAt);
        openTimer = window.setTimeout(openWhenAvailable, 1200);
      } catch {
        // This reminder is optional; a lobby/network error must not interrupt the page.
      }
    };

    void load();
    return () => {
      cancelled = true;
      if (openTimer) window.clearTimeout(openTimer);
    };
  }, [frequencyKey, isAuthenticated, lastShownKey, user?.id]);

  useEffect(() => {
    if (!open || sessionEndsAt === null) return;
    let cancelled = false;

    const refreshSession = async () => {
      if (Date.now() <= sessionEndsAt) return;
      try {
        const response = await axios.get('/exams/lobby');
        if (cancelled) return;
        const nextSession = selectNextExamSession(response.data?.data || {}, Date.now());
        if (!nextSession) {
          closeNotice();
          return;
        }
        setExams(nextSession.exams);
        setTargetAt(nextSession.startsAt);
        setSessionEndsAt(nextSession.endsAt);
        setNow(Date.now());
      } catch {
        // Keep the current notice visible and retry on the next interval.
      }
    };

    const timer = window.setInterval(() => void refreshSession(), 30_000);
    void refreshSession();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [closeNotice, open, sessionEndsAt]);

  useEffect(() => {
    if (!open || targetAt === null) return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [open, targetAt]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeNotice();
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [closeNotice, open]);

  const countdown = useMemo(
    () => countdownParts(targetAt || now, now),
    [now, targetAt],
  );

  const examMonth = targetAt
    ? new Intl.DateTimeFormat('vi-VN', { month: 'long', timeZone: 'Asia/Shanghai' }).format(new Date(targetAt)).toUpperCase()
    : '';

  const saveFrequency = (next: ReminderFrequency) => {
    localStorage.setItem(frequencyKey, next);
    setFrequency(next);
    closeNotice();
  };

  if (!open || targetAt === null || exams.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[10040] flex items-end justify-center overflow-y-auto bg-slate-950/55 p-2 backdrop-blur-[3px] sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeNotice();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="exam-countdown-title"
        aria-describedby="exam-countdown-description"
        className={`${styles.noticeBackground} relative my-auto w-full max-w-5xl overflow-hidden rounded-[26px] border border-[#d9b975] shadow-[0_32px_100px_rgba(20,12,5,0.48)]`}
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={closeNotice}
          aria-label="Đóng thông báo lịch thi"
          className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-[#d7c09a] bg-[#fffaf1]/90 text-[#51463d] shadow-sm backdrop-blur transition hover:bg-white hover:text-[#b9231a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9231a] sm:right-5 sm:top-5"
        >
          <FiX size={21} />
        </button>

        <div className="relative z-10 px-4 pb-5 pt-20 sm:px-8 sm:pb-8 sm:pt-24 lg:px-16">
          <header className="mx-auto max-w-3xl text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#b9231a]">Kỳ thi gần nhất</p>
            <h2 id="exam-countdown-title" className="mt-1 font-serif text-2xl font-black tracking-tight text-[#8f1e18] sm:text-4xl">
              KỲ THI CSCA {examMonth}
            </h2>
            <p id="exam-countdown-description" className="mt-1 text-sm font-semibold text-[#5f554b] sm:text-base">
              {targetAt <= now ? 'Kỳ thi đang diễn ra' : 'Còn bao lâu nữa đến kỳ thi?'}
            </p>
          </header>

          <div className="mx-auto mt-4 grid max-w-3xl grid-cols-4 gap-2 sm:mt-6 sm:gap-4">
            <FlipUnit value={countdown.days} label="NGÀY" emphasis />
            <FlipUnit value={countdown.hours} label="GIỜ" />
            <FlipUnit value={countdown.minutes} label="PHÚT" />
            <FlipUnit value={countdown.seconds} label="GIÂY" />
          </div>

          <div className="mx-auto mt-5 max-w-3xl overflow-hidden rounded-2xl border border-[#dfc797] bg-[#fffdf8]/88 shadow-sm backdrop-blur-[2px] sm:mt-7">
            <div className="flex items-center justify-center gap-2 border-b border-[#eadabd] px-3 py-2.5 text-center text-[10px] font-black uppercase tracking-[0.12em] text-[#a4211a] sm:text-xs">
              <FiClock size={14} /> Lịch thi của bạn · Giờ Bắc Kinh (UTC+8)
            </div>
            <div className="max-h-[230px] divide-y divide-[#eee1c9] overflow-y-auto">
              {exams.map((exam) => {
                const meta = SUBJECT_META[String(exam.subject_code || '').toUpperCase()] || { icon: '✦', tone: 'bg-amber-50 text-amber-700' };
                const date = formatInTimeZone(exam.start_time as string, { day: '2-digit', month: '2-digit', timeZone: 'Asia/Shanghai' });
                const start = formatInTimeZone(exam.start_time as string, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' });
                const end = formatInTimeZone(exam.end_time as string, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' });
                const actualMinutes = Math.max(1, Math.round((new Date(exam.end_time as string).getTime() - new Date(exam.start_time as string).getTime()) / 60000));
                const duration = Number(exam.duration) > 0 ? Number(exam.duration) : actualMinutes;
                return (
                  <div key={exam.id} className="grid grid-cols-[auto_42px_minmax(0,1fr)] items-center gap-2 px-3 py-2.5 text-xs sm:grid-cols-[auto_56px_minmax(0,1fr)_120px_72px] sm:gap-3 sm:px-5 sm:text-sm">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${meta.tone}`}>{meta.icon}</span>
                    <span className="font-bold tabular-nums text-[#65584c]">{date}</span>
                    <span className="truncate font-black text-[#312b27]">{exam.subject_name || exam.title}</span>
                    <span className="col-start-3 inline-flex items-center gap-1 font-bold tabular-nums text-[#65584c] sm:col-start-auto"><FiClock size={13} /> {start}–{end}</span>
                    <span className="col-start-3 text-[11px] font-bold text-[#9b6b22] sm:col-start-auto sm:text-xs">{duration} phút</span>
                  </div>
                );
              })}
            </div>
            <p className="border-t border-[#eadabd] px-3 py-2 text-center text-[10px] font-semibold text-[#7d7064] sm:text-xs">
              Giờ Việt Nam lùi 1 giờ so với lịch trên.
            </p>
          </div>

          <p className="mx-auto mt-4 max-w-2xl text-center font-serif text-sm italic text-[#51463d] sm:text-base">
            Mỗi ngày tiến thêm một chút, ngày thi sẽ bớt áp lực hơn.
          </p>

          <div className="mx-auto mt-4 flex max-w-2xl flex-col gap-2.5 sm:flex-row sm:gap-3">
            <button
              type="button"
              onClick={() => {
                closeNotice();
                router.push('/lo-trinh');
              }}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#bd2118] px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/15 transition hover:bg-[#a91d16] active:scale-[0.99]"
            >
              <FiBookOpen size={17} /> Bắt đầu ôn tập
            </button>

            <div className="relative flex-1">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={frequencyMenuOpen}
                onClick={() => setFrequencyMenuOpen((current) => !current)}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#c79a45] bg-[#fffaf0]/92 px-5 py-3 text-sm font-black text-[#8d5e19] shadow-sm transition hover:bg-white active:scale-[0.99]"
              >
                <FiBell size={17} /> {frequency === 'daily' ? 'Nhắc hằng ngày' : 'Nhắc mỗi 5 ngày'} <FiChevronDown size={15} />
              </button>

              {frequencyMenuOpen && (
                <div role="menu" className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-30 overflow-hidden rounded-xl border border-[#dcc69e] bg-white p-1.5 shadow-xl">
                  {([
                    ['daily', 'Nhắc hằng ngày'],
                    ['five_days', 'Nhắc mỗi 5 ngày'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="menuitem"
                      onClick={() => saveFrequency(value)}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-bold text-[#51463d] transition hover:bg-[#fff4df]"
                    >
                      {label}
                      {frequency === value && <FiCheck className="text-[#b9231a]" size={16} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <p className="mt-3 text-center text-[10px] font-semibold text-[#827467] sm:text-xs">
            Trong 24 giờ trước kỳ thi, hệ thống luôn ưu tiên nhắc bạn mỗi ngày.
          </p>
        </div>
      </section>
    </div>
  );
}

