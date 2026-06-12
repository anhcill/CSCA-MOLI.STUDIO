'use client';

import { useCallback, useEffect, useState } from 'react';
import { FiCheckCircle, FiDownload, FiMonitor, FiRefreshCw, FiShare2, FiSmartphone } from 'react-icons/fi';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

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

function getBrowserHint() {
  if (typeof navigator === 'undefined') return 'Mở menu trình duyệt rồi chọn Cài đặt ứng dụng.';
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'Trên Android, bấm menu trình duyệt rồi chọn Cài đặt ứng dụng hoặc Thêm vào màn hình chính.';
  if (/Windows|Macintosh|Linux/i.test(ua)) return 'Trên PC, bấm biểu tượng cài app ở thanh địa chỉ hoặc menu trình duyệt > Cài đặt CSCA MOLI.';
  return 'Mở menu trình duyệt rồi chọn Cài đặt ứng dụng hoặc Thêm vào màn hình chính.';
}

export default function PWAInstallSettings() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

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

  const installApp = useCallback(async () => {
    if (!promptEvent) {
      setMessage(isIOSDevice()
        ? 'Trên iPhone, bấm Chia sẻ rồi chọn Thêm vào màn hình chính.'
        : getBrowserHint());
      return;
    }

    try {
      setBusy(true);
      setMessage('');
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      window.moliDeferredPwaPrompt = null;
      setPromptEvent(null);
      localStorage.setItem('pwa-install-dismissed', '1');
      localStorage.setItem('pwa-installed', '1');
      setMessage(choice.outcome === 'accepted'
        ? 'Đã bắt đầu cài app.'
        : 'Bạn có thể quay lại mục này để cài sau.');
    } finally {
      setBusy(false);
    }
  }, [promptEvent]);

  return (
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
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1">
                <FiMonitor size={12} />
                PC: biểu tượng cài app
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1">
                <FiSmartphone size={12} />
                Android: Cài đặt ứng dụng
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1">
                <FiShare2 size={12} />
                iPhone: Chia sẻ
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={installApp}
          disabled={busy || installed}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <FiRefreshCw className="animate-spin" size={14} /> : installed ? <FiCheckCircle size={14} /> : <FiDownload size={14} />}
          {installed ? 'Đã cài' : promptEvent ? 'Cài ngay' : 'Xem cách cài'}
        </button>
      </div>

      {message && (
        <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-semibold leading-5 text-gray-700">
          {message}
        </p>
      )}
    </div>
  );
}
