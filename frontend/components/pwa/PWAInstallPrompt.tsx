'use client';

import { useCallback, useEffect, useState } from 'react';
import { FiDownload, FiShare2, FiX } from 'react-icons/fi';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

function isIOSSafari() {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|Chrome|EdgiOS/.test(ua);
  return isIOS && isSafari;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('pwa-install-dismissed') === '1' || isStandalone()) {
      setDismissed(true);
      return;
    }

    if (isIOSSafari()) {
      setShowIOSGuide(true);
      return;
    }

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setDeferredPrompt(null);
      setDismissed(true);
      localStorage.setItem('pwa-install-dismissed', '1');
    };

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDismissed(true);
      localStorage.setItem('pwa-install-dismissed', '1');
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    setShowIOSGuide(false);
    setDeferredPrompt(null);
    localStorage.setItem('pwa-install-dismissed', '1');
  }, []);

  if (dismissed || (!deferredPrompt && !showIOSGuide)) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-slide-up">
      <div className="relative rounded-2xl border border-blue-100 bg-white p-4 shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-6 top-6 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-gray-800"
          aria-label="Đóng"
        >
          <FiX size={16} />
        </button>

        {deferredPrompt && (
          <>
            <div className="mb-3 flex items-center gap-3 pr-8">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                <FiDownload size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Cài CSCA MOLI</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Mở nhanh như app trên máy này</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleInstall}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-95"
              >
                Cài app
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="rounded-xl px-4 py-2.5 text-sm text-gray-500 transition hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Để sau
              </button>
            </div>
          </>
        )}

        {showIOSGuide && (
          <>
            <div className="mb-3 flex items-start gap-3 pr-8">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                <FiShare2 size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Thêm vào màn hình chính</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                  Trên iPhone, nhấn <strong>Chia sẻ</strong> rồi chọn <strong>Thêm vào màn hình chính</strong>.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="w-full rounded-xl px-4 py-2 text-sm text-gray-500 transition hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Đã hiểu
            </button>
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(100%);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}
