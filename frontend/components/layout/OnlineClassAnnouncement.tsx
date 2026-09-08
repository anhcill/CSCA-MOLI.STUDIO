'use client';

import { useEffect, useState } from 'react';
import { FiBookOpen, FiCheck, FiMessageCircle, FiX } from 'react-icons/fi';
import { MOLY_ZALO_URL } from '@/lib/constants/moly';

const ANNOUNCEMENT_VERSION = 'online-classes-2026-09';
const HIDDEN_VERSION_KEY = 'moli:online-class-announcement:hidden-version';
const SNOOZED_UNTIL_KEY = 'moli:online-class-announcement:snoozed-until';
const SNOOZE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const ANNOUNCEMENT_BACKGROUND = 'https://res.cloudinary.com/dvrgrmais/image/upload/v1785245197/csca/course-library/hero-learning-web.webp';

export default function OnlineClassAnnouncement() {
  const [visible, setVisible] = useState(false);
  const [doNotShowAgain, setDoNotShowAgain] = useState(false);

  useEffect(() => {
    const hiddenVersion = localStorage.getItem(HIDDEN_VERSION_KEY);
    if (hiddenVersion === ANNOUNCEMENT_VERSION) return;

    const snoozedUntil = Number(localStorage.getItem(SNOOZED_UNTIL_KEY));
    if (Number.isFinite(snoozedUntil) && snoozedUntil > Date.now()) return;
    if (Number.isFinite(snoozedUntil)) localStorage.removeItem(SNOOZED_UNTIL_KEY);

    const timer = window.setTimeout(() => setVisible(true), 700);
    return () => window.clearTimeout(timer);
  }, []);

  const dismiss = (hidePermanently = doNotShowAgain) => {
    if (hidePermanently) {
      localStorage.setItem(HIDDEN_VERSION_KEY, ANNOUNCEMENT_VERSION);
      localStorage.removeItem(SNOOZED_UNTIL_KEY);
    } else {
      localStorage.setItem(SNOOZED_UNTIL_KEY, String(Date.now() + SNOOZE_DURATION_MS));
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 px-3 py-6 backdrop-blur-[3px] sm:px-5">
      <section
        className="relative max-h-[calc(100dvh-3rem)] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-white/25 bg-slate-900 bg-cover bg-center text-white shadow-2xl shadow-slate-950/50"
        style={{
          backgroundImage: `linear-gradient(115deg, rgba(6, 20, 46, .96) 0%, rgba(12, 42, 88, .88) 52%, rgba(21, 70, 128, .68) 100%), url("${ANNOUNCEMENT_BACKGROUND}")`,
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Thông báo lớp online MOLY"
        aria-describedby="online-class-announcement-description"
      >
        <div className="pointer-events-none absolute -right-16 -top-20 h-60 w-60 rounded-full bg-sky-200/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-8 h-48 w-48 rounded-full bg-indigo-300/20 blur-3xl" />

        <div className="relative p-6 sm:p-8">
        <button
          type="button"
          onClick={() => dismiss()}
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full text-blue-100 transition hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/80"
          aria-label="Đóng thông báo lớp online"
          title="Đóng trong 7 ngày"
        >
          <FiX size={20} />
        </button>

        <div className="flex gap-4 pr-8 sm:gap-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/30 bg-white/15 shadow-inner shadow-white/10 sm:h-16 sm:w-16">
            <FiBookOpen size={28} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-100 sm:text-sm">
              Lớp online mở đăng ký
            </p>
            <h2 className="mt-2 text-2xl font-black leading-tight sm:text-3xl">
              MOLY mở lớp ôn thi CSCA online
            </h2>
            <p id="online-class-announcement-description" className="mt-3 max-w-xl text-base font-medium leading-6 text-blue-50 sm:text-lg sm:leading-7">
              Nhắn Zalo để được tư vấn môn học và lộ trình phù hợp trước khi đăng ký.
            </p>
          </div>
        </div>

        <div className="relative mt-6 flex flex-wrap gap-2.5 text-sm font-bold text-blue-50">
          {['Toán', 'Vật lý', 'Tiếng Trung'].map((subject) => (
            <span key={subject} className="rounded-full border border-white/25 bg-slate-950/30 px-4 py-2 backdrop-blur-sm">
              {subject}
            </span>
          ))}
        </div>

        <div className="relative mt-7 flex flex-col gap-4 border-t border-white/20 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-blue-50">
            <input
              type="checkbox"
              checked={doNotShowAgain}
              onChange={(event) => setDoNotShowAgain(event.target.checked)}
              className="h-4 w-4 rounded border-white/50 bg-white/10 text-[#2554a0] focus:ring-2 focus:ring-white"
            />
            Không hiển thị lại thông báo này
          </label>

          <a
            href={MOLY_ZALO_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => dismiss()}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3 text-base font-black text-[#174382] shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#2554a0]"
          >
            <FiMessageCircle size={19} />
            Nhắn Zalo tư vấn
            <FiCheck size={17} aria-hidden="true" />
          </a>
        </div>

        <p className="relative mt-4 text-center text-xs font-medium text-blue-100/75">
          Bạn có thể đóng thông báo bất cứ lúc nào.
        </p>
        </div>
      </section>
    </div>
  );
}
