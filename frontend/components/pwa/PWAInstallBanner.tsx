'use client';

import { useCallback, useEffect, useState } from 'react';
import { FiDownload, FiShare2, FiX } from 'react-icons/fi';

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

export default function PWAInstallBanner() {
  const [visible, setVisible] = useState(false);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandalonePwa()) return;
    if (localStorage.getItem('pwa-installed') === '1') return;
    if (localStorage.getItem('pwa-install-banner-dismissed') === '1') return;

    const existingPrompt = window.moliDeferredPwaPrompt || null;
    setPromptEvent(existingPrompt);
    setVisible(Boolean(existingPrompt) || isIOSDevice());

    const syncPrompt = () => setPromptEvent(window.moliDeferredPwaPrompt || null);
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      const nextPrompt = event as BeforeInstallPromptEvent;
      window.moliDeferredPwaPrompt = nextPrompt;
      setPromptEvent(nextPrompt);
      setVisible(true);
    };
    const handleInstalled = () => {
      window.moliDeferredPwaPrompt = null;
      localStorage.setItem('pwa-installed', '1');
      localStorage.setItem('pwa-install-banner-dismissed', '1');
      setPromptEvent(null);
      setVisible(false);
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

  const dismiss = useCallback(() => {
    localStorage.setItem('pwa-install-banner-dismissed', '1');
    setVisible(false);
  }, []);

  const install = useCallback(async () => {
    if (!promptEvent) {
      setMessage(isIOSDevice()
        ? 'iPhone: bấm Chia sẻ rồi chọn Thêm vào màn hình chính.'
        : 'PC/Android: mở menu trình duyệt hoặc bấm biểu tượng cài app trên thanh địa chỉ.');
      return;
    }

    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    window.moliDeferredPwaPrompt = null;
    setPromptEvent(null);
    if (choice.outcome === 'accepted') {
      localStorage.setItem('pwa-installed', '1');
      localStorage.setItem('pwa-install-banner-dismissed', '1');
      setVisible(false);
    } else {
      setMessage('Bạn vẫn có thể cài lại trong Hồ sơ > Cài đặt > Cài app.');
    }
  }, [promptEvent]);

  if (!visible) return null;

  return (
    <div className="border-b border-indigo-100 bg-indigo-600 text-white shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
            {isIOSDevice() ? <FiShare2 size={18} /> : <FiDownload size={18} />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black">Cài CSCA MOLI vào màn hình chính</p>
            <p className="mt-0.5 text-xs font-semibold leading-5 text-indigo-50">
              Mở nhanh như app, học tiếp thuận tiện trên PC, Android và iPhone.
            </p>
            {message && <p className="mt-1 text-xs font-bold text-white">{message}</p>}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={install}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-black text-indigo-700 shadow-sm hover:bg-indigo-50"
          >
            {promptEvent ? <FiDownload size={14} /> : <FiShare2 size={14} />}
            {promptEvent ? 'Cài ngay' : 'Cách cài'}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-xl p-2 text-indigo-50 hover:bg-white/10"
            aria-label="Đóng banner cài app"
          >
            <FiX size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
