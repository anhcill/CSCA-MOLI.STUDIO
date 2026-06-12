'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiCheckCircle,
  FiCopy,
  FiDownload,
  FiMonitor,
  FiRefreshCw,
  FiShare2,
  FiSmartphone,
  FiX,
} from 'react-icons/fi';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type GuideType = 'pc' | 'android' | 'iphone';

declare global {
  interface Window {
    moliDeferredPwaPrompt?: BeforeInstallPromptEvent | null;
  }
}

function isStandalonePwa() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

function isIOSDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isAndroidDevice() {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

function getDefaultGuide(): GuideType {
  if (isIOSDevice()) return 'iphone';
  if (isAndroidDevice()) return 'android';
  return 'pc';
}

const guideCopy: Record<GuideType, { title: string; steps: string[]; icon: React.ElementType }> = {
  pc: {
    title: 'Cài trên PC',
    icon: FiMonitor,
    steps: [
      'Mở web bằng Chrome hoặc Edge.',
      'Bấm biểu tượng cài app ở bên phải thanh địa chỉ.',
      'Nếu không thấy biểu tượng, mở menu trình duyệt rồi chọn Cài đặt CSCA MOLI.',
      'Sau khi cài, app sẽ nằm ở màn hình chính hoặc danh sách ứng dụng.',
    ],
  },
  android: {
    title: 'Cài trên Android',
    icon: FiSmartphone,
    steps: [
      'Mở web bằng Chrome.',
      'Bấm menu ba chấm ở góc trên.',
      'Chọn Cài đặt ứng dụng hoặc Thêm vào màn hình chính.',
      'Bấm Cài đặt/Thêm để hoàn tất.',
    ],
  },
  iphone: {
    title: 'Cài trên iPhone',
    icon: FiShare2,
    steps: [
      'Mở web bằng Safari. Chrome, Facebook, Zalo browser không cài PWA đúng được.',
      'Bấm nút Chia sẻ ở thanh dưới Safari.',
      'Kéo xuống chọn Thêm vào màn hình chính.',
      'Bấm Thêm. Sau đó mở CSCA MOLI từ icon ngoài màn hình chính.',
    ],
  },
};

export default function PWAInstallSettings() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [guide, setGuide] = useState<GuideType | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setInstalled(isStandalonePwa() || localStorage.getItem('pwa-installed') === '1');
    setPromptEvent(window.moliDeferredPwaPrompt || null);

    const syncPrompt = () => setPromptEvent(window.moliDeferredPwaPrompt || null);
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      const nextPrompt = event as BeforeInstallPromptEvent;
      window.moliDeferredPwaPrompt = nextPrompt;
      setPromptEvent(nextPrompt);
    };
    const handleInstalled = () => {
      window.moliDeferredPwaPrompt = null;
      localStorage.setItem('pwa-installed', '1');
      localStorage.setItem('pwa-install-dismissed', '1');
      setPromptEvent(null);
      setInstalled(true);
      setMessage('Đã cài CSCA MOLI trên thiết bị này.');
    };

    window.addEventListener('moli-pwa-install-ready', syncPrompt);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('moli-pwa-install-ready', syncPrompt);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const openGuide = useCallback((type: GuideType) => {
    setGuide(type);
    setMessage('');
  }, []);

  const waitForInstallPrompt = useCallback(async () => {
    if (window.moliDeferredPwaPrompt) return window.moliDeferredPwaPrompt;

    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.update();
      } catch {
        // Browser may block update checks; keep falling back to guide.
      }
    }

    return new Promise<BeforeInstallPromptEvent | null>((resolve) => {
      if (window.moliDeferredPwaPrompt) {
        resolve(window.moliDeferredPwaPrompt);
        return;
      }

      const timer = window.setTimeout(() => {
        window.removeEventListener('moli-pwa-install-ready', handleReady);
        window.removeEventListener('beforeinstallprompt', handlePrompt);
        resolve(window.moliDeferredPwaPrompt || null);
      }, 1200);

      const done = (prompt: BeforeInstallPromptEvent | null) => {
        window.clearTimeout(timer);
        window.removeEventListener('moli-pwa-install-ready', handleReady);
        window.removeEventListener('beforeinstallprompt', handlePrompt);
        resolve(prompt);
      };

      const handleReady = () => done(window.moliDeferredPwaPrompt || null);
      const handlePrompt = (event: Event) => {
        event.preventDefault();
        const nextPrompt = event as BeforeInstallPromptEvent;
        window.moliDeferredPwaPrompt = nextPrompt;
        setPromptEvent(nextPrompt);
        done(nextPrompt);
      };

      window.addEventListener('moli-pwa-install-ready', handleReady);
      window.addEventListener('beforeinstallprompt', handlePrompt);
    });
  }, []);

  const installApp = useCallback(async (fallbackGuide?: GuideType) => {
    try {
      setBusy(true);
      setMessage('');
      const prompt = promptEvent || await waitForInstallPrompt();
      if (!prompt) {
        openGuide(fallbackGuide || getDefaultGuide());
        return;
      }

      await prompt.prompt();
      const choice = await prompt.userChoice;
      window.moliDeferredPwaPrompt = null;
      setPromptEvent(null);
      localStorage.setItem('pwa-install-dismissed', '1');
      if (choice.outcome === 'accepted') {
        localStorage.setItem('pwa-installed', '1');
        setInstalled(true);
        setMessage('Đã bắt đầu cài app.');
      } else {
        setMessage('Bạn có thể quay lại mục này để cài sau.');
      }
    } finally {
      setBusy(false);
    }
  }, [openGuide, promptEvent, waitForInstallPrompt]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard?.writeText('https://www.molystudio.online');
      setMessage('Đã copy link web.');
    } catch {
      setMessage('Link web: https://www.molystudio.online');
    }
  }, []);

  const currentGuide = useMemo(() => (guide ? guideCopy[guide] : null), [guide]);
  const GuideIcon = currentGuide?.icon || FiDownload;

  return (
    <>
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
              {installed ? <FiCheckCircle size={18} /> : <FiDownload size={18} />}
            </div>
            <div>
              <p className="text-sm font-black text-gray-900">Cài app CSCA MOLI</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-gray-500">
                Thêm web vào màn hình chính để mở nhanh như app trên PC, Android và iPhone.
              </p>
              <div className="mt-2 grid gap-1 text-[11px] font-bold text-gray-500 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => installApp('pc')}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-left hover:bg-indigo-50 hover:text-indigo-700"
                >
                  <FiMonitor size={12} />
                  PC: biểu tượng cài app
                </button>
                <button
                  type="button"
                  onClick={() => installApp('android')}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-left hover:bg-indigo-50 hover:text-indigo-700"
                >
                  <FiSmartphone size={12} />
                  Android: Cài đặt ứng dụng
                </button>
                <button
                  type="button"
                  onClick={() => installApp('iphone')}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-left hover:bg-indigo-50 hover:text-indigo-700"
                >
                  <FiShare2 size={12} />
                  iPhone: Chia sẻ
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => installApp()}
            disabled={busy || installed}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <FiRefreshCw className="animate-spin" size={14} /> : installed ? <FiCheckCircle size={14} /> : <FiDownload size={14} />}
            {installed ? 'Đã cài' : 'Cài ngay'}
          </button>
        </div>

        {message && (
          <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-semibold leading-5 text-gray-700">
            {message}
          </p>
        )}
      </div>

      {currentGuide && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setGuide(null)}
              className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Đóng hướng dẫn cài app"
            >
              <FiX size={18} />
            </button>

            <div className="mb-4 flex items-center gap-3 pr-10">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white">
                <GuideIcon size={22} />
              </div>
              <div>
                <p className="text-lg font-black text-slate-950">{currentGuide.title}</p>
                <p className="text-xs font-semibold text-slate-500">Làm theo các bước dưới đây.</p>
              </div>
            </div>

            <ol className="space-y-3">
              {currentGuide.steps.map((step, index) => (
                <li key={step} className="flex gap-3 rounded-2xl bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-700">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-black text-white">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-black text-white hover:bg-indigo-700"
              >
                <FiCopy size={15} />
                Copy link web
              </button>
              <button
                type="button"
                onClick={() => setGuide(null)}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
