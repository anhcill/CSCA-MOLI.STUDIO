'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiHome, FiArrowLeft, FiWifiOff, FiRefreshCw } from 'react-icons/fi';
import LottiePlayer from '@/components/common/LottiePlayer';
import notFoundAnimation from '@/public/animations/404-blue.json';
import {
  DEFAULT_WELCOME_SETTINGS,
  getCachedWelcomeSettings,
} from '@/lib/welcome/welcomeConfig';

export default function NotFoundPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [config, setConfig] = useState(DEFAULT_WELCOME_SETTINGS);

  useEffect(() => {
    setMounted(true);
    setConfig(getCachedWelcomeSettings());
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <main className="fixed inset-0 z-[9990] flex min-h-[100dvh] w-full flex-col items-center justify-center bg-white px-4 py-8 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white">
      {/* Background ambient gradient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[350px] w-[350px] rounded-full bg-blue-500/10 blur-3xl dark:bg-blue-600/15" />
      </div>

      <div className="relative z-10 flex w-full max-w-lg flex-col items-center text-center">
        {/* Lottie Animation 404 Robot */}
        <div className="h-60 w-60 sm:h-72 sm:w-72 md:h-80 md:w-80 select-none pointer-events-none filter drop-shadow-xl">
          {mounted && (
            <LottiePlayer
              animationData={notFoundAnimation}
              loop={true}
              autoplay={true}
              className="h-full w-full"
            />
          )}
        </div>

        {/* Heading */}
        <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl text-slate-900 dark:text-white">
          {!isOnline ? (
            <span className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400">
              <FiWifiOff /> {config.offlineTitle}
            </span>
          ) : (
            config.notFoundTitle
          )}
        </h1>

        {/* Description */}
        <p className="mt-3 max-w-md text-sm text-slate-600 sm:text-base leading-relaxed dark:text-slate-400">
          {!isOnline ? config.offlineMessage : config.notFoundMessage}
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {!isOnline ? (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-amber-500/20 transition-all hover:bg-amber-700 active:scale-95"
            >
              <FiRefreshCw className="animate-spin" />
              <span>Thử kết nối lại</span>
            </button>
          ) : (
            <>
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-red-500/20 transition-all hover:bg-red-700 hover:-translate-y-0.5 active:scale-95"
              >
                <FiHome />
                <span>{config.homeButtonText}</span>
              </Link>
              <button
                type="button"
                onClick={() => router.back()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 active:scale-95"
              >
                <FiArrowLeft />
                <span>{config.backButtonText}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
