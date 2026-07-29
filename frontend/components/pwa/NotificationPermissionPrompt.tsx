'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiBell, FiCheck, FiLoader, FiX } from 'react-icons/fi';
import {
  getPushStatus,
  savePushSubscription,
  type PushStatus,
} from '@/lib/api/pushNotifications';

const PUSH_PROMPT_DECISION_KEY = 'moli:push-prompt-decision';
const PROMPT_DELAY_MS = 1200;

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function isStandalonePwa() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

function isIOSDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export default function NotificationPermissionPrompt() {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const supported = useMemo(() => (
    typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator
    && 'PushManager' in window
  ), []);

  useEffect(() => {
    if (!supported || Notification.permission !== 'default') return;
    if (localStorage.getItem(PUSH_PROMPT_DECISION_KEY)) return;
    if (isIOSDevice() && !isStandalonePwa()) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    getPushStatus()
      .then(async (nextStatus) => {
        if (cancelled || !nextStatus.configured || !nextStatus.publicKey) return;

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (cancelled || subscription) return;

        setStatus(nextStatus);
        timer = setTimeout(() => {
          if (!cancelled) setVisible(true);
        }, PROMPT_DELAY_MS);
      })
      .catch(() => {
        // The prompt is optional, so API or service-worker errors stay unobtrusive.
      });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [supported]);

  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        localStorage.setItem(PUSH_PROMPT_DECISION_KEY, 'dismissed');
        setVisible(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible]);

  const dismiss = useCallback(() => {
    localStorage.setItem(PUSH_PROMPT_DECISION_KEY, 'dismissed');
    setVisible(false);
  }, []);

  const enableNotifications = useCallback(async () => {
    if (!status?.publicKey) return;

    try {
      setBusy(true);
      setError('');

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        localStorage.setItem(PUSH_PROMPT_DECISION_KEY, 'denied');
        setVisible(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(status.publicKey),
        });
      }

      await savePushSubscription(subscription);
      localStorage.setItem(PUSH_PROMPT_DECISION_KEY, 'enabled');
      setVisible(false);
    } catch {
      setError('Chưa thể bật thông báo. Bạn có thể thử lại hoặc bật sau trong trang Hồ sơ.');
    } finally {
      setBusy(false);
    }
  }, [status?.publicKey]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/40 p-3 backdrop-blur-[2px] sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="push-permission-title"
      aria-describedby="push-permission-description"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-[24px] border border-white/70 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400" />
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-4 top-5 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:hover:bg-slate-800 dark:hover:text-white"
          aria-label="Không nhận thông báo"
        >
          <FiX size={18} />
        </button>

        <div className="p-6 sm:p-7">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
            <FiBell size={25} />
          </div>

          <h2 id="push-permission-title" className="pr-8 text-xl font-black tracking-tight text-slate-950 dark:text-white">
            Nhận thông báo từ CSCA Moly?
          </h2>
          <p id="push-permission-description" className="mt-2 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
            Nhận nhắc lịch học, lịch thi và các cập nhật quan trọng ngay trên thiết bị này.
          </p>

          <div className="mt-5 space-y-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <FiCheck size={13} />
              </span>
              Bạn có thể tắt bất cứ lúc nào trong Hồ sơ
            </div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <FiCheck size={13} />
              </span>
              Không gửi quảng cáo làm phiền
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-semibold leading-5 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200">
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={dismiss}
              disabled={busy}
              className="flex-1 rounded-xl px-4 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              Không, cảm ơn
            </button>
            <button
              type="button"
              onClick={enableNotifications}
              disabled={busy}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
            >
              {busy ? <FiLoader className="animate-spin" size={16} /> : <FiBell size={16} />}
              {busy ? 'Đang bật...' : 'Cho phép'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
