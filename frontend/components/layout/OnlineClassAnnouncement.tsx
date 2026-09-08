'use client';

import { useEffect, useState } from 'react';
import { FiBookOpen, FiCheck, FiMessageCircle, FiX } from 'react-icons/fi';
import { MOLY_ZALO_URL } from '@/lib/constants/moly';

const ANNOUNCEMENT_VERSION = 'online-classes-2026-09';
const HIDDEN_VERSION_KEY = 'moli:online-class-announcement:hidden-version';
const SNOOZED_UNTIL_KEY = 'moli:online-class-announcement:snoozed-until';
const SNOOZE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

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
    <section
      className="fixed inset-x-3 bottom-24 z-[60] mx-auto w-auto max-w-xl overflow-hidden rounded-3xl border border-white/25 bg-gradient-to-br from-[#112a55] via-[#1d4480] to-[#3568bd] text-white shadow-2xl shadow-slate-950/30 sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:w-[min(38rem,calc(100vw-2rem))] sm:-translate-x-1/2"
      role="dialog"
      aria-label="Thông báo lớp online MOLY"
      aria-describedby="online-class-announcement-description"
    >
      <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-sky-200/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-24 left-8 h-40 w-40 rounded-full bg-indigo-300/15 blur-2xl" />

      <div className="relative p-4 sm:p-5">
        <button
          type="button"
          onClick={() => dismiss()}
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full text-blue-100 transition hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/80"
          aria-label="Đóng thông báo lớp online"
          title="Đóng trong 7 ngày"
        >
          <FiX size={20} />
        </button>

        <div className="flex gap-3 pr-8 sm:gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/25 bg-white/15 shadow-inner shadow-white/10">
            <FiBookOpen size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-sky-100">
              Lớp online mở đăng ký
            </p>
            <h2 className="mt-1 text-lg font-black leading-snug sm:text-xl">
              MOLY mở lớp ôn thi CSCA online
            </h2>
            <p id="online-class-announcement-description" className="mt-1 text-sm font-medium leading-5 text-blue-50">
              Nhắn Zalo để được tư vấn môn học và lộ trình phù hợp trước khi đăng ký.
            </p>
          </div>
        </div>

        <div className="relative mt-4 flex flex-wrap gap-2 text-xs font-bold text-blue-50">
          {['Toán', 'Vật lý', 'Tiếng Trung'].map((subject) => (
            <span key={subject} className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">
              {subject}
            </span>
          ))}
        </div>

        <div className="relative mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-blue-50">
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
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-[#174382] shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5 hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#2554a0]"
          >
            <FiMessageCircle size={17} />
            Nhắn Zalo tư vấn
            <FiCheck size={15} aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}
